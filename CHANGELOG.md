# Changelog

All notable changes to OtterClaw skills are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Each entry includes the skill name, version, and what changed.

## 2026-03-20

### orderly-vault — 1.1.0
- Added CLI commands section (vault-info, vault-balance, vault-history)
- Separated CLI-executable actions from web-UI-only operations
- Added auth summary and first-time approval guidance

### orderly-dex-builder — 1.1.0
- Added "What Agents Can Do" section separating automatable vs user-interactive actions
- Expanded API Access with concrete curl examples (broker info, theme, SEO, verify-tx)
- Added agent workflow example for post-creation configuration
- Expanded MCP Integration with available tools and workflow steps

### orderly-data — 1.1.0
- Separated commands into "Public (No Auth)" and "Authenticated (Requires --account)" sections
- Added auth summary table clarifying which commands need authentication
- Fixed inconsistency between "no auth needed" claim and kline requiring --account

### Infrastructure
- Added `partner-skills/README.md` with contributor guidance
- Added `schema/skill.schema.json` — formal JSON Schema for SKILL.md frontmatter
- Added `scripts/validate-skills.js` — Node.js validation script (js-yaml + ajv)
- Added `.github/workflows/validate-skills.yml` — CI pipeline for PR validation and version bump checks
- Added versioning conventions to `CONTRIBUTING.md`

## 2026-03-01

### Initial Release — 1.0.0
- orderly-onboarding: Account setup, key generation, wallet connection
- orderly-trader: Perps trading, orders, positions, leverage, algo orders
- orderly-data: Market data — prices, orderbooks, funding rates, klines, symbols
- orderly-swap: On-chain token swaps across EVM chains
- orderly-vault: OmniVault yield on USDC
- orderly-402: 402 micropayments for premium skills
- orderly-dex-builder: Launch a DEX via Orderly ONE
