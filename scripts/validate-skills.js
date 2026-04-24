#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv = require("ajv");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "schema", "skill.schema.json");
const SKILL_DIRS = ["skills", "partner-skills"];

const strict = process.argv.includes("--strict");

function findSkillFiles() {
  const files = [];
  for (const dir of SKILL_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(abs, entry.name, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        files.push(skillPath);
      }
    }
  }
  return files;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  try {
    const parsed = yaml.load(match[1]);
    if (parsed == null) return { __parseError: "Empty YAML document" };
    return parsed;
  } catch (e) {
    return { __parseError: e.message || "YAML parse error" };
  }
}

function validateMarkdownBody(content) {
  const bodyMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!bodyMatch) return ["No markdown body found after frontmatter."];

  const body = bodyMatch[1];
  const errors = [];

  if (!/^##\s+/m.test(body)) {
    errors.push("Markdown body must contain at least one ## heading.");
  }

  const stripped = body.replace(/```[\s\S]*?```/g, "").trim();
  if (stripped.length < 50) {
    errors.push("Markdown body is too short (< 50 chars excluding code blocks).");
  }

  return errors;
}

function validateCapabilities(frontmatter, rel) {
  const warnings = [];
  const errors = [];

  if (!frontmatter.capabilities) {
    errors.push(`${rel}: Missing capabilities block. All skills must declare capabilities (deny-by-default enforced).`);
    return { warnings, errors };
  }

  const caps = frontmatter.capabilities;

  if (strict) {
    const hasContent = (caps.cli && caps.cli.length > 0)
      || (caps.network && caps.network.egress && caps.network.egress.length > 0)
      || (caps.filesystem && (
        (caps.filesystem.read && caps.filesystem.read.length > 0)
        || (caps.filesystem.write && caps.filesystem.write.length > 0)
        || (caps.filesystem.denied && caps.filesystem.denied.length > 0)))
      || (caps.env && (
        (caps.env.reads && caps.env.reads.length > 0)
        || (caps.env.denied && caps.env.denied.length > 0)));
    if (!hasContent) {
      errors.push(`${rel}: Empty capabilities block (--strict mode requires at least one declared capability).`);
    }
  }

  if (caps.cli && Array.isArray(caps.cli)) {
    for (const entry of caps.cli) {
      if (!entry.binary) {
        errors.push(`${rel}: capabilities.cli entry missing required 'binary' field.`);
      }
      if (!entry.subcommands || entry.subcommands.length === 0) {
        errors.push(`${rel}: capabilities.cli entry for '${entry.binary || "?"}' must declare at least one subcommand.`);
      }
    }
  }

  if (caps.filesystem) {
    const denied = caps.filesystem.denied || [];
    const sensitivePatterns = ["~/.ssh/**", "**/.env*", "~/.claude/**", "~/.cursor/**"];
    const hasSensitiveDenial = sensitivePatterns.some((p) => denied.includes(p));
    if (!hasSensitiveDenial && (caps.filesystem.read || caps.filesystem.write)) {
      warnings.push(`${rel}: capabilities.filesystem declares read/write but no sensitive-path denials. Consider denying ~/.ssh/**, **/.env*, ~/.claude/**, ~/.cursor/**.`);
    }
  }

  return { warnings, errors };
}

const KNOWN_BINARIES = new Set([
  "orderly", "npm", "npx", "yarn", "pnpm", "bun",
  "gh", "git", "curl", "wget", "docker", "node",
  "python3", "python", "pip", "pip3", "ruby", "perl",
]);

