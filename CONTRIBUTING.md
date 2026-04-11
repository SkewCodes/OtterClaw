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
name: your-skill-name          # lowercase, hyphenated
description: What it does       # one sentence, be specific
version: 1.0.0                 # semver
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
---
```

### Markdown Body

- **Description** — what the skill does and why an agent would use it
- **Prerequisites** — what the user needs before using this skill
- **Commands** — explicit CLI commands with parameters and examples
- **Output format** — what the agent should expect back
- **Important notes** — edge cases, gotchas, security considerations

## Capability Flags

If your skill performs a privileged action (e.g. creating a new on-chain market), declare it with a `capabilities` array in the frontmatter:

```yaml
capabilities: [creates-market]
```

Capability flags are distinct from tags. Tags are for discoverability; capabilities affect agent behavior (elevated-tier signing, user confirmation prompts, etc.). Current flags:

| Flag | Meaning |
|------|---------|
| `creates-market` | Skill can create a new perpetual market on Orderly Network |

Also add the flag as a tag so it surfaces in searches.

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

## Validation

All SKILL.md files are validated automatically on pull requests:

- **Schema check** — YAML frontmatter is validated against `schema/skill.schema.json`
- **Body check** — markdown body must contain at least one `##` heading and meaningful content
- **Version check** — modified skills must have a bumped `version` field

Run validation locally before submitting:

```bash
cd scripts
npm install
node validate-skills.js
```

## What Happens After You Submit

- Your PR is validated by CI (schema, body, version bump)
- If the file is valid and pricing is declared (for 402 skills), it gets merged
- Your skill appears in the OtterClaw directory
- No approval committee. The market decides what's good.

## Questions?

Open an issue in this repo.
