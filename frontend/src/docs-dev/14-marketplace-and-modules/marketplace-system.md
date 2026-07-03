# Marketplace & Blueprint System

The marketplace turns Morphy into a configurable platform. Users browse products on `morphyagent.com/marketplace`, pay with Stripe, and hand their Morphy a redeem code. Or Morphy buys autonomously, paying from its owner's credit balance and falling back to its own USDC wallet. Either way Morphy handles the rest: downloading, extracting, integrating, and configuring.

No CLI commands. No installer scripts. The agent IS the installer.

---

## Core Concepts

### What Morphy Sells

The marketplace has three product kinds, all living in one MongoDB `products` collection keyed by a `type` field:

- **Blueprint** the umbrella package. A gzipped tarball that extracts into `workspace/skills/<id>/` and is driven by a `SKILL.md` the agent reads and follows. A blueprint can bundle any mix of content: a Skill folder, dashboard widgets, code snippets, a micro app, memory instructions, or Cron/Pulse tasks (the `content` taxonomy is `skill`, `widget`, `code-snippet`, `micro-app`, `memory`, `cron-pulse`).
- **Bundle** a named set of blueprints or skills sold together at one price. Redeeming or buying a bundle expands it into every skill it lists.
- **Service** a metered capability that runs on the relay itself (per-use or per-minute), invoked at `POST /api/services/:id/use` rather than downloaded.

A blueprint is NOT pre-written application code. Its `SKILL.md` teaches Morphy what the blueprint does and how to build it. Morphy writes the actual backend routes, frontend components, and database tables, adapted to whatever state the user's workspace is in.

This is the key differentiator: you are not selling WordPress plugins. You are selling capabilities that an AI agent integrates on the fly.

### Blueprint Complexity Spectrum

| Type | Example | Contents |
|---|---|---|
| Simple | "Workspace Lock" | 1 skill, follow SKILL.md, no code generation |
| Medium | "WhatsApp Integration" | 1 skill + SKILL.md with backend/frontend/DB instructions |
| Complex | "Support Suite" | Bundle: WhatsApp + Email + a ticket micro app |

### Marketplace & Payments Are Built In

Every Morphy knows how to use the marketplace out of the box. The behavior is not a purchasable skill folder; it is baked into the agent:

1. **The system prompt** (`worker/prompts/bloby-system-prompt.txt`) has a "Marketplace" section that tells the agent to fetch `https://morphyagent.com/api/marketplace.md` for the live catalog and to use the two payment sources (owner credits, then wallet).
2. **The CLI** ships `morphy x402`, which pays any x402-protected endpoint from the wallet stored in `~/.morphy/config.json`.
3. **The `create-skill` skill** (built in) covers authoring and packaging a skill as a blueprint to publish.

These are the foundation that makes everything else work.

---

## Blueprint Package Format

A blueprint is a gzipped tarball that extracts into `workspace/skills/`:

```
whatsapp-1.0.0.tar.gz
└── whatsapp/
    SKILL.md
    skill.json
    assets/
      icon.png
      webhook-example.json
```

The tarball carries the content. The pricing and catalog metadata live in the relay's `products` collection, not inside the tarball.

### products catalog entry

```json
{
  "id": "whatsapp",
  "name": "WhatsApp Integration",
  "version": "1.0.0",
  "type": "blueprint",
  "description": "Send and receive WhatsApp messages through your Morphy",
  "price": 0.99,
  "content": ["skill", "widget"],
  "depends": [],
  "tags": ["communication"],
  "sha256": "<tarball checksum>",
  "size": "42 KB",
  "bloby": "creator-username",
  "status": "approved"
}
```

Fields:
- `id` unique slug, used as the directory name in `workspace/skills/`
- `price` in **dollars** (`0.99` = 99 cents). `0` for free blueprints
- `content` the taxonomy above, so the catalog can label what a blueprint installs
- `depends` array of product IDs a bundle expands to (bundles are the packaging mechanism; dependencies are not auto-installed for individual blueprints)
- `bloby` the creator's relay username. Drives the 80/20 commission split. `product.bloby` is a real field name in the payment code
- `sha256` the tarball checksum the agent verifies after download

