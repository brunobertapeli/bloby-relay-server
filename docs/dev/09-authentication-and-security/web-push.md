---
title: "Web Push Security"
---

## 7. Web Push Security

### 7.1 VAPID Key Generation and Storage

VAPID (Voluntary Application Server Identification) keys are generated on first use and persisted in the SQLite settings table.

**File:** `worker/index.ts`, lines 81--99

```typescript
function getOrCreateVapidKeys() {
  let publicKey = getSetting('vapid_public_key');
  let privateKey = getSetting('vapid_private_key');
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    setSetting('vapid_public_key', publicKey);
    setSetting('vapid_private_key', privateKey);
  }
  return { publicKey, privateKey };
}

function initWebPush() {
  const { publicKey, privateKey } = getOrCreateVapidKeys();
  webpush.setVapidDetails('mailto:push@fluxy.bot', publicKey, privateKey);
}
```

The `mailto:` subject is set to `push@fluxy.bot`. VAPID keys use the `web-push` library's `generateVAPIDKeys()` which produces an ECDSA P-256 key pair.

### 7.2 Subscription Management

Push subscriptions are stored in the `push_subscriptions` table:

**File:** `worker/db.ts`, lines 35--41

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- `POST /api/push/subscribe` -- registers a subscription (upsert on endpoint).
- `DELETE /api/push/unsubscribe` -- removes a subscription by endpoint.
- `POST /api/push/send` -- sends a notification to all subscriptions; automatically removes expired subscriptions (HTTP 410/404 responses from push services).
- `GET /api/push/vapid-public-key` -- returns the public VAPID key for client-side subscription.
