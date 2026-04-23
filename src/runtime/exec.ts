import { execFile } from "node:child_process";
import { readFile as fsReadFile, writeFile as fsWriteFile, realpath } from "node:fs/promises";
import { resolve as pathResolve } from "node:path";
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

interface SkillRuntimeDeps {
  skill: SkillFrontmatter;
  bridge: SecClawBridge;
  /** SecClaw DependencyAttestor endpoint for package-manager calls. */
  dependencyAttestorUrl?: string;
}

function blocked(reason: string): ExecResult {
  return { stdout: "", stderr: "", exitCode: 1, blocked: true, reason };
}

export function createSkillRuntime(deps: SkillRuntimeDeps): SkillRuntime {
  const { skill, bridge } = deps;
  const caps: SkillCapabilities | undefined = skill.capabilities;

  return {
    async exec(binary, args, options) {
      const subcommand = args[0] ?? "";

      bridge.emit({
        type: "skill.cli.requested",
        skillId: skill.id ?? skill.name,
        timestamp: Date.now(),
        payload: { binary, args },
      });

      if (!caps) {
        const result = blocked(
          "Skill has no capabilities block — deny-by-default.",
        );
        bridge.emit({
          type: "skill.cli.blocked",
          skillId: skill.id ?? skill.name,
          timestamp: Date.now(),
          payload: { binary, args, reason: result.reason! },
        });
        return result;
      }

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
            const body = await attestRes.text();
            const result = blocked(
              `SecClaw DependencyAttestor rejected: ${body}`,
            );
            bridge.emit({
              type: "skill.cli.blocked",
              skillId: skill.id ?? skill.name,
              timestamp: Date.now(),
              payload: { binary, args, reason: result.reason! },
            });
            return result;
          }
        } catch (err) {
          const result = blocked(
            `SecClaw DependencyAttestor unreachable: ${err}`,
          );
          bridge.emit({
            type: "skill.cli.blocked",
            skillId: skill.id ?? skill.name,
            timestamp: Date.now(),
            payload: { binary, args, reason: result.reason! },
          });
          return result;
        }
      }

      const childEnv = filterEnv(caps, options?.env);

      return new Promise<ExecResult>((resolve) => {
        execFile(
          binary,
          args,
          {
            cwd: options?.cwd,
            timeout: options?.timeout ?? 30_000,
            env: childEnv,
          },
          (err, stdout, stderr) => {
            let exitCode = 0;
            if (err) {
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

      return res;
    },

    async readFile(path) {
      const canonical = await normalizePath(path);
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
      const canonical = await normalizePath(path);
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

/**
 * Build a filtered copy of the given env (or process.env) that excludes
 * vars matching the skill's `env.denied` patterns.
 */
function filterEnv(
  caps: SkillCapabilities | undefined,
  base?: Record<string, string>,
): NodeJS.ProcessEnv {
  const source: Record<string, string | undefined> = base ?? process.env;
  if (!caps?.env?.denied?.length) return { ...source };

  const filtered: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (!isEnvDenied(caps, key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Resolve a path to its canonical form, collapsing `.`, `..`, and symlinks.
 * Falls back to `path.resolve` if the target doesn't exist yet (write case).
 */
async function normalizePath(p: string): Promise<string> {
  try {
    return await realpath(p);
  } catch {
    return pathResolve(p);
  }
}
