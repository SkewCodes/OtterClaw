---
name: orderly-vault
description: Interact with Orderly OmniVault — deposit USDC to earn yield from professional market-making strategies. Omnichain deposits and withdrawals across Arbitrum, Base, Optimism and more.
version: 1.1.0
author: OtterClaw
tags: [vault, yield, defi, orderly]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
---

# Orderly OmniVault

Earn yield on USDC through professional market-making strategies managed by Kronos Research. Deposit from any supported EVM chain.

Some vault operations require on-chain wallet interaction through the web UI. CLI commands are available for read operations and balance checks. The sections below clearly separate what agents can automate from what needs user handoff.

## Key Facts

- Deposit USDC from Arbitrum, Base, Optimism (more coming)
- Withdraw to same or different chain
- 3-hour vault periods (8 per day)
- 48-hour lock-up on deposits
- Up to 40% of Orderly protocol revenue flows to vault
- Smart contract interaction (on-chain, not REST API)

## CLI Commands (Agent-Executable)

These commands can be run directly by the agent without user interaction.

### Check Account Balance

```bash
orderly account-balance --account <account-id> --network mainnet
# Returns: available USDC balance, total equity, unrealized PnL
```

### Check Vault Info

```bash
orderly vault-info --account <account-id> --network mainnet
# Returns: current vault APY, total deposits, vault period status
```

### Check Vault Balance

```bash
orderly vault-balance --account <account-id> --network mainnet
# Returns: user's vault shares, USDC value, pending deposits/withdrawals
```

### Check Vault History

```bash
orderly vault-history --account <account-id> --network mainnet
# Returns: deposit/withdrawal history with timestamps and amounts
```

## Web UI Operations (Requires User Interaction)

These operations involve on-chain smart contract calls and require the user's wallet to sign transactions. The agent cannot execute these autonomously — guide the user through the steps.

### Deposit USDC

1. Go to https://app.orderly.network/vaults
2. Connect wallet on preferred chain (Arbitrum, Base, or Optimism)
3. Input USDC amount and approve the transaction
4. Confirm the deposit in the wallet
5. Monitor via "My Performance" tab

### Withdraw USDC

1. Go to https://app.orderly.network/vaults
2. Navigate to "My Performance" tab
3. Select withdrawal amount and destination chain
4. Confirm the withdrawal in the wallet
5. Funds arrive after the current vault period ends

### First-Time Approval

The first deposit on each chain requires a token approval transaction before the deposit itself. The web UI handles this automatically.

## Important Notes

- Vault deposits require on-chain wallet interaction (not CLI-only)
- Returns compound automatically each vault period (every 3 hours)
- APY is variable based on market conditions and strategy performance
- 48-hour lock-up applies to new deposits before withdrawal is available
- Shares represent vault participation, not securities
- All keys stored in OS keychain — never in files, never exposed to AI