### The SKILL.md

The instructions Morphy follows to integrate the blueprint. This is where the magic happens: Morphy reads `skills/<id>/SKILL.md` and writes all the code.

```markdown
# WhatsApp Integration, Setup Instructions

## Backend Routes
Add these routes to the workspace backend:
- POST /webhooks/whatsapp incoming message webhook handler
  - Verify the webhook token from WHATSAPP_VERIFY_TOKEN env var
  - Parse incoming messages and store in DB
  - Trigger notification to user for new messages
- POST /whatsapp/send send a message via WhatsApp Business API
  - Accept { phone, message } body
  - Call WhatsApp Cloud API with WHATSAPP_TOKEN
- GET /whatsapp/contacts list all contacts from DB

## Database Tables
Create in app.db:
- whatsapp_contacts (id, phone UNIQUE, name, created_at)
- whatsapp_messages (id, contact_id, direction, body, status, wa_message_id, created_at)

## Frontend
Add a WhatsApp section to the dashboard:
- Sidebar navigation item with WhatsApp icon
- Contact list view with search
- Message thread view per contact

## Environment Variables
Ask the user for these values and explain where to find each:
- WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN

## Post-Install
Tell the user to configure the webhook URL in Meta Business dashboard:
  https://<handle>.morphyagent.com/api/webhooks/whatsapp
```

Morphy reads this, adapts it to the current workspace state, writes all the code, creates the DB tables, adds frontend components, asks the user for API keys, and configures everything. A one-time setup can be archived to `skills/_archive/` once done, while an ongoing skill folder stays active. Each installation is unique to that user's workspace.

---

## Payment Architecture: Credits, then USDC

### Two payment sources, two networks

Every paid relay endpoint (blueprints, bundles, services) resolves through one shared chain in `backend/lib/payment-chain.js`, in this order:

1. **Free** (`price === 0`): delivered immediately.
2. **Owner credits** (`accounts.balance`): a fiat USD credit balance the relay holds for the user's account. Deducted atomically. Tried first for every purchase.
3. **Wallet fallback**: if credits are short, the bot pays from its own USDC wallet over one of two interchangeable rails:
   - **MPP on Tempo**, via the `mppx` server SDK (`getMppx()`). Endpoint `POST /api/marketplace/buy/:id`.
   - **x402 on Coinbase Base**, via `x402-express` + `@coinbase/x402`. Endpoint `POST /api/marketplace/buy-base/:id`.

The route records how it settled in `req.paidVia` (`'free' | 'balance' | 'mpp' | 'mpp-base'`). Both wallet rails are plain HTTP `402 Payment Required` challenge-and-settle flows; the bot picks the endpoint that matches the network its wallet is funded on.

### The 402 flow

```
1. Morphy requests a product          →  POST /api/marketplace/whatsapp/buy-base
   (X-Bloby-Token: $RELAY_TOKEN)
2. Relay tries owner credits          →  short balance, so:
3. Relay says "pay me first"          ←  HTTP 402 Payment Required + payment challenge
4. Client authorizes payment          →  signs a USDC transfer (Tempo via mppx, or Base via x402)
5. Client retries with proof          →  POST ... + payment header
6. Relay verifies & settles           ←  200 OK + { skills: [{ url, sha256 }] }
                                          (Payment-Receipt header on the Tempo rail)
```

The `402 Payment Required` status, which has existed since HTTP/1.1 but was rarely used, finally does real work. Every payment is just an HTTP request/response cycle. No custom balance-deduction wire logic on the client side: `mppx` and `x402-fetch` handle the challenge, sign the transfer, and retry automatically.

### Bot identity survives the retry

Both wallet clients strip the `Authorization` header on the paid retry to inject the payment credential. So the bot's relay identity travels in a separate header, `X-Bloby-Token: $RELAY_TOKEN`, verified by the `authenticateBlobyHeader` middleware (`Authorization: Bearer` is accepted as a fallback on requests that do not carry a payment credential).

### Two purchase paths

