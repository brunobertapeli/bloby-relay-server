---
title: "Password Hashing"
---

Portal passwords are hashed with Node.js `crypto.scryptSync`:

- **Salt**: 16 random bytes, hex-encoded (32 hex chars).
- **Hash**: scrypt with the salt, output length 64 bytes, hex-encoded
  (128 hex chars).
- **Storage format**: `<salt>:<hash>` (e.g. `a1b2...c3d4:e5f6...7890`).

Verification re-derives the hash from the candidate password and the stored
salt, then compares with timing-safe string equality (JavaScript `===` on
hex strings).
