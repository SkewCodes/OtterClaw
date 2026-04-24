# Contributing to OtterClaw

Publish a skill for the Orderly ecosystem. Gate it with 402 to earn revenue.

## How to Submit a Skill

1. **Fork** this repo
2. **Create** your skill directory: `partner-skills/your-skill-name/SKILL.md`
3. **Use a template** as your starting point:
   - [SKILL_TEMPLATE.md](SKILL_TEMPLATE.md) — free/open skills
   - [SKILL_TEMPLATE_402.md](SKILL_TEMPLATE_402.md) — premium 402-gated skills
4. **Open a PR** against `main`

## SKILL.md Requirements

Every skill must have:

### YAML Frontmatter

```yaml
---
id: your-skill-name            # globally unique skill identifier
name: your-skill-name          # lowercase, hyphenated
description: What it does       # one sentence, be specific
version: 1.0.0                 # semver
publisher: "@your-org"         # publisher identity for attestation
hash: "sha256:..."             # SHA-256 content hash (computed at bundle time)
previousVersion: 0.9.0         # version this release supersedes (omit for first release)
author: Your Name              # name or handle
tags: [relevant, tags]         # lowercase
requires:
  bins: [orderly]              # required CLI tools
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
capabilities:
  cli:
    - binary: orderly
      subcommands: [your-command, another-command]
  network:
    egress:
      - "api.orderly.org"
  filesystem:
    denied:
      - "~/.ssh/**"
      - "**/.env*"
      - "~/.claude/**"
      - "~/.cursor/**"
  env:
    denied:
      - "AWS_*"
      - "AZURE_*"
---
```

### Markdown Body

- **Description** — what the skill does and why an agent would use it
- **Prerequisites** — what the user needs before using this skill
- **Commands** — explicit CLI commands with parameters and examples
- **Output format** — what the agent should expect back
- **Important notes** — edge cases, gotchas, security considerations

## Capability Manifest

Every skill must declare a structured `capabilities` block in the frontmatter. This manifest tells the runtime and SecClaw exactly what the skill is allowed to do. Undeclared access is blocked at runtime and triggers a security alert.

### `cli` — Declared CLI Invocations

Every call to `runtime.exec()` must match a declared `cli` entry. List every binary and the subcommands your skill uses:

```yaml
capabilities:
  cli:
    - binary: orderly
      subcommands: [order-place, position-list]
    - binary: npm
      subcommands: [install, run]
      allowedPackages:
        - "@orderly/sdk@^2.0.0"
```

For package managers (`npm`, `yarn`, `pnpm`, `bun`), the runtime forwards the call to SecClaw's DependencyAttestor for additional verification. Use `allowedPackages` to declare which packages may be installed. For API CLIs like `gh`, use `allowedRoutes` to declare permitted API route patterns. (`allowedRoutes` enforcement is Tier 2 — declare them now for forward compatibility; runtime enforcement ships with the first cohort.)

### `network` — Outbound Network Access

Declare every hostname your skill contacts:

```yaml
capabilities:
  network:
    egress:
      - "api.orderly.org"
      - "api.coingecko.com"
```

### `filesystem` — File Access

Declare read/write paths using glob patterns. Always deny sensitive paths:

```yaml
capabilities:
  filesystem:
    read:
      - "./config/*"
    write:
      - "./out/*"
    denied:
      - "~/.ssh/**"
      - "**/.env*"
      - "~/.claude/**"
      - "~/.cursor/**"
```

### `env` — Environment Variable Access

Declare which env vars your skill reads. Deny cloud credential patterns:

```yaml
capabilities:
  env:
    reads: [ORDERLY_API_KEY]
    denied:
      - "AWS_*"
      - "AZURE_*"
```

### Deny-by-Default (Enforced)

- Skills without a `capabilities` block **fail to load at runtime** and **fail validation**. There is no grace period.
- All ten internal skills have been migrated. New skills must ship with a `capabilities` block from day one.
- The `--strict` flag on the validator is still accepted but no longer changes behavior — missing capabilities is always an error.

### No Direct `child_process` Imports

Skills must never import `child_process` (or `node:child_process`) directly. All CLI invocation goes through `runtime.exec()`, which enforces capability checks and reports to SecClaw.

