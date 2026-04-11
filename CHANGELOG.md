# Changelog

All notable changes to OtterClaw skills are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/). Each entry includes the skill name, version, and what changed.

## 2026-04-12

### orderly-list-market — 1.0.0
- Initial release: permissionless perpetual market listing via `ListMarketIntent`
- Commands: `market-list`, `market-list-status`, `market-list-oracles`
- Includes oracle config, tick/lot size, margin parameters, listing bond documentation

### orderly-market-seeder — 1.0.0
- Initial release: bootstrap liquidity on freshly-listed markets
- Commands: `market-seed`, `market-seed-status`, `market-seed-cancel`
- Configurable spread, depth curve (linear/exponential), budget, and seed window
- Auto-cancels unfilled orders when seed window expires

### orderly-listing-scout — 1.0.0
- Initial release: discover assets worth listing as new perp markets
- Ships with one signal source: CoinGecko spot volume
- Documents pluggable architecture for future sources (social, funding differentials, correlation gaps)
- Outputs ranked candidates with rationale strings and confidence scores

### Infrastructure
- Added optional `capabilities` field to `schema/skill.schema.json` for capability flags (e.g. `creates-market`)
- Added `listing` tag convention for listing-native skills
- Added Listing Pipeline section to README
- Added `capabilities` documentation to CONTRIBUTING.md
- Fixed regex bug in `validate-skills.js` that prevented the validator from running (unclosed character class in body-matching pattern)

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
