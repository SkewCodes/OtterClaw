---
name: orderly-trader
description: Trade perpetual futures on Orderly Network — place orders, manage positions, set leverage, execute algo orders (TP/SL, trailing stop, bracket). Uses the Orderly CLI with OS keychain security.
version: 1.0.0
author: OtterClaw
tags: [trading, perps, defi, orderly]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
---

# Orderly Trader

You can trade perpetual futures on Orderly Network using the `orderly` CLI. Keys are stored in the OS keychain and never exposed to you.

## Setup (one time)

If the user hasn't set up an Orderly account yet, install the `orderly-onboarding` skill first.

## Trading Commands

### Place Orders

```bash
# Market order
orderly order-place PERP_ETH_USDC BUY MARKET 0.01 --account <account-id> --network mainnet

# Limit order
orderly order-place PERP_ETH_USDC BUY LIMIT 0.01 --price 3500 --account <account-id> --network mainnet

# With custom client order ID
orderly order-place PERP_ETH_USDC BUY MARKET 0.01 --client-order-id my-123 --account <account-id>
```

### Order Types
- `MARKET` — immediate fill at best price
- `LIMIT` — fill at specified price or better
- `IOC` — immediate or cancel
- `FOK` — fill or kill (all or nothing)
- `POST_ONLY` — maker only, rejected if would take

### Algo Orders (TP/SL)

```bash
# Stop loss
orderly algo-order-place PERP_ETH_USDC SELL STOP 0.01 --trigger-price 2000 --account <account-id>

# Take profit + stop loss
orderly algo-order-place PERP_ETH_USDC SELL TP_SL 0.01 --tp-trigger-price 2500 --sl-trigger-price 1500 --account <account-id>

# Trailing stop
orderly algo-order-place PERP_ETH_USDC SELL TRAILING_STOP 0.01 --trigger-price 2400 --callback-rate 0.02 --account <account-id>
```

### Manage Positions

```bash
# List all open positions
orderly positions-list --account <account-id>

# Close a position
orderly positions-close PERP_ETH_USDC --account <account-id>

# Set leverage
orderly leverage PERP_ETH_USDC 10 --account <account-id>
```

### Manage Orders

```bash
# List open orders
orderly order-list --status NEW --account <account-id>

# Cancel specific order
orderly order-cancel <order-id> --symbol PERP_ETH_USDC --account <account-id>

# Cancel all
orderly order-cancel-all --symbol PERP_ETH_USDC --account <account-id>

# Edit order (only specify what changes)
orderly order-edit <order-id> --price 3600 --account <account-id>
```

### Check Trades

```bash
orderly trades --account <account-id>
```

## Output Format

Default is compact JSON (optimal for parsing). Use `--csv` for tabular data.

## Important Notes

- Symbol names are UPPERCASE: `PERP_ETH_USDC` not `PERP_ETH_usdc`
- `--account` is always required (use `orderly auth-list` to get account IDs)
- Hex account IDs must be quoted: `--account "0x5a6b..."`
- All keys stored in OS keychain — never in files, never exposed to AI
