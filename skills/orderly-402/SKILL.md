---
name: orderly-402
description: Handle 402 payments on Orderly Network — pay for premium agent skills and services using USDC. Manages payment balances, deposits, and automatic micropayments for 402-gated content.
version: 1.0.0
author: OtterClaw
tags: [payments, 402, premium, orderly]
requires:
  bins: [orderly]
  install:
    - id: npm
      kind: command
      command: "npm install -g @orderly.network/cli"
      bins: [orderly]
      label: "Install Orderly CLI"
---

# Orderly 402 Payments

Pay for premium agent skills and services using the 402 payment protocol on Orderly Network. When an agent encounters a 402-gated skill or endpoint, this skill handles the payment automatically.

## What is 402?

HTTP 402 ("Payment Required") is the standard for machine-to-machine payments. When an agent requests a premium resource, the server responds with 402 and a payment request. The agent pays via Orderly's ledger system and retries the request.

## Prerequisites

- Active Orderly account (`orderly auth-list` to check)
- USDC balance for payments
- If no account, install the `orderly-onboarding` skill first

## Commands

### Check 402 Balance

```bash
# Check available balance for 402 payments
orderly 402 balance --account <account-id> --network mainnet
```

### Deposit to 402 Balance

```bash
# Deposit USDC to 402 payment balance
orderly 402 deposit 10.00 --account <account-id> --network mainnet
```

### View Payment History

```bash
# List recent 402 payments
orderly 402 history --account <account-id> --network mainnet

# Filter by recipient
orderly 402 history --recipient <recipient-account-id> --account <account-id>
```

### Make a Manual Payment

```bash
# Pay a specific amount to a skill provider
orderly 402 pay <recipient-account-id> 0.01 --memo "skill-request" --account <account-id> --network mainnet
```

## How 402 Works with Skills

1. Agent requests a 402-gated skill or endpoint
2. Server responds with HTTP 402 + payment details (amount, recipient, currency)
3. Agent uses this skill to process payment automatically
4. Payment settles on Orderly's ledger (instant, no gas fees)
5. Agent retries the original request with payment proof
6. Server delivers the premium content

## Payment Flow (Automatic)

When a skill's YAML frontmatter includes a `payment` block:

```yaml
payment:
  scheme: orderly-ledger
  price: "0.01"
  currency: USDC
  per: request
  recipient: "<provider-account-id>"
```

The agent should:
1. Check 402 balance is sufficient
2. Process payment to the recipient
3. Include payment proof in the follow-up request

## Important Notes

- 402 payments use Orderly's internal ledger — no on-chain gas fees
- Payments are in USDC
- Always confirm with the user before making payments above $1.00
- Check balance before attempting payment to avoid failed requests
- Payment history provides receipts for all transactions
- All keys stored in OS keychain — never in files, never exposed to AI
