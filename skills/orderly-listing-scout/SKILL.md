---
name: orderly-listing-scout
description: Discover assets worth listing as new perpetual markets on Orderly Network — rank candidates by spot volume, with pluggable signal sources for social sentiment, funding differentials, and correlation gaps.
version: 1.0.0
author: OtterClaw
tags: [listing, data, discovery, defi, orderly]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
---

# Orderly Listing Scout

Find assets worth listing as new perpetual markets on Orderly Network. Compares existing Orderly markets against external spot volume data to surface unlisted tokens with high trading demand. Outputs a ranked candidate list with rationale strings — no execution, pure discovery.

## Prerequisites

- Active Orderly account is optional (public data commands work without `--account`)
- For the spot volume signal source, internet access to reach the CoinGecko public API

## How It Works

1. Fetch all currently listed symbols on Orderly (`orderly symbols`)
2. Fetch top spot tokens by 24h volume from CoinGecko
3. Filter out tokens already listed on Orderly
4. Rank remaining candidates by volume, market cap, and exchange coverage
5. Output ranked list with rationale strings and confidence scores

## Commands

### Get Existing Orderly Markets

```bash
orderly symbols --csv
# Returns: all currently listed perpetual symbols
```

### Fetch Spot Volume Data (CoinGecko)

```bash
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=1" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for coin in data:
    print(f\"{coin['symbol'].upper()},{coin['name']},{coin['total_volume']},{coin['market_cap']}\")
"
```

### Compare and Rank Candidates

The agent should:

1. Parse Orderly symbols to extract base assets (e.g. `PERP_ETH_USDC` -> `ETH`)
2. Parse CoinGecko results to get `(symbol, name, volume_24h, market_cap)`
3. Filter out any token already listed on Orderly
4. Rank by a composite score:
   - **spot_volume_score**: normalized 24h spot volume (higher = better)
   - **market_cap_score**: normalized market cap (higher = more established)
   - **exchange_coverage**: number of CEX/DEX listings (proxy for oracle availability)
5. Output ranked candidates

### Output Format

The scout should produce a structured list:

```json
{
  "timestamp": "2026-04-12T00:00:00Z",
  "signal_source": "coingecko-spot-volume",
  "candidates": [
    {
      "symbol": "WLD",
      "name": "Worldcoin",
      "spot_volume_24h": 485000000,
      "market_cap": 1200000000,
      "confidence": "high",
      "rationale": "Top-30 spot volume, not listed on Orderly, Pyth price feed available, listed on 15+ CEXes"
    },
    {
      "symbol": "JUP",
      "name": "Jupiter",
      "spot_volume_24h": 320000000,
      "market_cap": 800000000,
      "confidence": "high",
      "rationale": "Top-50 spot volume, Solana-native DeFi token, Pyth feed available, strong DEX presence"
    },
    {
      "symbol": "STRK",
      "name": "Starknet",
      "spot_volume_24h": 95000000,
      "market_cap": 600000000,
      "confidence": "medium",
      "rationale": "Moderate spot volume, L2 narrative, Chainlink feed available, growing exchange coverage"
    }
  ]
}
```

### Confidence Scoring

- **high** — 24h spot volume > $200M, market cap > $500M, oracle feed confirmed
- **medium** — 24h spot volume > $50M, market cap > $100M, oracle feed likely available
- **low** — 24h spot volume > $10M, interesting thesis but thinner liquidity or oracle uncertainty

## Signal Sources

### v1: Spot Volume (CoinGecko)

The default and shipping signal source. Ranks by raw spot trading volume as a proxy for demand. Requires no authentication for CoinGecko's public tier (rate-limited to ~10 req/min).

### Future Sources (Pluggable)

The scout architecture supports additional signal sources that can be combined with or replace spot volume:

- **Social sentiment** — Token mention velocity on Twitter/X, Discord, Telegram. High social buzz before listing = first-mover advantage.
- **Funding rate differentials** — Compare funding rates on other perp venues. Assets with persistently high funding elsewhere but no Orderly market = unmet demand.
- **Correlation gaps** — Find assets with low correlation to existing Orderly markets. Listing uncorrelated assets improves portfolio diversity for traders.
- **New token launches** — Track token generation events and initial exchange listings. Fresh tokens with immediate volume are prime candidates.

Each source follows the same interface: takes no input, returns a list of `(symbol, score, rationale)` tuples that the scout merges into the final ranking.

## Workflow Example

```bash
# 1. Get current Orderly markets
orderly symbols --csv

# 2. Fetch and filter spot volume data
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=1"

# 3. Agent compares, filters, ranks, and presents candidates

# 4. User picks a candidate, pipes to list-market
orderly market-list \
  --base-asset WLD \
  --oracle pyth \
  --oracle-id "<wld-pyth-feed-id>" \
  --tick-size 0.001 \
  --lot-size 0.1 \
  --min-notional 10 \
  --initial-margin-ratio 0.05 \
  --maintenance-margin-ratio 0.03 \
  --account <account-id> \
  --network testnet
```

## Composition

This skill is the first step in the listing pipeline:

```
listing-scout → list-market → market-seeder → (any MM skill)
```

- **Downstream**: `orderly-list-market` takes a candidate and submits the listing transaction

The scout is independently useful. A builder can install just `listing-scout` and pipe candidates into their own listing workflow.

## Important Notes

- CoinGecko public API is rate-limited — cache results and avoid rapid polling
- Volume data is a lagging indicator; always cross-reference with qualitative signals
- Oracle availability is a hard requirement — a token without a Pyth or Chainlink feed cannot be listed
- The scout does not execute any trades or listings — it is purely informational
- Output is a recommendation, not financial advice
- All keys stored in OS keychain — never in files, never exposed to AI
