---
title: "Endpoint Summary"
---

| Method | Path | Category | Auth |
|---|---|---|---|
| GET | `/api/health` | Health | None |
| GET | `/api/conversations` | Conversations | None |
| GET | `/api/conversations/:id` | Conversations | None |
| POST | `/api/conversations` | Conversations | None |
| DELETE | `/api/conversations/:id` | Conversations | None |
| POST | `/api/conversations/:id/messages` | Messages | None |
| GET | `/api/conversations/:id/messages` | Messages | None |
| GET | `/api/conversations/:id/messages/recent` | Messages | None |
| GET | `/api/settings` | Settings | None |
| PUT | `/api/settings/:key` | Settings | None |
| GET | `/api/context/current` | Context | None |
| POST | `/api/context/set` | Context | None |
| POST | `/api/context/clear` | Context | None |
| POST | `/api/portal/login` | Auth | Password |
| GET | `/api/portal/login` | Auth | Basic |
| POST | `/api/portal/validate-token` | Auth | None |
| GET | `/api/portal/validate-token` | Auth | None |
| POST | `/api/portal/verify-password` | Auth | None |
| GET | `/api/portal/totp/status` | TOTP | None |
| POST | `/api/portal/totp/setup` | TOTP | Bearer/Password |
| POST | `/api/portal/totp/verify-setup` | TOTP | Bearer/Password |
| POST | `/api/portal/totp/disable` | TOTP | Password + TOTP |
| GET | `/api/portal/login/totp` | TOTP | Pending Token |
| GET | `/api/portal/devices` | Devices | None |
| DELETE | `/api/portal/devices/:id` | Devices | None |
| POST | `/api/portal/devices/revoke` | Devices | None |
| GET | `/api/onboard/status` | Onboarding | None |
| POST | `/api/onboard` | Onboarding | None |
| GET | `/api/handle/check/:username` | Handle | None |
| GET | `/api/handle/status` | Handle | None |
| POST | `/api/handle/register` | Handle | None |
| POST | `/api/handle/change` | Handle | None |
| POST | `/api/auth/codex/start` | Codex OAuth | None |
| POST | `/api/auth/codex/cancel` | Codex OAuth | None |
| GET | `/api/auth/codex/status` | Codex OAuth | None |
| POST | `/api/auth/claude/start` | Claude OAuth | None |
| POST | `/api/auth/claude/exchange` | Claude OAuth | None |
| GET | `/api/auth/claude/status` | Claude OAuth | None |
| GET | `/api/push/vapid-public-key` | Push | None |
| POST | `/api/push/subscribe` | Push | None |
| DELETE | `/api/push/unsubscribe` | Push | None |
| POST | `/api/push/send` | Push | None |
| GET | `/api/push/status` | Push | None |
| POST | `/api/whisper/transcribe` | Whisper | None |
| GET | `/api/files/*` | Static Files | None |
