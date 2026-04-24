import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { readFile as fsReadFile, writeFile as fsWriteFile, realpath, lstat } from "node:fs/promises";
import { resolve as pathResolve, basename as pathBasename, join as pathJoin } from "node:path";
import type {
  SkillCapabilities,
  SkillFrontmatter,
} from "../schema/skill-frontmatter.js";
import {
  findCliCapability,
  isPackageManagerBinary,
  isEgressAllowed,
  isFileReadAllowed,
  isFileWriteAllowed,
  isEnvReadAllowed,
  isEnvDenied,
} from "../schema/skill-frontmatter.js";
import type { SecClawBridge } from "../events/secclaw-bridge.js";

export interface ExecOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  blocked: boolean;
  reason?: string;
}

export interface SkillRuntime {
  exec(binary: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  getEnv(name: string): string | undefined;
}

export interface CapabilityDelta {
  addedCliBinaries: string[];
  addedEgress: string[];
  addedFsRead: string[];
  addedFsWrite: string[];
  addedEnvReads: string[];
  expanded: boolean;
}

interface SkillRuntimeDeps {
  skill: SkillFrontmatter;
  bridge: SecClawBridge;
  /** SecClaw DependencyAttestor endpoint for package-manager calls. */
  dependencyAttestorUrl?: string;
  /** Absolute path to the SKILL.md file for integrity verification. */
  skillFilePath?: string;
  /**
   * Directory containing `.secclaw/skill-hashes.json`. When provided,
   * the runtime verifies the skill file hash against SecClaw's last-known
   * hash at load time, closing the TOCTOU window between scan and load.
   */
  secclawDir?: string;
  /** Maximum response body size in bytes for the fetch wrapper. Default 10 MB. */
  maxResponseBytes?: number;
  /**
   * Capabilities from the previous version of this skill. When provided and
   * the current version has expanded capabilities, a `skill.capability.expanded`
   * event is emitted to SecClaw at runtime creation time.
   */
  previousCapabilities?: SkillCapabilities;
}

const NETWORK_CAPABLE_BINARIES = new Set(["curl", "wget", "git", "npm", "npx", "yarn", "pnpm"]);

function extractUrlsFromArgs(args: string[]): string[] {
  return args.filter(arg =>
    arg.startsWith("http://") || arg.startsWith("https://"),
  );
}

function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/https?:\/\/[^\s]+/g, "[redacted-url]")
    .replace(/(?:\/[\w.-]+){2,}/g, "[redacted-path]");
}

function blocked(reason: string): ExecResult {
  return { stdout: "", stderr: "", exitCode: 1, blocked: true, reason };
}

function setDiff(current: string[] | undefined, baseline: string[] | undefined): string[] {
  if (!current) return [];
  const base = new Set(baseline ?? []);
  return current.filter((item) => !base.has(item));
}

export function diffCapabilities(
  current: SkillCapabilities | undefined,
  baseline: SkillCapabilities | undefined,
): CapabilityDelta {
  const addedCliBinaries = setDiff(
    current?.cli?.map((c) => c.binary),
    baseline?.cli?.map((c) => c.binary),
  );
  const addedEgress = setDiff(current?.network?.egress, baseline?.network?.egress);
  const addedFsRead = setDiff(current?.filesystem?.read, baseline?.filesystem?.read);
  const addedFsWrite = setDiff(current?.filesystem?.write, baseline?.filesystem?.write);
  const addedEnvReads = setDiff(current?.env?.reads, baseline?.env?.reads);

  return {
    addedCliBinaries,
    addedEgress,
    addedFsRead,
    addedFsWrite,
    addedEnvReads,
    expanded:
      addedCliBinaries.length > 0 ||
      addedEgress.length > 0 ||
      addedFsRead.length > 0 ||
      addedFsWrite.length > 0 ||
      addedEnvReads.length > 0,
  };
}

const KNOWN_BIN_PATHS_UNIX: Record<string, string[]> = {
  orderly: ["/usr/local/bin/orderly", "/usr/bin/orderly"],
  npm: ["/usr/local/bin/npm", "/usr/bin/npm"],
  npx: ["/usr/local/bin/npx", "/usr/bin/npx"],
  yarn: ["/usr/local/bin/yarn", "/usr/bin/yarn"],
  pnpm: ["/usr/local/bin/pnpm", "/usr/bin/pnpm"],
  bun: ["/usr/local/bin/bun", "/usr/bin/bun"],
  curl: ["/usr/bin/curl", "/usr/local/bin/curl"],
  wget: ["/usr/bin/wget", "/usr/local/bin/wget"],
  python3: ["/usr/bin/python3", "/usr/local/bin/python3"],
  python: ["/usr/bin/python", "/usr/local/bin/python"],
  git: ["/usr/bin/git", "/usr/local/bin/git"],
  node: ["/usr/local/bin/node", "/usr/bin/node"],
  gh: ["/usr/local/bin/gh", "/usr/bin/gh"],
  docker: ["/usr/bin/docker", "/usr/local/bin/docker"],
  pip: ["/usr/bin/pip", "/usr/local/bin/pip"],
  pip3: ["/usr/bin/pip3", "/usr/local/bin/pip3"],
};

