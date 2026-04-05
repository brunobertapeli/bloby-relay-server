# Stripe Crypto Onramp

## Status
**Live.** Approved 2026-03-31. Using live Stripe keys (`STRIPE_SECRET_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY`).

## Remaining step

### Switch to Tempo network
When Tempo is added to Stripe's supported onramp networks, update one line in `backend/routes/stripe.js`:

```diff
- destination_network: 'base',
+ destination_network: 'tempo',
```

This aligns funding with the balance display, which already reads from Tempo chain (`backend/routes/claim.js`).

## Architecture
- **Backend**: `POST /api/stripe/onramp-session` creates a Stripe Crypto Onramp session using `OnrampSessionResource` (custom Stripe resource, since the SDK doesn't have built-in support yet)
- **Frontend**: `FundWalletModal` in `Dashboard.jsx` dynamically imports `@stripe/crypto`, mounts the onramp widget with dark theme, and listens for `fulfillment_complete`
- Wallet address is pre-filled and locked from the Bloby's stored `walletAddress`
- USDC is delivered directly to the bot's wallet on Base (later Tempo)
