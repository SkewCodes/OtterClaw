---
id: your-skill-name
name: your-skill-name
description: What your skill does. Be specific about the value.
version: 1.0.0
publisher: "@your-org"
hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
previousVersion: 0.9.0
author: Your Name / Handle
tags: [relevant, tags]
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
      subcommands: [your-command]
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
payment:
  scheme: orderly-ledger
  price: "0.01"
  currency: USDC
  per: request
  recipient: "<your-orderly-account-id>"
---

# Your Skill Name

What this skill does and why an agent would use it.

## Prerequisites

- Active Orderly account (`orderly auth-list` to check)
- USDC balance for 402 payments (`orderly 402 balance --account <id>`)

## Commands / Usage

Describe how to use the skill. Be explicit about commands, parameters, expected output format.

### Main Command

```bash
orderly your-command --account <account-id> --network mainnet
```

## Pricing

This is a premium skill. Each request costs $0.01 USDC via Orderly 402. Payment is automatic — the agent's 402-client handles it.

| Action | Cost |
|--------|------|
| Basic request | $0.01 USDC |
| Premium request | $0.05 USDC |

## Examples

### Example: Basic Usage

```bash
# Get the thing
orderly your-command --account <account-id>
```

Expected output:
```json
{
  "status": "success",
  "data": {}
}
```

## Important Notes

- Payment is processed via Orderly's internal ledger (no gas fees)
- Agent should check 402 balance before making requests
- All keys stored in OS keychain — never in files, never exposed to AI