function resolveBinaryPath(binary: string): string | null {
  const isWindows = process.platform === "win32";
  if (isWindows) {
    // On Windows, rely on PATH but validate the binary exists via where.exe semantics
    // statSync on Windows .exe files: check common locations
    const winPaths = [
      `C:\\Program Files\\nodejs\\${binary}.cmd`,
      `C:\\Program Files\\Git\\cmd\\${binary}.exe`,
      `C:\\Program Files\\Git\\usr\\bin\\${binary}.exe`,
    ];
    for (const p of winPaths) {
      try {
        if (statSync(p).isFile()) return p;
      } catch { /* not found */ }
    }
    return null;
  }
  const candidates = KNOWN_BIN_PATHS_UNIX[binary];
  if (!candidates) return null;
  for (const p of candidates) {
    try {
      if (statSync(p).isFile()) return p;
    } catch { /* not found */ }
  }
  return null;
}

function resolveAllBinaries(caps: SkillCapabilities): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const entry of caps.cli ?? []) {
    const abs = resolveBinaryPath(entry.binary);
    if (abs) resolved.set(entry.binary, abs);
  }
  return resolved;
}

const ZERO_HASH = "sha256:" + "0".repeat(64);
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

function capResponseBody(res: Response, limit: number): Response {
  if (!res.body) return res;
  let total = 0;
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > limit) {
        controller.error(new Error(`Response body exceeded ${limit} bytes`));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return new Response(res.body.pipeThrough(transform), {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export function createSkillRuntime(deps: SkillRuntimeDeps): SkillRuntime {
  const { skill, bridge } = deps;

  if (skill.hash && skill.hash !== ZERO_HASH && deps.skillFilePath) {
    const content = readFileSync(deps.skillFilePath, "utf-8");
    const actual = "sha256:" + createHash("sha256").update(content).digest("hex");
    if (actual !== skill.hash) {
      bridge.emit({
        type: "skill.capability.violation",
        skillId: skill.id ?? skill.name,
        timestamp: Date.now(),
        payload: {
          kind: "integrity",
          detail: `Hash mismatch: declared ${skill.hash}, actual ${actual}`,
        },
      });
      throw new Error(
        `Skill "${skill.name}" integrity check failed — content hash mismatch`,
      );
    }
  }

  if (deps.secclawDir && deps.skillFilePath) {
    const skillId = skill.id ?? skill.name;
    const sidecarPath = pathJoin(deps.secclawDir, "skill-hashes.json");
    try {
      const sidecar: Record<string, string> = JSON.parse(
        readFileSync(sidecarPath, "utf-8"),
      );
      const expectedHash = sidecar[skillId];
      if (expectedHash) {
        const content = readFileSync(deps.skillFilePath, "utf-8");
        const actual = "sha256:" + createHash("sha256").update(content).digest("hex");
        if (actual !== expectedHash) {
          bridge.emit({
            type: "skill.capability.violation",
            skillId,
            timestamp: Date.now(),
            payload: {
              kind: "integrity",
              subkind: "hash-at-load",
              detail: `SecClaw sidecar hash mismatch: expected ${expectedHash}, actual ${actual}`,
            },
          });
          throw new Error(
            `Skill "${skill.name}" integrity check failed — SecClaw sidecar hash mismatch`,
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("sidecar hash mismatch")) {
        throw err;
      }
      bridge.emit({
        type: "skill.capability.violation",
        skillId,
        timestamp: Date.now(),
        payload: {
          kind: "integrity",
          subkind: "hash-at-load",
          detail: `SecClaw sidecar unreadable: ${sidecarPath}`,
        },
      });
    }
  }

  if (!skill.capabilities) {
    throw new Error(
      `Skill "${skill.name}" has no capabilities block. ` +
      `All skills must declare capabilities (deny-by-default).`,
    );
  }

  const caps: SkillCapabilities = skill.capabilities;
  const resolvedBinaries = resolveAllBinaries(caps);

  if (deps.previousCapabilities) {
    const delta = diffCapabilities(caps, deps.previousCapabilities);
    if (delta.expanded) {
      bridge.emit({
        type: "skill.capability.expanded",
        skillId: skill.id ?? skill.name,
        timestamp: Date.now(),
        payload: { previousVersion: skill.previousVersion, delta },
      });
    }
  }

  return {
    async exec(binary, args, options) {
      const subcommand = args[0] ?? "";

      bridge.emit({
        type: "skill.cli.requested",
        skillId: skill.id ?? skill.name,
        timestamp: Date.now(),
        payload: { binary, args },
      });

      const cap = findCliCapability(caps, binary, subcommand);
      if (!cap) {
        const result = blocked(
          `Undeclared CLI invocation: ${binary} ${subcommand}`,
        );
        bridge.emit({
          type: "skill.cli.blocked",
          skillId: skill.id ?? skill.name,
          timestamp: Date.now(),
          payload: { binary, args, reason: result.reason! },
        });
        return result;
      }

      if (NETWORK_CAPABLE_BINARIES.has(binary)) {
        for (const rawUrl of extractUrlsFromArgs(args)) {
          try {
            const urlHost = new URL(rawUrl).hostname;
            if (!isEgressAllowed(caps, urlHost)) {
              const result = blocked(
                `Undeclared egress in ${binary} call: ${urlHost}`,
              );
              bridge.emit({
                type: "skill.cli.blocked",
                skillId: skill.id ?? skill.name,
                timestamp: Date.now(),
                payload: { binary, args, reason: result.reason! },
              });
              return result;
            }
          } catch {
            const result = blocked(`Malformed URL in ${binary} args: ${rawUrl}`);
            bridge.emit({
              type: "skill.cli.blocked",
              skillId: skill.id ?? skill.name,
              timestamp: Date.now(),
              payload: { binary, args, reason: result.reason! },
            });
            return result;
          }
        }
      }

      if (isPackageManagerBinary(binary) && deps.dependencyAttestorUrl) {
        try {
          const attestRes = await globalThis.fetch(deps.dependencyAttestorUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skillId: skill.id ?? skill.name,
              binary,
              args,
              allowedPackages: cap.allowedPackages,
            }),
          });
          if (!attestRes.ok) {
            const result = blocked("SecClaw DependencyAttestor rejected install");
            bridge.emit({
              type: "skill.cli.blocked",
              skillId: skill.id ?? skill.name,
              timestamp: Date.now(),
              payload: { binary, args, reason: result.reason! },
            });
            return result;
          }
        } catch (err) {
          const result = blocked("SecClaw DependencyAttestor unreachable");
          bridge.emit({
            type: "skill.cli.blocked",
            skillId: skill.id ?? skill.name,
            timestamp: Date.now(),
            payload: { binary, args, reason: result.reason!, internalDetail: sanitizeError(err) },
          });
          return result;
        }
      }

      const childEnv = filterEnv(caps, options?.env);
      const resolvedBin = resolvedBinaries.get(binary) ?? binary;

      return new Promise<ExecResult>((resolve) => {
        execFile(
          resolvedBin,
          args,
          {
            cwd: options?.cwd,
            timeout: options?.timeout ?? 30_000,
            env: childEnv,
          },
          (err, stdout, stderr) => {
            let exitCode = 0;
            if (err) {
              bridge.emit({
                type: "skill.cli.error",
                skillId: skill.id ?? skill.name,
                timestamp: Date.now(),
                payload: {
                  binary,
                  args,
                  errorCode: err.code,
                  errorMessage: err.message?.slice(0, 200),
                  signal: err.signal,
                },
              });
              if (typeof err.code === "number") exitCode = err.code;
              else if (err.signal) exitCode = 128;
              else exitCode = 1;
            }
            resolve({
              stdout: stdout ?? "",
              stderr: stderr ?? "",
              exitCode,
              blocked: false,
            });
          },
        );
      });
    },

    async fetch(url, init) {
      let hostname: string;
      try {
        hostname = new URL(url).hostname;
      } catch {
        bridge.emit({
          type: "skill.capability.violation",
          skillId: skill.id ?? skill.name,
          timestamp: Date.now(),
          payload: { kind: "network", detail: `Invalid URL: ${url}` },
        });
        throw new Error(`Blocked: invalid URL ${url}`);
      }

      bridge.emit({
        type: "skill.network.requested",
        skillId: skill.id ?? skill.name,
        timestamp: Date.now(),
        payload: { url, hostname },
      });

      if (!isEgressAllowed(caps, hostname)) {
        bridge.emit({
          type: "skill.capability.violation",
          skillId: skill.id ?? skill.name,
          timestamp: Date.now(),
          payload: {
            kind: "network",
            detail: `Undeclared egress to ${hostname}`,
          },
        });
        throw new Error(`Blocked: undeclared network egress to ${hostname}`);
      }

      const MAX_REDIRECTS = 10;
      let currentUrl = url;
      let currentInit: RequestInit = { ...init, redirect: "manual" };
      let res = await globalThis.fetch(currentUrl, currentInit);

      for (let hops = 0; hops < MAX_REDIRECTS; hops++) {
        if (res.status < 300 || res.status >= 400) break;
        const location = res.headers.get("location");
        if (!location) break;

        const resolved = new URL(location, currentUrl);
        const redirectHost = resolved.hostname;
        if (!isEgressAllowed(caps, redirectHost)) {
          bridge.emit({
            type: "skill.capability.violation",
            skillId: skill.id ?? skill.name,
            timestamp: Date.now(),
            payload: {
              kind: "network",
              detail: `Redirect to undeclared host ${redirectHost} (from ${new URL(currentUrl).hostname})`,
            },
          });
          throw new Error(
            `Blocked: redirect to undeclared host ${redirectHost}`,
          );
        }

        const currentOrigin = new URL(currentUrl).origin;
        const isCrossOrigin = resolved.origin !== currentOrigin;

        if (isCrossOrigin && currentInit.headers) {
          const h = new Headers(currentInit.headers as Record<string, string>);
          h.delete("Authorization");
          h.delete("Cookie");
          currentInit = { ...currentInit, headers: h };
        }

        if (
          res.status === 301 ||
          res.status === 302 ||
          res.status === 303
        ) {
          const { body: _body, method: _method, ...rest } = currentInit;
          currentInit = { ...rest, method: "GET", redirect: "manual" };
        }

        currentUrl = resolved.href;
        res = await globalThis.fetch(currentUrl, currentInit);
      }

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        throw new Error(
          `Too many redirects (>${MAX_REDIRECTS}) from ${url}`,
        );
      }

      return capResponseBody(res, deps.maxResponseBytes ?? MAX_RESPONSE_BYTES);
    },

    async readFile(path) {
      const canonical = await normalizePathForRead(path);
      if (!isFileReadAllowed(caps, canonical)) {
        bridge.emit({
          type: "skill.capability.violation",
          skillId: skill.id ?? skill.name,
          timestamp: Date.now(),
          payload: { kind: "filesystem.read", detail: `Denied read: ${canonical}` },
        });
        throw new Error(`Blocked: undeclared filesystem read of ${canonical}`);
      }
      return fsReadFile(canonical, "utf-8");
    },

    async writeFile(path, content) {
      const canonical = await normalizePathForWrite(path);
      if (!isFileWriteAllowed(caps, canonical)) {
        bridge.emit({
          type: "skill.capability.violation",
          skillId: skill.id ?? skill.name,
          timestamp: Date.now(),
          payload: {
            kind: "filesystem.write",
            detail: `Denied write: ${canonical}`,
          },
        });
        throw new Error(`Blocked: undeclared filesystem write to ${canonical}`);
      }
      return fsWriteFile(canonical, content, "utf-8");
    },

    getEnv(name) {
      if (!isEnvReadAllowed(caps, name)) {
        bridge.emit({
          type: "skill.capability.violation",
          skillId: skill.id ?? skill.name,
          timestamp: Date.now(),
          payload: { kind: "env", detail: `Denied env read: ${name}` },
        });
        return undefined;
      }
      return process.env[name];
    },
  };
}

const BASE_ENV_ALLOWLIST = new Set([
  "PATH", "HOME", "SHELL", "TERM", "LANG", "LC_ALL",
  "USER", "LOGNAME", "TMPDIR", "TMP", "TEMP",
  "NODE_ENV", "TZ",
]);

/**
 * Build a filtered copy of the given env (or process.env) that only includes
 * vars in BASE_ENV_ALLOWLIST or explicitly declared in `env.reads`.
 * `env.denied` patterns still override as a final block.
 */
function filterEnv(
  caps: SkillCapabilities | undefined,
  base?: Record<string, string>,
): NodeJS.ProcessEnv {
  const source: Record<string, string | undefined> = base ?? process.env;
  const allowed = new Set([
    ...BASE_ENV_ALLOWLIST,
    ...(caps?.env?.reads ?? []),
  ]);

  const filtered: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key) && !isEnvDenied(caps, key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Resolve a path to its canonical form for read operations.
 * Uses realpath to follow symlinks; falls back to path.resolve.
 */
async function normalizePathForRead(p: string): Promise<string> {
  try {
    return await realpath(p);
  } catch {
    return pathResolve(p);
  }
}

/**
 * Resolve a path for write operations. Detects symlinks via lstat so the
 * kernel's symlink-following on write doesn't bypass denied-path checks.
 */
async function normalizePathForWrite(p: string): Promise<string> {
  const resolved = pathResolve(p);
  try {
    const stat = await lstat(resolved);
    if (stat.isSymbolicLink()) {
      return await realpath(resolved);
    }
    return resolved;
  } catch {
    const parent = pathResolve(p, "..");
    try {
      const parentReal = await realpath(parent);
      return pathResolve(parentReal, pathBasename(resolved));
    } catch {
      return resolved;
    }
  }
}
