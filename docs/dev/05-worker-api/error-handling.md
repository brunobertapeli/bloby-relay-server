---
title: "Error Handling"
---

### HTTP Status Codes

| Code | Usage |
|---|---|
| `200` | Success (all successful responses) |
| `400` | Bad Request -- missing/invalid parameters, invalid state |
| `401` | Unauthorized -- wrong password, invalid TOTP code, expired session |
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

There is no catch-all 404 handler. Express returns its default HTML 404
for unmatched routes.

### Process-Level Cleanup

On `SIGTERM`, the process closes the SQLite database and the HTTP server,
then exits with code 0.