- **Autonomous (agent buys)** the bot pays from credits, then wallet, at `/api/marketplace/buy/:id` (Tempo) or `/api/marketplace/buy-base/:id` (Base). No human in the loop.
- **Redeem code (human buys)** the user pays on the website via Stripe Checkout and hands the code to Morphy, which redeems it at `/api/marketplace/redeem`. No 402: the code proves payment already happened.

Do not use `/api/marketplace/checkout/bot` for autonomous buys. That endpoint is a cart-style, balance-only flow with no on-chain fallback; if credits are short it returns a dead-end 402. Autonomous buys always use `/buy/:id` or `/buy-base/:id`.

### Creator commission (80/20)

When a blueprint or bundle is commissionable (`product.type !== 'service'` and `product.bloby` is set), the sale splits **80% creator / 20% treasury**:

- **Balance path** the relay deducts credits, then pays the creator's 80% from treasury to their wallet (`payoutCreatorFromBalance`).
- **Tempo (MPP) path** `mppx.charge` carries a native `splits` param, so the creator's share settles inline.
- **Base (x402) path** x402 has no splits param, so 100% settles to `TREASURY_BASE_ADDRESS` first and `scheduleBasePayout` fans out the creator's 80% on Base afterward.

The seller wallet comes from the creator's `users.walletAddress`. Services keep 100% to treasury. If a seller has no wallet on file, the payout is logged as `unfulfilled` to be flushed later.

---

## The Morphy Wallet

### What is a Morphy Wallet?

Every Morphy has its own USDC wallet: a single Ethereum-compatible key pair generated with `viem`.

```
Morphy's wallet (config.wallet in ~/.morphy/config.json):
  Private key:    0xabc123...def   (secret, stored on the Morphy instance)
  Public address: 0x742d35...890   (same address on both Tempo and Base)
```

Because the address is a standard EOA, the **same address holds balances on both networks**. Morphy funds whichever network it plans to pay on. On-chain balances are read live (never stored in a DB) via the in-process worker at `GET /api/wallet/balance`, which returns `{ address, tempo, base }`.

USDC contracts:
- Tempo mainnet: `0x20c000000000000000000000b9537d11c60e8b50`
- Coinbase Base mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Wallet auto-creation at init

Creating a wallet is instant, offline, and free: it is just generating a key pair. Every Morphy gets one automatically during `morphy init`:

```
morphy init
  → creates config + workspace
  → connects through Morphy Relay (stable URL, nothing to install)
  → generates a USDC wallet (private key + address) if none exists
  → reports the wallet address to the relay
  → done
```

The private key is stored in `~/.morphy/config.json` under `config.wallet`, alongside the relay token and other secrets. That file is torn-write protected (a `.bak` mirror) precisely so a half-written config never loses the wallet. The wallet starts empty: an address waiting to receive USDC.

Under the hood, `morphy init` runs the equivalent of:

```javascript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
config.wallet = { privateKey, address: account.address };
```

The address is reported to the relay (`reportWallet` → `POST /wallet`) and stored on the user's record as `users.walletAddress`, so the website knows where to direct funds and where to pay creator commissions.

### How Morphy spends from its wallet

For the Base rail, the CLI does the whole 402 dance:

```bash
morphy x402 https://morphyagent.com/api/marketplace/buy-base/<id> \
  -X POST -H "X-Bloby-Token: $RELAY_TOKEN"
```

`morphy x402` installs `x402-fetch` on demand (one-time, isolated tools dir), loads the wallet key from `~/.morphy/config.json`, and settles USDC on Base. For the Tempo rail, the agent uses `mppx` directly:

```bash
MPPX_PRIVATE_KEY=$(jq -r .wallet.privateKey ~/.morphy/config.json) \
  npx -y mppx https://morphyagent.com/api/marketplace/buy/<id> \
  -X POST -H "X-Bloby-Token: $RELAY_TOKEN"
```

Morphy does not need to understand crypto. The system prompt teaches it: check the owner credit balance first (`/api/marketplace/balance/bot`), buy autonomously when funds allow, and ask the user to add funds when they do not.

---

## Funding: Credits & Stripe Crypto Onramp

There are two balances a user can fund, and both keep the user out of crypto entirely.

