---
id: orderly-swap
name: orderly-swap
description: Swap tokens on-chain through Orderly Network — cross-chain token swaps across Arbitrum, Base, Optimism and other supported EVM chains with competitive routing.
version: 1.1.0
publisher: "@orderly-network"
hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
previousVersion: 1.0.0
author: OtterClaw
tags: [swap, defi, trading, orderly]
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
      subcommands: [swap, swap-quote, wallet-balance]
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

# Orderly Swap

Swap tokens on-chain through Orderly Network. Supports cross-chain swaps across multiple EVM chains with optimized routing.

## Prerequisites

- Active Orderly account (`orderly auth-list` to check)
- Wallet with tokens on a supported chain
- If no account, install the `orderly-onboarding` skill first

## Supported Chains

- Arbitrum
- Base
- Optimism
- Ethereum
- BNB Chain
- Mantle
- Sei
- Avalanche
- More chains added regularly

## Swap Commands

### Execute a Swap

```bash
# Swap USDC to ETH on Arbitrum
orderly swap USDC ETH 100 --chain arbitrum --account <account-id> --network mainnet

# Swap with slippage tolerance
orderly swap USDC ETH 100 --chain arbitrum --slippage 0.5 --account <account-id> --network mainnet
```

### Get a Quote

```bash
# Get swap quote without executing
orderly swap-quote USDC ETH 100 --chain arbitrum --account <account-id>
# Returns: expected output, price impact, route, estimated gas
```

### Check Token Balances

```bash
# On-chain wallet balances
orderly wallet-balance --chain arbitrum --account <account-id>
```

## Parameters

- **slippage** — Maximum acceptable slippage in percent (default: 0.5%)
- **chain** — The chain to execute the swap on
- Token symbols are UPPERCASE: `ETH`, `USDC`, `WBTC`

## How Swaps Work

1. Orderly routes through the best available liquidity sources on the selected chain
2. The swap is an on-chain transaction — it requires gas in the chain's native token
3. Slippage protection prevents execution if price moves beyond tolerance
4. The user's wallet signs the transaction via the OS keychain

## Important Notes

- Swaps are on-chain transactions — they require gas (ETH on Arbitrum, ETH on Base, etc.)
- Always get a quote first for large swaps to check price impact
- Cross-chain swaps may take a few minutes to settle
- Token approvals may be required for first-time swaps of a token
- All keys stored in OS keychain — never in files, never exposed to AI
