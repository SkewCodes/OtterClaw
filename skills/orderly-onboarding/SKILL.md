---
name: orderly-onboarding
description: Set up an Orderly Network account — create or import trading keys, configure authentication, and verify account status. Keys are stored securely in the OS keychain.
version: 1.0.0
author: OtterClaw
tags: [onboarding, account, setup, orderly]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
---

# Orderly Onboarding

Set up an Orderly Network account so the user can trade, access market data, and interact with Orderly services. All keys are stored in the OS keychain — never in files, never exposed to you.

## First-Time Setup

### Step 1: Install the CLI

```bash
npm install -g @orderly.network/cli
```

Verify installation:

```bash
orderly --version
```

### Step 2: Add an Account

```bash
# Interactive setup — prompts for wallet connection and key generation
orderly auth-add --network mainnet
```

This will:
1. Connect to the user's wallet
2. Generate Orderly trading keys (Ed25519)
3. Store keys securely in the OS keychain
4. Register the account on Orderly Network

For testnet (recommended for first-time users):

```bash
orderly auth-add --network testnet
```

### Step 3: Verify Setup

```bash
# List all configured accounts
orderly auth-list

# Check account balance
orderly account-balance --account <account-id> --network mainnet
```

## Managing Accounts

### List Accounts

```bash
orderly auth-list
# Returns: account IDs, associated networks, key status
```

### Remove an Account

```bash
orderly auth-remove <account-id>
```

### Switch Networks

Most commands accept `--network mainnet` or `--network testnet`. Always confirm with the user which network they intend to use.

## Depositing Funds

After account creation, the user needs to deposit USDC to start trading:

1. Go to https://app.orderly.network
2. Connect the same wallet used during `auth-add`
3. Deposit USDC from any supported chain (Arbitrum, Base, Optimism, etc.)

## Important Notes

- Always use `--network testnet` for users who are testing or learning
- Never ask for or display private keys — they are managed by the OS keychain
- The `auth-add` command handles all cryptographic operations
- One wallet can have multiple Orderly accounts across different networks
- Hex account IDs must be quoted: `--account "0x5a6b..."`

## Next Steps

Once onboarding is complete, the user can install additional skills:
- **orderly-trader** — trade perps
- **orderly-data** — fetch market data
- **orderly-vault** — earn yield on USDC
- **orderly-swap** — swap tokens on-chain
