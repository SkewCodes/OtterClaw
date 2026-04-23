---
id: orderly-dex-builder
name: orderly-dex-builder
description: Create and manage a perpetual futures DEX using Orderly ONE — the no-code platform to launch a fully-featured DEX in minutes with 140+ assets, 17+ chains, and shared omnichain liquidity.
version: 1.2.0
publisher: "@orderly-network"
hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
previousVersion: 1.1.0
author: OtterClaw
tags: [dex, builder, orderly-one, defi, orderly]
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
    - binary: curl
      subcommands: ["-X"]
    - binary: npx
      subcommands: ["@orderly.network/mcp-server"]
  network:
    egress:
      - "api.orderly.org"
      - "testnet-api.orderly.org"
      - "dex.orderly.network"
      - "registry.npmjs.org"
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

# Orderly DEX Builder

Create and manage a perpetual futures DEX using **Orderly ONE** — the no-code platform at https://dex.orderly.network/. Launch a fully-featured perps DEX in minutes, not months.

## What Agents Can Do

### Fully Automatable (API / CLI)

Agents can perform these actions programmatically without user interaction:

- **Read DEX configuration** — fetch current settings, theme, chain config
- **Update theme and branding** — modify colors, logos, styles via API
- **Manage SEO settings** — update site name, description, keywords
- **Configure navigation** — toggle menu items, add custom links
- **Query DEX status** — check broker code activation, fee stats
- **Install MCP server** — set up AI-assisted DEX development tooling

### Requires User Interaction (Web UI + Wallet)

These operations require the user to connect a wallet and sign transactions:

- **Initial DEX creation** — first-time wizard at https://dex.orderly.network/en/dex
- **Wallet connection** — connecting the operator wallet
- **Broker code activation** — $1,000 USDC on-chain payment
- **Logo/image uploads** — binary file uploads through the web UI

## What is Orderly ONE?

Orderly ONE lets anyone — DAOs, trading communities, funds, creators — deploy a perps DEX with:

- **140+ trading pairs** from Orderly's shared omnichain orderbook
- **17+ blockchains** (Arbitrum, Base, Optimism, Ethereum, BNB Chain, Solana, Mantle, Sei, Avalanche, Sonic, Berachain, and more)
- **Sub-200ms latency** (CEX-grade performance)
- **Deep liquidity** from institutional market makers
- **100% of trading fees** earned by the DEX operator

## Cost

- **Free** to create and customize a DEX
- **$1,000 USDC** to activate a broker code (required to earn fees)
- **25% discount** when paying with ORDER tokens

## Quick Setup (Web UI)

For users who want to launch immediately with defaults:

1. Go to https://dex.orderly.network/en/dex
2. Connect wallet
3. Click "Quick Setup"
4. DEX is live — customize later via API or web UI

## Full Configuration (12-Step Wizard)

Guide the user through each step at https://dex.orderly.network/en/dex:

### Step 1: Distributor Code (optional)
Enter a distributor/referral code if referred by an existing operator.

### Step 2: Broker Details
- Set the broker/DEX name (this is the public-facing brand)

### Step 3: Branding (optional)
- **Primary logo**: 600x120px recommended
- **Secondary logo**: 120x120px recommended
- **Favicon**: 96x96px recommended

### Step 4: Theme Customization (optional)
- CSS-based styling with interactive desktop/mobile preview
- AI-assisted theme generation available
- Custom color schemes and layout options

### Step 5: PnL Posters (optional)
- Upload custom background images for trading performance sharing cards
- Up to 8 backgrounds, 16:9 aspect ratio, 960x540px recommended
- Users share these on social media — good for viral growth

### Step 6: Social Media Links (optional)
- Telegram, Discord, Twitter/X URLs
- Displayed in the DEX footer

### Step 7: SEO Configuration (optional)
- Site name, description, keywords
- Language and locale
- Twitter handle and theme color
- Improves discoverability

### Step 8: Wallet Configuration — Reown (optional)
- Enhanced wallet connectivity via Reown (formerly WalletConnect)
- Project ID enables QR code scanning for mobile wallets
- Supports MetaMask Mobile, Trust Wallet, 300+ wallets

### Step 9: Wallet Configuration — Privy (optional)
- Social login: Google, Discord, Twitter
- Email and phone authentication
- Embedded wallets for non-crypto-native users
- Requires a Privy App ID

### Step 10: Blockchain Configuration (optional)
- Select which chains to support (default: all 17+ chains)
- Set a default chain for new users

### Step 11: Asset Filtering (optional)
- Choose which trading pairs to display (98+ available)
- Curate the trading experience for your audience

### Step 12: Language & Navigation (optional)
- **Languages**: English, Chinese (Simplified/Traditional), Japanese, Spanish, Korean, Vietnamese, German, French, Russian, Indonesian, Turkish, Italian, Portuguese, Ukrainian, Polish, Dutch
- **Navigation menus**: Toggle Trading, Portfolio, Markets, Leaderboard, Swap, Rewards, Vaults, Points
- Add custom menu links (e.g., Help Center, API Docs)

### Step 13: ORDER Token Campaigns (optional)
- Enable ORDER token-related features and promotions

## API Access (Programmatic Management)