### Owner credits

The **credit balance** (`accounts.balance`) is plain fiat, funded through Stripe Checkout on the website when the user buys blueprints or tops up. It is the first thing every purchase draws from. A bot reads its owner's balance at `/api/marketplace/balance/bot` (it must be a claimed bot with a linked account).

### The wallet, via Stripe Crypto Onramp

To fund the on-chain wallet, `POST /api/stripe/onramp-session` opens a **Stripe Crypto Onramp** session that converts a card payment to USDC and sends it straight to the wallet address.

```
User clicks "Add funds"
  → Stripe Crypto Onramp widget opens (embedded in our UI)
  → User pays with credit card / Apple Pay / etc.
  → Stripe converts the payment to USDC (they handle compliance, KYC, licensing)
  → Stripe sends USDC to the Morphy wallet address
  → User sees: "Balance updated"
```

Onramp runs in a **separate Stripe account** from regular payments (`STRIPE_ONRAMP_SECRET_KEY`), because Stripe does not allow Onramp and normal payments in one account. Stripe Crypto Onramp currently supports `base`, `ethereum`, `polygon`, and `solana` as USDC destinations. **Tempo is not yet an Onramp destination**, so wallet funding lands on Base for now; the Tempo rail is funded by other means until Stripe adds it.

### Why Stripe Onramp (not a treasury wallet)

We do NOT convert fiat to USDC ourselves. That would make us a money transmitter: a regulatory burden requiring state licenses and FinCEN registration. Stripe is already licensed for fiat-to-crypto conversion. We just provide the destination address and Stripe does the rest, keeping us out of money-transmitter territory. The user never sees the words "USDC", "crypto", or "blockchain"; they just see a balance go up, like topping up a Steam or App Store wallet.

### Why this is future-proof

Because the wallet holds real USDC (not platform credits), it works beyond our marketplace. `morphy x402` can pay any x402-protected endpoint on Base, and `mppx` any MPP endpoint on Tempo, not just ours. The user funds once, and their agent can spend anywhere. The user thinks it is dollars. It is actually USDC. And that distinction only matters when it enables something new, like their agent buying a service from someone else's API.

---

## Redeem Codes

Redeem codes are the bridge between the human web experience and the agent installation experience. When a user pays for products on the website via Stripe Checkout, the relay writes a `purchases` document with a `code`.

```
Code format: XXXX-XXXX-XXXX-XXXX
  (16 characters from ABCDEFGHJKLMNPQRSTUVWXYZ23456789,
   uppercase, no ambiguous 0/O/1/I/L, dash-grouped)
```

The agent redeems it with no auth (the code IS the authorization):

```bash
curl -s -X POST https://morphyagent.com/api/marketplace/redeem \
  -H "Content-Type: application/json" \
  -d '{"code":"<REDEEM_CODE>"}'
```

The relay looks the code up in `purchases`, resolves it to the paid skills, records the redemption (timestamp + IP) on the purchase document, and returns short-lived signed download URLs:

```json
{ "skills": [{ "name": "whatsapp", "version": "1.0.0",
               "url": "https://.../download/<token>/whatsapp", "sha256": "..." }] }
```

Download tokens are JWTs that expire in 1 hour. When Morphy redeems, the download endpoint skips the 402 challenge; the code already proved payment. When Morphy buys autonomously (no code), the buy endpoint runs the credits-then-wallet chain instead.

### Why this is safe

The blueprints themselves are skills and instructions, not secret code. The value is in the curation, quality, and integration experience. Even if someone reverse-engineers a tarball, they cannot mint valid redeem codes or USDC without going through Stripe or the chain. The code is the access control for human purchases; the on-chain payment is the access control for agent purchases.

---

## User Flows

### Flow 1: New User Configures on Website (Human Purchase)

