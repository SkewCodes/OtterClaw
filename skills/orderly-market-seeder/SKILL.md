---
name: orderly-market-seeder
description: Bootstrap liquidity on a freshly-listed perpetual market — place a symmetric order grid with configurable spread, depth curve, and seed window. Hands off to downstream MM skills after seeding.
version: 1.0.0
author: OtterClaw
tags: [listing, trading, market-making, defi, orderly]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
---

# Orderly Market Seeder

Bootstrap initial liquidity on a freshly-listed perpetual market. Places a symmetric grid of limit orders around the oracle price with configurable spread, depth curve, and budget. This is explicitly *not* a full market-making loop — it seeds the book and hands off after the seed window.

## Prerequisites

- Active Orderly account (`orderly auth-list` to check)
- USDC balance sufficient for the seeding budget
- Target market must already exist (use `orderly-list-market` to create one)
- If no account, install the `orderly-onboarding` skill first

## Commands

### Seed a Market

```bash
orderly market-seed \
  --symbol PERP_ETH_USDC \
  --budget 5000 \
  --spread 0.002 \
  --levels 10 \
  --depth-curve linear \
  --seed-window 3600 \
  --account <account-id> \
  --network testnet
```

Parameters:

- **--symbol** — Market to seed (e.g. `PERP_ETH_USDC`)
- **--budget** — Total USDC to allocate across both sides of the book
- **--spread** — Target half-spread as a decimal (0.002 = 0.2% from mid)
- **--levels** — Number of price levels per side (default: 10)
- **--depth-curve** — How quantity is distributed across levels: `linear` (equal per level) or `exponential` (more at tighter levels)
- **--seed-window** — Duration in seconds to maintain quotes (default: 3600 = 1 hour)

Expected output:

```json
{
  "success": true,
  "data": {
    "symbol": "PERP_ETH_USDC",
    "bid_orders": 10,
    "ask_orders": 10,
    "total_notional": 4987.50,
    "mid_price": 3500.00,
    "best_bid": 3493.00,
    "best_ask": 3507.00,
    "seed_window_ends": "2026-04-12T01:00:00Z"
  }
}
```

### Check Seed Status

```bash
orderly market-seed-status --symbol PERP_ETH_USDC --account <account-id> --network testnet
```

Expected output:

```json
{
  "success": true,
  "data": {
    "symbol": "PERP_ETH_USDC",
    "status": "active",
    "remaining_seconds": 1800,
    "budget_used": 2450.00,
    "budget_remaining": 2550.00,
    "fills": 3,
    "inventory": {
      "base": 0.15,
      "side": "long"
    }
  }
}
```

### Cancel Seed Early

```bash
orderly market-seed-cancel --symbol PERP_ETH_USDC --account <account-id> --network testnet
# Cancels all outstanding seed orders and reports final inventory state
```

### View Inventory State

```bash
orderly positions-list --account <account-id> --network testnet
# Use orderly-trader to inspect positions accumulated during seeding
```

## Depth Curves

- **linear** — Budget is split equally across all levels. Produces a flat book. Good for markets with unknown demand patterns.
- **exponential** — More budget at tighter levels, less at wider levels. Produces a book with deep liquidity near mid and thin tails. Better for established assets where most volume trades near the mark.

## Workflow Example

```bash
# 1. Check the market exists
orderly market-price PERP_ETH_USDC

# 2. Seed with $5000, 0.2% spread, 10 levels, linear curve, 1-hour window
orderly market-seed \
  --symbol PERP_ETH_USDC \
  --budget 5000 \
  --spread 0.002 \
  --levels 10 \
  --depth-curve linear \
  --seed-window 3600 \
  --account <account-id> \
  --network testnet

# 3. Monitor
orderly market-seed-status --symbol PERP_ETH_USDC --account <account-id> --network testnet

# 4. After seed window ends, check inventory
orderly positions-list --account <account-id> --network testnet
```

## Composition

This skill is one step in the listing pipeline:

```
listing-scout → list-market → market-seeder → (any MM skill)
```

- **Upstream**: `orderly-list-market` creates the market
- **Downstream**: Any MM skill takes over continuous quoting after the seed window

The seeder is composable with any downstream market-making strategy. After the seed window, the agent (or a human) decides whether to hand off to a persistent MM skill or let the book stand on organic flow.

## Important Notes

- Always use `--network testnet` to validate parameters before seeding on mainnet
- The seeder places real orders with real funds — budget is committed immediately
- Inventory risk: fills during seeding create a directional position
- After the seed window expires, all unfilled orders are cancelled automatically
- Use `orderly positions-close` (from `orderly-trader`) to flatten inventory if needed
- All keys stored in OS keychain — never in files, never exposed to AI