For agents and advanced users, Orderly ONE exposes REST API endpoints for DEX management after initial creation.

**Base URLs:**
- Mainnet: `https://api.orderly.org`
- Testnet: `https://testnet-api.orderly.org`

**Required Headers (all requests):**
- `orderly-account-id` — Your account ID
- `orderly-key` — Your Ed25519 public key
- `orderly-timestamp` — Unix timestamp in milliseconds
- `orderly-signature` — Ed25519 signature of the request

### Get DEX Configuration

```bash
curl -X GET "https://api.orderly.org/v1/public/broker/info" \
  -H "orderly-account-id: <account-id>" \
  -H "orderly-key: <public-key>" \
  -H "orderly-timestamp: $(date +%s000)" \
  -H "orderly-signature: <signature>"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "broker_id": "your-dex",
    "broker_name": "Your DEX Name",
    "status": "active",
    "chains": ["arbitrum", "base", "optimism"],
    "created_at": "2026-01-15T00:00:00Z"
  }
}
```

### Update Theme

```bash
curl -X POST "https://api.orderly.org/v1/broker/theme/modify" \
  -H "Content-Type: application/json" \
  -H "orderly-account-id: <account-id>" \
  -H "orderly-key: <public-key>" \
  -H "orderly-timestamp: $(date +%s000)" \
  -H "orderly-signature: <signature>" \
  -d '{
    "primary_color": "#6C5CE7",
    "background_color": "#1A1A2E",
    "font_family": "Inter",
    "border_radius": "8px"
  }'
```

### Update SEO Settings

```bash
curl -X POST "https://api.orderly.org/v1/broker/seo/modify" \
  -H "Content-Type: application/json" \
  -H "orderly-account-id: <account-id>" \
  -H "orderly-key: <public-key>" \
  -H "orderly-timestamp: $(date +%s000)" \
  -H "orderly-signature: <signature>" \
  -d '{
    "site_name": "Your DEX",
    "description": "Trade 140+ perpetual futures with deep liquidity",
    "keywords": "perps, defi, trading",
    "twitter_handle": "@yourdex"
  }'
```

### Verify Transaction

```bash
curl -X POST "https://api.orderly.org/v1/broker/verify-tx" \
  -H "Content-Type: application/json" \
  -H "orderly-account-id: <account-id>" \
  -H "orderly-key: <public-key>" \
  -H "orderly-timestamp: $(date +%s000)" \
  -H "orderly-signature: <signature>" \
  -d '{
    "tx_hash": "0xabc123...",
    "chain": "arbitrum"
  }'
```

### Agent Workflow Example: Configure a DEX After Creation

```bash
# 1. Check current DEX config
curl -X GET "https://api.orderly.org/v1/public/broker/info" \
  -H "orderly-account-id: <account-id>" \
  -H "orderly-key: <public-key>" \
  -H "orderly-timestamp: $(date +%s000)" \
  -H "orderly-signature: <signature>"

# 2. Update the theme to match user's brand
curl -X POST "https://api.orderly.org/v1/broker/theme/modify" \
  -H "Content-Type: application/json" \
  -H "orderly-account-id: <account-id>" \
  -H "orderly-key: <public-key>" \
  -H "orderly-timestamp: $(date +%s000)" \
  -H "orderly-signature: <signature>" \
  -d '{"primary_color": "#FF6B35", "background_color": "#0D1117"}'

# 3. Set SEO for discoverability
curl -X POST "https://api.orderly.org/v1/broker/seo/modify" \
  -H "Content-Type: application/json" \
  -H "orderly-account-id: <account-id>" \
  -H "orderly-key: <public-key>" \
  -H "orderly-timestamp: $(date +%s000)" \
  -H "orderly-signature: <signature>" \
  -d '{"site_name": "MyPerps", "description": "Community perps DEX powered by Orderly"}'
```

## MCP Integration

For AI-assisted DEX development, use the Orderly MCP server:

```bash
# Install MCP server for your AI client
npx @orderly.network/mcp-server init --client claude

# Other supported clients
npx @orderly.network/mcp-server init --client cursor
npx @orderly.network/mcp-server init --client windsurf
```

### Available MCP Tools

The MCP server exposes the following tools for agents:

- **`get_orderly_one_api_info`** — Returns detailed API documentation for DEX creation, theme management, graduation systems, and administration. Use this as a reference when making API calls.

### MCP Workflow

1. Agent calls `get_orderly_one_api_info` to get full API documentation
2. Agent reads the endpoint specifications, request/response schemas
3. Agent constructs and executes API calls with proper authentication headers
4. Agent verifies results and reports back to the user

## After Launch

Once the DEX is live:
1. **Activate broker code** ($1,000 USDC) to start earning trading fees
2. **Share the DEX URL** with your community
3. **Monitor performance** via the Orderly ONE dashboard
4. **Customize further** — all settings can be changed after launch via API or web UI

## Important Notes

- Initial DEX creation requires the web UI at https://dex.orderly.network/
- Post-creation configuration is fully automatable via the REST API
- Your DEX shares Orderly's omnichain liquidity — no need to bootstrap your own
- Trading fees are 100% yours after broker code activation
- The DEX is non-custodial — users trade from their own wallets
- All keys stored in OS keychain — never in files, never exposed to AI
