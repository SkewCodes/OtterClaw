export interface CliCapability {
  binary: string;
  subcommands: string[];
  allowedPackages?: string[];
  /** Tier 2 — declared in schema but not yet enforced by the runtime. */
  allowedRoutes?: string[];
}

export interface NetworkCapability {
  egress?: string[];
}

export interface FilesystemCapability {
  read?: string[];
  write?: string[];
  denied?: string[];
}

export interface EnvCapability {
  reads?: string[];
  denied?: string[];
}

export interface SkillCapabilities {
  cli?: CliCapability[];
  network?: NetworkCapability;
  filesystem?: FilesystemCapability;
  env?: EnvCapability;
}

export interface InstallStep {
  id: string;
  kind: "command";
  command: string;
  bins: string[];
  label: string;
}

export interface SkillRequires {
  bins: string[];
  install: InstallStep[];
}

export interface SkillPayment {
  scheme: "orderly-ledger";
  price: string;
  currency: "USDC";
  per: "request";
  recipient: string;
}

export interface SkillFrontmatter {
  id?: string;
  name: string;
  description: string;
  version: string;
  publisher?: string;
  hash?: string;
  previousVersion?: string;
  author: string;
  tags: string[];
  requires: SkillRequires;
  capabilities?: SkillCapabilities;
  payment?: SkillPayment;
}

const PKG_MANAGER_BINARIES = new Set(["npm", "yarn", "pnpm", "bun"]);

export function isPackageManagerBinary(binary: string): boolean {
  return PKG_MANAGER_BINARIES.has(binary);
}

export function findCliCapability(
  capabilities: SkillCapabilities | undefined,
  binary: string,
  subcommand: string,
): CliCapability | undefined {
  if (!capabilities?.cli) return undefined;
  return capabilities.cli.find(
    (cap) =>
      cap.binary === binary &&
      Array.isArray(cap.subcommands) &&
      cap.subcommands.includes(subcommand),
  );
}

export function isEgressAllowed(
  capabilities: SkillCapabilities | undefined,
  hostname: string,
): boolean {
  if (!capabilities?.network?.egress) return false;
  return capabilities.network.egress.includes(hostname);
}

export function isFileReadAllowed(
  capabilities: SkillCapabilities | undefined,
  filePath: string,
): boolean {
  if (!capabilities?.filesystem) return false;
  if (matchesAnyPattern(capabilities.filesystem.denied, filePath)) return false;
  return matchesAnyPattern(capabilities.filesystem.read, filePath);
}

export function isFileWriteAllowed(
  capabilities: SkillCapabilities | undefined,
  filePath: string,
): boolean {
  if (!capabilities?.filesystem) return false;
  if (matchesAnyPattern(capabilities.filesystem.denied, filePath)) return false;
  return matchesAnyPattern(capabilities.filesystem.write, filePath);
}

export function isEnvReadAllowed(
  capabilities: SkillCapabilities | undefined,
  varName: string,
): boolean {
  if (!capabilities?.env) return false;
  if (matchesAnyWildcard(capabilities.env.denied, varName)) return false;
  return capabilities.env.reads?.includes(varName) ?? false;
}

export function isEnvDenied(
  capabilities: SkillCapabilities | undefined,
  varName: string,
): boolean {
  return matchesAnyWildcard(capabilities?.env?.denied, varName);
}

function matchesAnyPattern(
  patterns: string[] | undefined,
  value: string,
): boolean {
  if (!patterns) return false;
  return patterns.some((pattern) => globMatch(pattern, value));
}

function matchesAnyWildcard(
  patterns: string[] | undefined,
  value: string,
): boolean {
  if (!patterns) return false;
  return patterns.some((pattern) => {
    if (pattern.endsWith("*")) {
      return value.startsWith(pattern.slice(0, -1));
    }
    return pattern === value;
  });
}

/**
 * Minimal glob matcher supporting * and ** segments.
 * Not a full glob implementation — covers the patterns used in capability manifests.
 * Normalizes backslashes to forward slashes for Windows compatibility.
 */
function globMatch(pattern: string, value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*");
  return new RegExp(`^${regexStr}$`).test(normalized);
}
