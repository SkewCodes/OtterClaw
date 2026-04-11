#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv = require("ajv");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(ROOT, "schema", "skill.schema.json");
const SKILL_DIRS = ["skills", "partner-skills"];

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
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return yaml.load(match[1]);
}

function validateMarkdownBody(content) {
  const bodyMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
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

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, "utf8");

    const frontmatter = extractFrontmatter(content);
    if (!frontmatter) {
      console.error(`FAIL  ${rel}: Missing or malformed YAML frontmatter.`);
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

    if (valid && bodyErrors.length === 0) {
      console.log(`PASS  ${rel}`);
    }
  }

  console.log(`\n${files.length} file(s) checked, ${totalErrors} error(s).`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

run();
