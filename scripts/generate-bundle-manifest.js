#!/usr/bin/env node

/**
 * Generates bundle-manifest.json — an aggregate attestation manifest of all
 * skills, their content hashes, and the union of declared capabilities.
 *
 * Usage: node generate-bundle-manifest.js [--out <path>]
 *
 * Default output: ../bundle-manifest.json (repo root)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..");
const SKILL_DIRS = ["skills", "partner-skills"];

const outFlagIdx = process.argv.indexOf("--out");
const outPath =
  outFlagIdx !== -1 && process.argv[outFlagIdx + 1]
    ? path.resolve(process.argv[outFlagIdx + 1])
    : path.join(ROOT, "bundle-manifest.json");

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
    return yaml.load(match[1]);
  } catch {
    return null;
  }
}

function hashContent(content) {
  return "sha256:" + crypto.createHash("sha256").update(content).digest("hex");
}

function addToSet(set, items) {
  if (!Array.isArray(items)) return;
  for (const item of items) set.add(item);
}

function run() {
  const files = findSkillFiles();
  if (files.length === 0) {
    console.error("No SKILL.md files found.");
    process.exit(1);
  }

  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  );

  const skills = [];

  const aggCli = new Set();
  const aggEgress = new Set();
  const aggFsRead = new Set();
  const aggFsWrite = new Set();
  const aggFsDenied = new Set();
  const aggEnvReads = new Set();
  const aggEnvDenied = new Set();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const fm = extractFrontmatter(content);
    if (!fm) {
      console.warn(`SKIP  ${path.relative(ROOT, file)}: no valid frontmatter`);
      continue;
    }

    const skillEntry = {
      id: fm.id || fm.name,
      version: fm.version || "0.0.0",
      hash: hashContent(content),
      previousHash: fm.previousVersion || null,
      capabilities: fm.capabilities || null,
    };
    skills.push(skillEntry);

    const caps = fm.capabilities;
    if (!caps) continue;

    if (Array.isArray(caps.cli)) {
      for (const entry of caps.cli) {
        if (entry.binary) aggCli.add(entry.binary);
      }
    }
    addToSet(aggEgress, caps.network?.egress);
    addToSet(aggFsRead, caps.filesystem?.read);
    addToSet(aggFsWrite, caps.filesystem?.write);
    addToSet(aggFsDenied, caps.filesystem?.denied);
    addToSet(aggEnvReads, caps.env?.reads);
    addToSet(aggEnvDenied, caps.env?.denied);
  }

  const now = new Date();
  const bundleId = `orderly-core-${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;

  const manifest = {
    bundleId,
    version: rootPkg.version,
    publishedAt: now.toISOString(),
    publisher: "@orderly-network",
    skills: skills.sort((a, b) => a.id.localeCompare(b.id)),
    aggregatedCapabilities: {
      cli: [...aggCli].sort(),
      network: { egress: [...aggEgress].sort() },
      filesystem: {
        read: [...aggFsRead].sort(),
        write: [...aggFsWrite].sort(),
        denied: [...aggFsDenied].sort(),
      },
      env: {
        reads: [...aggEnvReads].sort(),
        denied: [...aggEnvDenied].sort(),
      },
    },
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(outPath, manifestJson + "\n");
  console.log(`Bundle manifest written to ${outPath}`);
  console.log(`  ${skills.length} skill(s), bundle ${bundleId} v${rootPkg.version}`);

  const signingKey = process.env.OTTERCLAW_SIGNING_KEY;
  if (signingKey) {
    const hmac = crypto.createHmac("sha256", signingKey).update(manifestJson).digest("hex");
    fs.writeFileSync(outPath + ".sig", hmac + "\n");
    console.log(`  Signature written to ${outPath}.sig`);
  }
}

run();
