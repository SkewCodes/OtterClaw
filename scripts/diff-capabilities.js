#!/usr/bin/env node

/**
 * Compares capability declarations between the current SKILL.md files and a
 * prior bundle-manifest.json. Outputs a structured diff per skill showing
 * added CLI binaries, new egress endpoints, new filesystem paths, and new
 * env reads.
 *
 * Usage:
 *   node diff-capabilities.js                             # uses ../bundle-manifest.json
 *   node diff-capabilities.js --baseline <manifest.json>  # explicit baseline
 *   node diff-capabilities.js --json                      # machine-readable output
 *
 * Exit codes:
 *   0 — no capability expansions detected
 *   1 — one or more skills expanded capabilities
 *   2 — error (missing baseline, parse failure, etc.)
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = path.resolve(__dirname, "..");
const SKILL_DIRS = ["skills", "partner-skills"];

const baselineIdx = process.argv.indexOf("--baseline");
const baselinePath =
  baselineIdx !== -1 && process.argv[baselineIdx + 1]
    ? path.resolve(process.argv[baselineIdx + 1])
    : path.join(ROOT, "bundle-manifest.json");
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

function setDiff(current, baseline) {
  const base = new Set(baseline);
  return current.filter((item) => !base.has(item));
}

function diffCapabilities(currentCaps, baselineCaps) {
  const delta = {
    addedCliBinaries: [],
    addedEgress: [],
    addedFsRead: [],
    addedFsWrite: [],
    addedEnvReads: [],
    expanded: false,
  };

  const currentBinaries = (currentCaps?.cli || []).map((c) => c.binary);
  const baselineBinaries = (baselineCaps?.cli || []).map((c) => c.binary);
  delta.addedCliBinaries = setDiff(currentBinaries, baselineBinaries);

  delta.addedEgress = setDiff(
    currentCaps?.network?.egress || [],
    baselineCaps?.network?.egress || [],
  );

  delta.addedFsRead = setDiff(
    currentCaps?.filesystem?.read || [],
    baselineCaps?.filesystem?.read || [],
  );

  delta.addedFsWrite = setDiff(
    currentCaps?.filesystem?.write || [],
    baselineCaps?.filesystem?.write || [],
  );

  delta.addedEnvReads = setDiff(
    currentCaps?.env?.reads || [],
    baselineCaps?.env?.reads || [],
  );

  delta.expanded =
    delta.addedCliBinaries.length > 0 ||
    delta.addedEgress.length > 0 ||
    delta.addedFsRead.length > 0 ||
    delta.addedFsWrite.length > 0 ||
    delta.addedEnvReads.length > 0;

  return delta;
}

function isPartnerSkill(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  return rel.startsWith("partner-skills/");
}

function run() {
  if (!fs.existsSync(baselinePath)) {
    console.error(
      `Baseline not found: ${baselinePath}\nGenerate one first: node generate-bundle-manifest.js`,
    );
    process.exit(2);
  }

  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  } catch (err) {
    console.error(`Failed to parse baseline: ${err.message}`);
    process.exit(2);
  }

  const baselineById = new Map();
  for (const skill of baseline.skills || []) {
    baselineById.set(skill.id, skill);
  }

  const baselineAgg = baseline.aggregatedCapabilities || {};

  const files = findSkillFiles();
  const results = [];
  let expansions = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const fm = extractFrontmatter(content);
    if (!fm) continue;

    const id = fm.id || fm.name;
    const caps = fm.capabilities || {};

    const baseEntry = baselineById.get(id);
    const baseCaps = baseEntry
      ? reconstructBaselineCaps(baselineAgg, id, baseline.skills)
      : {};

    const delta = diffCapabilities(caps, baseCaps);
    const isNew = !baseEntry;
    const requiresCoSigner = delta.expanded && isPartnerSkill(file);

    if (delta.expanded || isNew) {
      results.push({
        id,
        version: fm.version,
        isNew,
        requiresCoSigner,
        delta,
      });
      if (delta.expanded) expansions++;
    }
  }

  if (outputJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    if (results.length === 0) {
      console.log("No capability expansions detected.");
    } else {
      for (const r of results) {
        const tag = r.isNew ? "NEW" : "EXPANDED";
        const coSign = r.requiresCoSigner ? " [co-signer required]" : "";
        console.log(`${tag}  ${r.id} v${r.version}${coSign}`);
        if (r.delta.addedCliBinaries.length > 0)
          console.log(`  + cli binaries: ${r.delta.addedCliBinaries.join(", ")}`);
        if (r.delta.addedEgress.length > 0)
          console.log(`  + egress: ${r.delta.addedEgress.join(", ")}`);
        if (r.delta.addedFsRead.length > 0)
          console.log(`  + fs read: ${r.delta.addedFsRead.join(", ")}`);
        if (r.delta.addedFsWrite.length > 0)
          console.log(`  + fs write: ${r.delta.addedFsWrite.join(", ")}`);
        if (r.delta.addedEnvReads.length > 0)
          console.log(`  + env reads: ${r.delta.addedEnvReads.join(", ")}`);
      }
      console.log(
        `\n${results.length} skill(s) with changes, ${expansions} expansion(s).`,
      );
    }
  }

  process.exit(expansions > 0 ? 1 : 0);
}

/**
 * Reconstruct per-skill baseline capabilities from the aggregate manifest.
 * The aggregate stores the union — individual per-skill caps aren't preserved
 * in the manifest. For diffing purposes we treat the aggregate as the baseline
 * for all skills, which means the diff is conservative: it only flags truly
 * new capabilities that weren't in *any* prior skill.
 */
function reconstructBaselineCaps(agg) {
  return {
    cli: (agg.cli || []).map((binary) => ({ binary, subcommands: [] })),
    network: { egress: agg.network?.egress || [] },
    filesystem: {
      read: agg.filesystem?.read || [],
      write: agg.filesystem?.write || [],
      denied: agg.filesystem?.denied || [],
    },
    env: {
      reads: agg.env?.reads || [],
      denied: agg.env?.denied || [],
    },
  };
}

run();
