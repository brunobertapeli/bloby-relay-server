---
title: "Error Handling"
---

### HTTP Status Codes

| Code | Usage |
|---|---|
| `200` | Success (all successful responses) |
| `400` | Bad Request -- missing/invalid parameters, invalid state |
| `401` | Unauthorized -- missing/invalid portal token (supervisor auth gate), wrong password, invalid TOTP code, expired session |
| `500` | Internal Server Error -- QR code generation failure, VAPID key issues, transcription failure |
| `502` | Bad Gateway -- upstream API error (Whisper API) |

### Error Response Format

All errors follow a consistent JSON shape:

```json
{ "error": "Human-readable error message" }
```

Some endpoints use `{ "success": false, "error": "..." }` instead (notably
the OAuth endpoints). A few endpoints return `{ "valid": false }` or
`{ "valid": false, "error": "..." }` (the password/token verification
endpoints).

### Unhandled Routes

The Worker app has no catch-all 404 handler. An `/api` request that clears
the supervisor's auth gate but matches no route gets Express's default HTML
404. (When a password is set, an unknown route that is not on the public
allowlist is rejected earlier with a `401` JSON body by the gate.)

### Process-Level Cleanup

The Worker runs inside the supervisor process, so cleanup is the
supervisor's shutdown handler. On `SIGINT` or `SIGTERM` it disconnects
channels, stops the scheduler and user backend, closes the SQLite database
(`closeDb()`), closes the relay carrier socket and HTTP server, then exits
with code 0 (with a 5-second hard-exit deadline so a hung teardown step can
never block shutdown).