function extractCodeBlocks(content) {
  const blocks = [];
  const re = /```[a-zA-Z]*\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

function crossReferenceCapabilities(frontmatter, content, rel) {
  const errors = [];
  const codeBlocks = extractCodeBlocks(content);
  const declaredBinaries = new Map();

  for (const cap of frontmatter.capabilities?.cli ?? []) {
    declaredBinaries.set(cap.binary, new Set(cap.subcommands));
  }

  for (const block of codeBlocks) {
    const lines = block.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    for (const line of lines) {
      const tokens = line.trim().split(/\s+/);
      const binary = tokens[0];
      if (!KNOWN_BINARIES.has(binary)) continue;

      const subcommand = tokens[1];
      if (!subcommand || subcommand.startsWith("-") || subcommand.startsWith("<") || subcommand.startsWith("$")) continue;

      const declaredSubs = declaredBinaries.get(binary);
      if (!declaredSubs) {
        errors.push(`${rel}: body uses binary '${binary}' not declared in capabilities.cli`);
      } else if (!declaredSubs.has(subcommand)) {
        errors.push(`${rel}: body uses '${binary} ${subcommand}' not declared in capabilities.cli.subcommands`);
      }
    }
  }

  return errors;
}

const INTERPRETER_BINARIES = new Set(["python3", "python", "node", "ruby", "perl"]);
const BANNED_INTERPRETER_SUBCOMMANDS = new Set(["-c", "-e", "exec", "eval"]);

function validateInterpreterSubcommands(frontmatter, rel, isPartner) {
  const errors = [];
  const warnings = [];
  for (const entry of frontmatter.capabilities?.cli ?? []) {
    if (!INTERPRETER_BINARIES.has(entry.binary)) continue;
    for (const sub of entry.subcommands ?? []) {
      if (BANNED_INTERPRETER_SUBCOMMANDS.has(sub)) {
        if (isPartner) {
          errors.push(`${rel}: partner skills cannot declare ${entry.binary} ${sub} — use a script file instead`);
        } else {
          warnings.push(`${rel}: ${entry.binary} ${sub} is a privileged capability — requires justification`);
        }
      }
    }
  }
  return { errors, warnings };
}

const BANNED_INSTALL_PATTERNS = [
  /\|\s*(?:bash|sh|zsh)\b/,
  /\bcurl\b.*\|\s*/,
  /\bwget\b.*\|\s*/,
  /\beval\b/,
  /\bgit\s+clone\b/,
  /--unsafe-perm/,
  /\bsudo\b/,
  /\brm\s+-rf?\b/,
  />\s*\/(?:etc|usr|var|tmp)/,
  /process\.env/,
];

const ALLOWED_INSTALL_BINARIES = new Set(["npm", "npx", "yarn", "pnpm", "bun", "pip", "pip3"]);

const ALLOWED_INSTALL_PACKAGES = new Set([
  "@orderly.network/cli",
  "@orderly.network/mcp-server",
]);

function validateInstallPackages(frontmatter, rel, isPartner) {
  const errors = [];
  for (const step of frontmatter.requires?.install ?? []) {
    if (!step.command) continue;
    const match = step.command.match(/(?:npm|yarn|pnpm|bun)\s+(?:install|add|i)\s+(?:-g\s+)?(\S+)/);
    if (match) {
      const pkg = match[1].replace(/@[\d^~<>=.*]+$/, "");
      if (isPartner && !ALLOWED_INSTALL_PACKAGES.has(pkg)) {
        const declared = (frontmatter.capabilities?.cli ?? []).some(
          (c) => (c.allowedPackages ?? []).includes(pkg),
        );
        if (!declared) {
          errors.push(`${rel}: install step references undeclared package '${pkg}' — add to capabilities.cli.allowedPackages or contact core team`);
        }
      }
    }
  }
  return errors;
}

function validateInstallCommands(frontmatter, rel) {
  const errors = [];
  for (const step of frontmatter.requires?.install ?? []) {
    if (!step.command) continue;
    for (const pattern of BANNED_INSTALL_PATTERNS) {
      if (pattern.test(step.command)) {
        errors.push(`${rel}: install command "${step.command}" matches banned pattern: ${pattern}`);
      }
    }
    const binary = step.command.trim().split(/\s+/)[0];
    if (!ALLOWED_INSTALL_BINARIES.has(binary)) {
      errors.push(`${rel}: install command must use a known package manager, got: ${binary}`);
    }
  }
  return errors;
}

function run() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  const files = findSkillFiles();
  if (files.length === 0) {
    console.log("No SKILL.md files found.");
    process.exit(0);
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, "utf8");

    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) {
      console.error(`FAIL  ${rel}: Missing or malformed YAML frontmatter.`);
      totalErrors++;
      continue;
    }
    if (frontmatter.__parseError) {
      console.error(`FAIL  ${rel}: YAML parse error: ${frontmatter.__parseError}`);
      totalErrors++;
      continue;
    }

    const valid = validate(frontmatter);
    if (!valid) {
      for (const err of validate.errors) {
        const location = err.instancePath || "(root)";
        console.error(`FAIL  ${rel}: ${location} ${err.message}`);
      }
      totalErrors += validate.errors.length;
    }

    const bodyErrors = validateMarkdownBody(content);
    for (const msg of bodyErrors) {
      console.error(`FAIL  ${rel}: ${msg}`);
      totalErrors++;
    }

    const { warnings, errors: capErrors } = validateCapabilities(frontmatter, rel);
    for (const msg of capErrors) {
      console.error(`FAIL  ${msg}`);
      totalErrors++;
    }
    for (const msg of warnings) {
      console.warn(`WARN  ${msg}`);
      totalWarnings++;
    }

    const installErrors = validateInstallCommands(frontmatter, rel);
    for (const msg of installErrors) {
      console.error(`FAIL  ${msg}`);
      totalErrors++;
    }

    const packageErrors = validateInstallPackages(frontmatter, rel, rel.replace(/\\/g, "/").startsWith("partner-skills/"));
    for (const msg of packageErrors) {
      console.error(`FAIL  ${msg}`);
      totalErrors++;
    }

    const crossRefErrors = crossReferenceCapabilities(frontmatter, content, rel);
    for (const msg of crossRefErrors) {
      console.warn(`WARN  ${msg}`);
      totalWarnings++;
    }

    const isPartner = rel.replace(/\\/g, "/").startsWith("partner-skills/");
    const interpResult = validateInterpreterSubcommands(frontmatter, rel, isPartner);
    for (const msg of interpResult.errors) {
      console.error(`FAIL  ${msg}`);
      totalErrors++;
    }
    for (const msg of interpResult.warnings) {
      console.warn(`WARN  ${msg}`);
      totalWarnings++;
    }

    if (valid && bodyErrors.length === 0 && capErrors.length === 0
        && installErrors.length === 0 && packageErrors.length === 0
        && interpResult.errors.length === 0) {
      console.log(`PASS  ${rel}`);
    }
  }

  const parts = [`${files.length} file(s) checked`, `${totalErrors} error(s)`];
  if (totalWarnings > 0) parts.push(`${totalWarnings} warning(s)`);
  if (strict) parts.push("(strict mode)");
  console.log(`\n${parts.join(", ")}.`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

run();
