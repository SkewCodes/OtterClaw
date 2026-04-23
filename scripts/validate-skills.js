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

    if (valid && bodyErrors.length === 0 && capErrors.length === 0) {
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
