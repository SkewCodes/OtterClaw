---
name: orderly-list-market
description: List a new perpetual futures market on Orderly Network — submit a ListMarketIntent with base asset, oracle config, and initial parameters. Returns market ID and listing tx reference.
version: 1.0.0
author: OtterClaw
tags: [listing, trading, perps, defi, orderly, creates-market]
capabilities: [creates-market]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
---

# Orderly List Market

List a new perpetual futures market on Orderly Network via permissionless listing. This skill wraps the `ListMarketIntent` flow — you supply the base asset, oracle configuration, and initial market parameters; the CLI submits the listing transaction and returns the new market ID.

This is the primitive. No policy logic (that lives in SecClaw). No market-making logic (that's `orderly-market-seeder`).

## Prerequisites

- Active Orderly account (`orderly auth-list` to check)
- Sufficient USDC collateral for the listing bond
- If no account, install the `orderly-onboarding` skill first

## Commands

### List a New Market

```bash
orderly market-list \
  --base-asset ETH \
  --oracle pyth \
  --oracle-id "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" \
  --tick-size 0.01 \
  --lot-size 0.001 \
  --min-notional 10 \
  --initial-margin-ratio 0.05 \
  --maintenance-margin-ratio 0.03 \
  --account <account-id> \
  --network testnet
```

Parameters:

- **--base-asset** — Token symbol for the base asset (e.g. ETH, SOL, ARB)
- **--oracle** — Oracle provider (`pyth` or `chainlink`)
- **--oracle-id** — Price feed ID from the oracle provider
- **--tick-size** — Minimum price increment (e.g. 0.01 for $0.01 ticks)
- **--lot-size** — Minimum quantity increment (e.g. 0.001)
- **--min-notional** — Minimum order notional value in USDC
- **--initial-margin-ratio** — Required initial margin as a decimal (0.05 = 5%)
- **--maintenance-margin-ratio** — Required maintenance margin as a decimal (0.03 = 3%)

Expected output:

```json
{
  "success": true,
  "data": {
    "market_id": "PERP_ETH_USDC",
    "listing_tx": "0xabc123...def456",
    "status": "pending",
    "bond_amount": "1000.00",
    "bond_currency": "USDC"
  }
}
```

### Check Listing Status

```bash
orderly market-list-status --market-id PERP_ETH_USDC --account <account-id> --network testnet
```

Expected output:

```json
{
  "success": true,
  "data": {
    "market_id": "PERP_ETH_USDC",
    "status": "active",
    "listed_at": "2026-04-12T00:00:00Z",
    "bond_status": "locked"
  }
}
```

### List Available Oracles

```bash
orderly market-list-oracles --network testnet
# Returns: supported oracle providers and their available price feed IDs
```

## Listing Bond

Permissionless listing requires a USDC bond that is locked for the lifetime of the market. The bond amount depends on the network and is returned in the listing response. If the market is delisted (governance action), the bond is returned to the lister.

## Composition

This skill is one step in the listing pipeline:

```
listing-scout → list-market → market-seeder → (any MM skill)
```

- **Upstream**: `orderly-listing-scout` finds candidate assets
- **Downstream**: `orderly-market-seeder` bootstraps initial liquidity on the new market

Each skill is independently useful. You can use `list-market` on its own if you already know what asset to list.

## Important Notes

- Always use `--network testnet` first to validate parameters before listing on mainnet
- The `creates-market` capability flag means this skill triggers elevated-tier signing by default
- Oracle ID must be a valid price feed from the specified oracle provider
- Market symbol is auto-generated as `PERP_<BASE>_USDC`
- Listing is permissionless — no approval required, but the bond is non-trivial
- All keys stored in OS keychain — never in files, never exposed to AI
