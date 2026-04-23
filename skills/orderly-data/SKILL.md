---
id: orderly-data
name: orderly-data
description: Get real-time market data from Orderly Network — prices, orderbooks, funding rates, klines, symbols, recent trades. No authentication required for public data.
version: 1.2.0
publisher: "@orderly-network"
hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
previousVersion: 1.1.0
author: OtterClaw
tags: [data, market, defi, orderly]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
capabilities:
  cli:
    - binary: orderly
      subcommands: [market-price, market-orderbook, market-trades, funding-rates, symbols, kline]
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

# Orderly Market Data

Real-time market data from Orderly Network's omnichain orderbook.

## Public Commands (No Auth Required)

These commands work without an Orderly account or `--account` flag.

### Price

```bash
orderly market-price PERP_ETH_USDC
# Returns: symbol, index_price, mark_price, last_price, 24h_change, 24h_volume
```

### Orderbook

```bash
orderly market-orderbook PERP_ETH_USDC
# Returns: bids and asks with price and quantity
```

### Recent Trades

```bash
orderly market-trades PERP_ETH_USDC --limit 20
```

### Funding Rates

```bash
orderly funding-rates
# Returns: all symbols with last, 1d, 7d, 30d, 90d, 180d rates
```

### Available Symbols

```bash
orderly symbols
orderly symbols --csv  # tabular format
```

## Authenticated Commands (Requires `--account`)

These commands require an Orderly account. If the user hasn't set up an account yet, install the `orderly-onboarding` skill first.

### Kline (OHLC)

```bash
orderly kline PERP_ETH_USDC 1h --limit 100 --account <account-id>
# Intervals: 1m, 5m, 15m, 30m, 1h, 4h, 12h, 1d, 1w, 1mon, 1y
```

## Auth Summary

| Command | Auth Required |
|---------|--------------|
| `market-price` | No |
| `market-orderbook` | No |
| `market-trades` | No |
| `funding-rates` | No |
| `symbols` | No |
| `kline` | Yes (`--account`) |

## Tips

- Use `--csv` for lists (more token-efficient)
- Funding rates update every hour
- Symbol names are UPPERCASE: `PERP_ETH_USDC` not `PERP_ETH_usdc`
- Public commands are useful for market scanning without onboarding
