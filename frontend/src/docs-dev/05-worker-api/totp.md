---
title: "TOTP Implementation"
---

- **Algorithm**: SHA1
- **Digits**: 6
- **Period**: 30 seconds
- **Window**: 1 (accepts current step plus/minus one)
- **Secret generation**: 20 random bytes, encoded as base64url, filtered to
  keep only characters in `[A-Z2-7]` (base32 alphabet), truncated to 32
  characters.
- **Recovery codes**: 8 codes, each 4 random bytes hex-encoded (8 hex
  characters). Stored as SHA-256 hashes. One-time use; consumed codes are
  removed from the array.
- **Library**: `otpauth` (`TOTP` class).
