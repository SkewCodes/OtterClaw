#!/usr/bin/env node

/**
 * Scans every SKILL.md for CLI binaries, network endpoints, file paths, and
 * env vars referenced in command blocks. Outputs a proposed `capabilities`
 * block per skill as YAML.
 *
 * Usage: node audit-capabilities.js [--json]
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..");
const SKILL_DIRS = ["skills", "partner-skills"];
const outputJson = process.argv.includes("--json");

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

function extractCodeBlocks(content) {
  const blocks = [];
  const re = /```[a-zA-Z]*\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

const KNOWN_BINARIES = new Set([
  "orderly", "npm", "npx", "yarn", "pnpm", "bun",
  "gh", "git", "curl", "wget", "docker", "node",
]);

function extractBinaries(codeBlocks) {
  const bins = new Map();

  for (const block of codeBlocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      const tokens = line.split(/\s+/);
      const binary = tokens[0];
      if (!binary || !KNOWN_BINARIES.has(binary)) continue;

      if (!bins.has(binary)) bins.set(binary, new Set());

      const sub = tokens[1];
      if (sub && !sub.startsWith("-") && !sub.startsWith("<") && !sub.startsWith("$")) {
        bins.get(binary).add(sub);
      }
    }
  }

  return bins;
}

function extractUrls(content) {
  const hostnames = new Set();
  const urlRe = /https?:\/\/[^\s"')>]+/g;
  let m;
  while ((m = urlRe.exec(content)) !== null) {
    try {
      hostnames.add(new URL(m[0]).hostname.toLowerCase());
    } catch {
      // skip malformed URLs
    }
  }
  return hostnames;
}

function extractEnvVars(content) {
  const vars = new Set();
  const envRe = /\$\{?([A-Z][A-Z0-9_]+)\}?/g;
  let m;
  while ((m = envRe.exec(content)) !== null) {
    vars.add(m[1]);
  }
  const flagRe = /--env\s+([A-Z][A-Z0-9_]+)/g;
  while ((m = flagRe.exec(content)) !== null) {
    vars.add(m[1]);
  }
  return vars;
}

function extractFilePaths(content) {
  const paths = new Set();
  const pathRe = /(?:^|\s)(\.\/[a-zA-Z0-9_./-]+|~\/[a-zA-Z0-9_./-]+)/gm;
  let m;
  while ((m = pathRe.exec(content)) !== null) {
    paths.add(m[1].trim());
  }
  return paths;
}

function buildProposal(content) {
  const codeBlocks = extractCodeBlocks(content);
  const bins = extractBinaries(codeBlocks);
  const hostnames = extractUrls(content);
  const envVars = extractEnvVars(content);
  const filePaths = extractFilePaths(content);

  const proposal = {};

  if (bins.size > 0) {
    proposal.cli = [];
    for (const [binary, subcommands] of bins) {
      const subs = [...subcommands].sort();
      if (subs.length === 0) {
        console.warn(`  WARN: binary '${binary}' found but no subcommands detected — review manually.`);
        continue;
      }
      proposal.cli.push({ binary, subcommands: subs });
    }
  }

  const RESERVED = ["example.com", "example.org", "example.net", "localhost"];
  const filteredHosts = [...hostnames].filter(
    (h) => !RESERVED.some((r) => h === r || h.endsWith("." + r)),
  );
  if (filteredHosts.length > 0) {
    proposal.network = { egress: filteredHosts.sort() };
  }

  if (filePaths.size > 0) {
    proposal.filesystem = {
      read: [...filePaths].sort(),
      write: [],
      denied: ["~/.ssh/**", "**/.env*", "~/.claude/**", "~/.cursor/**"],
    };
  }

  if (envVars.size > 0) {
    proposal.env = {
      reads: [...envVars].sort(),
      denied: ["AWS_*", "AZURE_*"],
    };
  }

  return proposal;
}

function run() {
  const files = findSkillFiles();
  if (files.length === 0) {
    console.log("No SKILL.md files found.");
    process.exit(0);
  }

  const results = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, "utf8");
    const fm = extractFrontmatter(content);
    const name = fm?.name || path.basename(path.dirname(file));
    const proposal = buildProposal(content);

    results.push({ skill: name, file: rel, proposal });

    if (!outputJson) {
      console.log(`--- ${name} (${rel}) ---`);
      if (Object.keys(proposal).length === 0) {
        console.log("  (no CLI/network/fs/env references detected)\n");
      } else {
        console.log(yaml.dump({ capabilities: proposal }, { indent: 2, lineWidth: 120 }));
      }
    }
  }

  if (outputJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`${files.length} skill(s) audited.`);
  }
}

run();