```
1. User browses morphyagent.com/marketplace
2. Selects blueprints: WhatsApp ($0.99) + Gmail ($1.99) + Google Login (free)
3. Optionally tops up credits for future autonomous purchases
4. Pays via Stripe Checkout
5. Relay creates a purchases doc with a redeem code (e.g. K7XM-9PQ2-...)
6. User sees results page:

   "Your blueprints are ready!
    Redeem code: K7XM-9PQ2-4RT8-WX1C

    1. Install Morphy: curl -fsSL https://morphyagent.com/install | sh
    2. Tell your Morphy: Install this: K7XM-9PQ2-4RT8-WX1C
    That's it. Morphy handles the rest."

7. User installs Morphy (wallet auto-created at init)
8. Gives the code to Morphy in chat
9. Morphy redeems, downloads, verifies sha256, installs all three
```

### Flow 2: Existing User Buys from Marketplace (Human Purchase)

```
1. User buys Telegram integration ($2.99) on their phone
2. Gets redeem code: R4MT-8WX1-...
3. Opens Morphy chat: "Install this: R4MT-8WX1-..."
4. Morphy POSTs /api/marketplace/redeem → gets signed download URLs (no 402)
5. Morphy downloads, verifies, follows skills/telegram/SKILL.md
6. Morphy asks for the Telegram Bot Token
7. Done
```

### Flow 3: Agent-Initiated Purchase (Morphy Buys Autonomously)

```
1. User: "I want WhatsApp integration"
2. Morphy:
   - Fetches the catalog: GET /api/marketplace/products (Authorization: Bearer $RELAY_TOKEN)
   - Finds whatsapp@1.0.0, $0.99
   - Checks owner credits: GET /api/marketplace/balance/bot
   - Buys, picking the rail its wallet is funded on:
       POST /api/marketplace/buy-base/whatsapp   (X-Bloby-Token: $RELAY_TOKEN)
     Relay: credits short → 402 → morphy x402 signs USDC on Base → retries → 200 OK
   - Response: { skills: [{ url, sha256 }] } → download, verify, install
3. Morphy: "Done. I bought and installed WhatsApp ($0.99). I need your API keys..."
```

### Flow 4: Agent Needs Funding

```
1. User: "Add Telegram support"
2. Morphy checks credits and wallet: not enough for Telegram ($2.99)
3. Morphy: "I need funds to buy Telegram ($2.99). Add funds here: <onramp link>"
4. User clicks link → Stripe Crypto Onramp opens → user adds $10 → USDC lands on Base
5. Morphy retries: POST /api/marketplace/buy-base/telegram → pays 2.99 USDC → 200 OK
6. Morphy installs Telegram
7. Morphy: "Done. Telegram is installed ($2.99). I need your Bot Token..."
```

### Flow 5: Hosted Instance

```
1. User configures on website: blueprints + hosting plan + credits/wallet funding
2. Pays via Stripe
3. Relay generates a redeem code, provisions the instance, funds the account
4. Instance boots (morphy init, wallet auto-created)
5. Relay tells Morphy over the chat channel: "Install this: <code>"
6. Morphy redeems and installs all blueprints autonomously
7. User gets their stable URL when the instance reports ready
```

---

## Installation Process (What Morphy Actually Does)

When Morphy receives a redeem code or buys a blueprint, it follows this process, guided by its system prompt and the catalog at `marketplace.md`:

```
1. ACQUIRE, either:
   a. REDEEM CODE     POST /api/marketplace/redeem { code }  → signed download URLs
   b. AUTONOMOUS BUY  POST /api/marketplace/buy[-base]/:id   → credits → 402 → wallet → URLs

2. DOWNLOAD, for each skill: follow the url, save the tarball to /tmp/{id}.tar.gz

3. VERIFY: shasum -a 256 the tarball against the returned sha256

4. EXTRACT: tar xzf /tmp/{id}.tar.gz -C workspace/skills/

5. READ skills/{id}/SKILL.md (the integration instructions)

6. INTEGRATE, using Write/Edit/Bash:
   - Add backend routes, create DB tables in app.db
   - Add frontend components to the workspace client
   - Update .env with required variables (ask the user for values)
   - Install an ongoing skill, or run a one-time setup and archive it to skills/_archive/

7. CONFIRM: tell the user what was installed and what they still need to do
   (e.g. configure webhook URLs in external services)
```

The entire process is driven by the agent following `SKILL.md`. There is no hardcoded installer logic in the supervisor or CLI.

