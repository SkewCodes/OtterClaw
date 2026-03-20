# OtterClaw

Orderly Network skills for AI agents. One link. Paste it to your agent. Trade Orderly.

## How It Works

1. Pick a skill from the directory below
2. Send the SKILL.md link to your OpenClaw, SeekerClaw, or Starchild agent
3. Your agent reads it, installs what it needs, and gains the ability

```
"Install this skill: https://otterclaw.xyz/skills/orderly-trader.md"
```

That's it. Your agent can now trade perps on Orderly Network.

## Skills Directory

| Skill | Description | Version |
|-------|-------------|---------|
| [orderly-onboarding](skills/orderly-onboarding/SKILL.md) | Set up an Orderly Network account — create keys, configure auth | 1.0.0 |
| [orderly-trader](skills/orderly-trader/SKILL.md) | Trade perpetual futures — orders, positions, leverage, algo orders | 1.0.0 |
| [orderly-data](skills/orderly-data/SKILL.md) | Market data — prices, orderbooks, funding rates, klines | 1.1.0 |
| [orderly-swap](skills/orderly-swap/SKILL.md) | On-chain token swaps across supported EVM chains | 1.0.0 |
| [orderly-vault](skills/orderly-vault/SKILL.md) | OmniVault — deposit USDC, earn yield from market-making | 1.1.0 |
| [orderly-402](skills/orderly-402/SKILL.md) | 402 payments — pay for premium skills and services | 1.0.0 |
| [orderly-dex-builder](skills/orderly-dex-builder/SKILL.md) | Launch a perps DEX in minutes via Orderly ONE | 1.1.0 |

## Architecture

```
otterclaw/
├── .github/
│   └── workflows/
│       └── validate-skills.yml    # CI — schema + version bump checks on PRs
├── schema/
│   └── skill.schema.json          # Formal JSON Schema for SKILL.md frontmatter
├── scripts/
│   ├── package.json               # Validator dependencies (ajv, js-yaml)
│   └── validate-skills.js         # Validates all SKILL.md files
├── skills/                        # Core Orderly skills
│   ├── orderly-onboarding/        # Account setup
│   ├── orderly-trader/            # Perps trading
│   ├── orderly-data/              # Market data
│   ├── orderly-swap/              # Token swaps
│   ├── orderly-vault/             # OmniVault yield
│   ├── orderly-402/               # 402 payments
│   └── orderly-dex-builder/       # Launch a DEX via Orderly ONE
├── partner-skills/                # Third-party builder skills
├── CHANGELOG.md                   # Version history for all skills
├── CONTRIBUTING.md                # How to submit a skill
├── SKILL_TEMPLATE.md              # Template for new skills
└── SKILL_TEMPLATE_402.md          # Template for 402-gated skills
```

No server. No database. No auth. GitHub is the backend. Skills are files. Builders submit PRs.

## What This Wraps

```
┌─────────────────────────────────────────────────────┐
│                     OTTERCLAW                       │
│               Skills + GitHub Repo                  │
│                                                     │
│  SKILL.md files that wrap:                          │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────────┐    │
│  │ @orderly.network │  │ @orderly.network/    │    │
│  │ /cli (execution) │  │ mcp-server (docs)    │    │
│  └────────┬─────────┘  └──────────┬───────────┘    │
│           │                       │                  │
│  ┌────────┴───────────────────────┴──────────┐      │
│  │  Orderly Network Infrastructure           │      │
│  │  (Omnichain orderbook, 140+ assets,       │      │
│  │   17+ chains, sub-200ms latency)          │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

## Build Your Own Skill

Want to publish a skill for the Orderly ecosystem? Gate it with 402 to earn revenue.

1. Copy [SKILL_TEMPLATE.md](SKILL_TEMPLATE.md) (or [SKILL_TEMPLATE_402.md](SKILL_TEMPLATE_402.md) for premium skills)
2. Add your skill to `partner-skills/your-skill-name/SKILL.md`
3. Open a PR — see [CONTRIBUTING.md](CONTRIBUTING.md) for details

All PRs are validated automatically by CI (schema check, body check, version bump check).

## Validation

Run the skill validator locally:

```bash
cd scripts
npm install
node validate-skills.js
```

Skills are validated against a [formal JSON Schema](schema/skill.schema.json). See [CONTRIBUTING.md](CONTRIBUTING.md) for versioning conventions and the full submission guide.

## Distribution

Skills install into any agent that reads SKILL.md files:

- **OpenClaw** — 247K+ GitHub stars ecosystem
- **SeekerClaw** — Solana mobile agent
- **Starchild** — WOO Network agent platform
- **ClawHub** — OpenClaw's official skill registry (5,400+ skills)

## License

MIT