An ESLint rule (`otterclaw/no-direct-child-process`) enforces this for any `.js`/`.ts` files under `skills/` or `partner-skills/`. Code blocks inside `SKILL.md` are covered by `audit-capabilities.js`.

Run lint locally:

```bash
npm run lint
```

### Privileged Capability Tags

If your skill performs a privileged action (e.g. creating a new on-chain market), add the appropriate flag as a tag for discoverability:

| Tag | Meaning |
|-----|---------|
| `creates-market` | Skill can create a new perpetual market on Orderly Network |

## 402-Gated Skills

To earn revenue from your skill, add a `payment` block to the frontmatter:

```yaml
payment:
  scheme: orderly-ledger
  price: "0.01"
  currency: USDC
  per: request
  recipient: "<your-orderly-account-id>"
```

See [SKILL_TEMPLATE_402.md](SKILL_TEMPLATE_402.md) for the full template.

## Versioning

Every skill uses [semantic versioning](https://semver.org/). When modifying a skill, bump the `version` field in the YAML frontmatter:

- **Patch** (1.0.x) — typo fixes, wording clarifications, formatting changes
- **Minor** (1.x.0) — new commands, new parameters, added sections
- **Major** (x.0.0) — breaking changes to command syntax, removed commands, renamed fields

PRs that modify a `SKILL.md` file **must** bump the version. The CI pipeline checks this automatically and will fail if the version is unchanged.

After bumping, add an entry to [CHANGELOG.md](CHANGELOG.md) with the skill name, new version, and a summary of changes.

## Guidelines

- **Be explicit** — agents read your SKILL.md literally. Show exact commands, not pseudocode.
- **Be complete** — include every parameter, flag, and expected output format.
- **Be safe** — never instruct agents to handle private keys directly. Use OS keychain via CLI.
- **Be honest** — describe what your skill actually does. Agents that use bad skills stop using them.
- **Test it** — verify your skill works with a local agent before submitting.

## Module Systems

The root package (`src/`) uses ESM (`"type": "module"` in the root `package.json`). The `scripts/` directory uses CommonJS (`"type": "commonjs"` in `scripts/package.json`). Do not use `import` syntax in files under `scripts/`; use `require()` instead.

## Validation

All SKILL.md files are validated automatically on pull requests:

- **Schema check** — YAML frontmatter is validated against `schema/skill.schema.json`
- **Capability check** — structured `capabilities` block is required (missing = error)
- **Body check** — markdown body must contain at least one `##` heading and meaningful content
- **Version check** — modified skills must have a bumped `version` field
- **Lint** — ESLint checks for banned `child_process` imports in skill code
- **Bundle manifest** — generated and uploaded as a CI artifact

Run validation locally before submitting:

```bash
cd scripts
npm install
node validate-skills.js
```

To run in strict mode (rejects skills without `capabilities`):

```bash
node validate-skills.js --strict
```

(Both commands above assume you are already in the `scripts/` directory.)

To audit what capabilities your skill needs based on its command blocks:

```bash
cd scripts
node audit-capabilities.js
```

## Bundle Manifest

At release time, a bundle manifest aggregating all skills, their content hashes, and the union of capabilities is generated:

```bash
cd scripts
node generate-bundle-manifest.js
```

This writes `bundle-manifest.json` to the repo root (gitignored — it is a build artifact). SecClaw's DependencyAttestor can verify bundle manifests at deploy time.

## Capability Change Detection

To detect capability expansions between the current skills and a prior baseline:

```bash
cd scripts
node diff-capabilities.js
```

This compares current `SKILL.md` capabilities against the most recent `bundle-manifest.json`. It flags added CLI binaries, new egress endpoints, new filesystem paths, and new env reads. Partner skills with expanded capabilities are marked as requiring a co-signer.

Use `--baseline <path>` to compare against a specific manifest, or `--json` for machine-readable output.

## What Happens After You Submit

- Your PR is validated by CI (schema, body, capability audit, lint, TypeScript typecheck, bundle manifest, version bump)
- If the file is valid and pricing is declared (for 402 skills), it gets merged
- Your skill appears in the OtterClaw directory
- No approval committee. The market decides what's good.

## Questions?

Open an issue in this repo.