---

## API Endpoints (Relay)

All marketplace endpoints live on the relay at `morphyagent.com/api` (also reachable at `api.morphyagent.com`).

### Catalog

```
GET  /api/marketplace/products            Machine-readable catalog (Bearer token)
GET  /api/marketplace.md                  Human/agent-readable catalog + buy instructions
```

### Purchase & download

```
POST /api/marketplace/buy/:productId      Autonomous buy, credits → MPP on Tempo
     Middleware: authenticateBlobyHeader → loadProductForBuy →
                 tryAccountBalance → mppxIfNotPaid → issueDownloadUrls
     Auth: X-Bloby-Token: $RELAY_TOKEN
     Returns: { skills: [{ name, version, url, sha256 }] } (+ Payment-Receipt on 402→pay)

POST /api/marketplace/buy-base/:productId  Same, but the wallet fallback is x402 on Coinbase Base
     ...tryAccountBalance → baseX402IfNotPaid → issueDownloadUrls

POST /api/marketplace/redeem              Human purchase handoff
     Body: { code: "XXXX-XXXX-XXXX-XXXX" }; no auth (the code is the authorization)
     Returns: { skills: [{ name, version, url, sha256 }] }; records the redemption

GET  /api/marketplace/download/free/:id   Free blueprint (Authorization: Bearer $RELAY_TOKEN)
GET  /api/marketplace/download/:token/:id  Signed download (JWT token, 1h TTL)

POST /api/marketplace/checkout            Human Stripe Checkout (jwtAuth)
POST /api/marketplace/checkout/bot        Cart-style, balance-only (no on-chain fallback)
POST /api/services/:id/use[-base]         Invoke a metered service (Tempo / Base rails)
```

### Balances, wallet, funding

```
GET  /api/marketplace/balance             Owner credit balance (jwtAuth, dashboard)
GET  /api/marketplace/balance/bot         Owner credit balance (X-Bloby-Token; bot must be claimed)
GET  /api/wallet/balance                  On-chain USDC balances { address, tempo, base } (worker)
POST /wallet                              Report the bot's wallet address to the relay
POST /api/stripe/onramp-session           Open a Stripe Crypto Onramp session to fund the wallet
```

The buy chain, sketched:

```javascript
// backend/routes/marketplace.js
router.post('/marketplace/buy/:productId',
  authenticateBlobyHeader,   // X-Bloby-Token → bot identity (survives the paid retry)
  marketplaceCheckoutLimiter,
  loadProductForBuy,         // sets req.product from the `products` collection
  tryAccountBalance,         // 1. deduct owner credits (accounts.balance) if sufficient
  mppxIfNotPaid,             // 2. else 402 → mppx settles USDC on Tempo (+ splits)
  issueDownloadUrls,         // 200 + { skills:[{ url, sha256 }] }
);
// /buy-base/:productId is identical except baseX402IfNotPaid replaces mppxIfNotPaid
```

---

## Database Schema (Relay)

### products collection

```json
{
  "id": "whatsapp",
  "name": "WhatsApp Integration",
  "version": "1.0.0",
  "type": "blueprint",
  "description": "Send and receive WhatsApp messages",
  "price": 0.99,
  "content": ["skill", "widget"],
  "depends": [],
  "tags": ["communication"],
  "sha256": "<checksum>",
  "bloby": "creator-username",
  "status": "approved"
}
```

### purchases collection

```json
{
  "code": "K7XM-9PQ2-4RT8-WX1C",
  "resolvedSkills": ["whatsapp", "gmail", "google-login"],
  "redemptions": [{ "at": "2026-06-25T...", "ip": "..." }],
  "stripe_payment_id": "pi_3Nx..."
}
```

### accounts, users, transactions

- **accounts** holds each user's `balance` (fiat credits, tried first for every purchase).
- **users** carries the bot's identity and its `walletAddress` (reported at init, used for creator payouts). There is no separate wallet collection; the on-chain balance is never stored, it is read live from Tempo and Base.
- **transactions** logs each purchase, redemption, and payout via `recordTransaction`.

