---
id: your-skill-name
name: your-skill-name
description: What your skill does. Be specific about the capability it gives an agent.
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
      subcommands: [your-command, another-command]
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

# Your Skill Name

What this skill does and why an agent would use it. Be specific — agents read this literally.

## Prerequisites

- Active Orderly account (`orderly auth-list` to check)
- Any other requirements

## Commands

### Command Name

```bash
orderly your-command --account <account-id> --network mainnet
# Returns: describe the expected output
```

### Another Command

```bash
orderly another-command <arg> --flag value --account <account-id>
```

## Parameters

- **param1** — what it does (default: value)
- **param2** — what it does

## Examples

### Example: Do a Thing

```bash
# Step 1
orderly first-command --account <account-id>

# Step 2
orderly second-command --account <account-id>
```

Expected output:
```json
{
  "status": "success",
  "data": {}
}
```

## Important Notes

- Note about edge cases
- Note about security
- All keys stored in OS keychain — never in files, never exposed to AI