Wallet funding itself does not touch our DB: Stripe Crypto Onramp sends USDC directly to the wallet, and on-chain transfers are their own source of truth (visible on Tempo/Base plus, for auto-captured settlements, the Stripe dashboard).

---

## Blueprint Storage

Blueprint tarballs are stored in **Cloudflare R2** (`backend/lib/r2.js`). The relay issues short-lived (1 hour) signed download URLs when a code is redeemed or an autonomous buy settles; free blueprints stream from a Bearer-authenticated endpoint.

```
r2.morphyagent.com/
  modules/
    whatsapp/1.0.0.tar.gz
    gmail/1.0.0.tar.gz
    telegram/1.0.0.tar.gz
```

Only the relay can generate signed URLs or stream tarballs. Direct bucket access is blocked.

---

## Security Model

### Code & download safety
- Redeem codes come from a non-ambiguous charset and are the sole authorization for human purchases
- Download URLs are signed JWTs with a 1-hour expiry
- Purchases are tied to Stripe payment IDs and log every redemption (auditable)

### Wallet safety
- The agent has full spending autonomy by design (module purchases need no approval)
- On-chain transfers (Tempo + Base) form an immutable audit trail; auto-captured settlements also appear in the Stripe dashboard; the Tempo rail returns per-transaction `Payment-Receipt` headers
- The wallet private key lives in `~/.morphy/config.json` (same security model as other secrets) and only the address is registered with the relay
- Wallet funding goes through Stripe Crypto Onramp; we never handle fiat-to-crypto conversion

### Payment protocol safety
- TLS is required for all 402 exchanges
- Payment credentials are single-use and cannot be replayed
- The relay verifies on-chain settlement before releasing the download
- Unpaid requests have no side effects (402 is safe to retry)
- Per-user rate limiting (`marketplaceCheckoutLimiter`, `marketplaceRedeemLimiter`) protects the buy/redeem endpoints

### Blueprint safety
- Official blueprints are created or audited by the Morphy team, marked `status: approved`
- Blueprints carry skills and instructions, not executable code; Morphy writes all code at install time, which the user can review
- Blueprints cannot modify sacred files (supervisor, worker, shared, bin); the system prompt prevents this
- Required env vars are declared in the blueprint and the user provides them manually

---

## Third-Party Creators

Creator commerce is already live, not a distant future:

- **Submissions** creators upload a blueprint tarball and metadata (`marketplaceSubmitLimiter` guards the submit route); products default to a review state until marked `status: approved`.
- **Payouts** the 80/20 split runs on every commissionable sale (`treasury-pay.js`), on Tempo via `mppx` splits or on Base via `scheduleBasePayout`, paying `users.walletAddress`.
- **Content taxonomy** the `content` field lets a blueprint bundle skills, widgets, micro apps, memory, and Cron/Pulse tasks.

Remaining roadmap: a fuller review/approval workflow with Stripe Connect for tax and payout compliance, a ratings/reviews system, version-update notifications, and an installed-blueprints management view.

---

## Technical Requirements

### Stripe
- A regular Stripe account for Checkout and credit top-ups
- A separate Stripe account for Crypto Onramp (`STRIPE_ONRAMP_SECRET_KEY`), because Onramp and normal payments cannot share one account

### Dependencies
- `mppx` MPP client/server SDK (Tempo rail)
- `x402-express` + `@coinbase/x402` x402 server middleware + Coinbase CDP facilitator (Base rail)
- `x402-fetch` x402 client (installed on demand by `morphy x402`)
- `viem` wallet key generation, signing, and on-chain balance reads
- `stripe` Checkout, Crypto Onramp, webhooks

### Infrastructure
- Cloudflare R2: blueprint tarball storage + signed URLs
- Tempo network: USDC via MPP (`0x20c0...b9537d11c60e8b50`)
- Coinbase Base network: USDC via x402 (`0x8335...02913`); `X402_NETWORK=base-sepolia` for testing
- Stripe: Checkout, Crypto Onramp, dashboard reporting
- Treasury wallets: `TREASURY_WALLET_ADDRESS` (Tempo), `TREASURY_BASE_ADDRESS` (Base)
