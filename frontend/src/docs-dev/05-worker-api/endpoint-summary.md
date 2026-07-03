---
title: "Endpoint Summary"
---

Auth is secure by default. Once a portal password is set, the supervisor
requires a valid portal session token (`Authorization: Bearer <token>`) for
every `/api` route except a small pre-login allowlist (marked **Public**
below). Some portal endpoints add their own in-handler checks on top; those
are noted explicitly. Internal supervisor calls bypass the gate with a
per-process `x-internal` secret.

| Method | Path | Category | Auth |
|---|---|---|---|
| GET | `/api/health` | Health | Public |
| GET | `/api/conversations` | Conversations | Bearer |
| GET | `/api/conversations/:id` | Conversations | Bearer |
| POST | `/api/conversations` | Conversations | Bearer |
| DELETE | `/api/conversations/:id` | Conversations | Bearer |
| POST | `/api/conversations/:id/messages` | Messages | Bearer |
| GET | `/api/conversations/:id/messages` | Messages | Bearer |
| GET | `/api/conversations/:id/messages/recent` | Messages | Bearer |
| GET | `/api/settings` | Settings | Public (secrets stripped) |
| PUT | `/api/settings/:key` | Settings | Bearer |
| GET | `/api/context/current` | Context | Bearer |
| POST | `/api/context/set` | Context | Bearer |
| POST | `/api/context/clear` | Context | Bearer |
| POST | `/api/portal/login` | Auth | Public (password in body) |
| GET | `/api/portal/login` | Auth | Public (Basic header) |
| POST | `/api/portal/validate-token` | Auth | Public |
| GET | `/api/portal/validate-token` | Auth | Public |
| POST | `/api/portal/verify-password` | Auth | Public |
| GET | `/api/portal/totp/status` | TOTP | Public |
| POST | `/api/portal/totp/setup` | TOTP | Bearer / Password / first-run |
| POST | `/api/portal/totp/verify-setup` | TOTP | Bearer / Password / first-run |
| POST | `/api/portal/totp/disable` | TOTP | Password + TOTP |
| GET | `/api/portal/login/totp` | TOTP | Pending Token |
| GET | `/api/portal/devices` | Devices | Bearer |
| DELETE | `/api/portal/devices/:id` | Devices | Bearer |
| POST | `/api/portal/devices/revoke` | Devices | Bearer |
| GET | `/api/onboard/status` | Onboarding | Public |
| POST | `/api/onboard` | Onboarding | Open on first run, then Bearer |
| GET | `/api/handle/check/:username` | Handle | Public |
| GET | `/api/handle/status` | Handle | Public |
| POST | `/api/handle/register` | Handle | Bearer |
| POST | `/api/handle/change` | Handle | Bearer |
| POST | `/api/handle/claim-reserved` | Handle | Bearer |
| GET | `/api/wallet/balance` | Wallet | Bearer |
| POST | `/api/auth/codex/start` | Codex OAuth | Public |
| POST | `/api/auth/codex/exchange` | Codex OAuth | Public |
| POST | `/api/auth/codex/cancel` | Codex OAuth | Public |
| GET | `/api/auth/codex/status` | Codex OAuth | Public |
| POST | `/api/auth/codex/device/start` | Codex OAuth | Public |
| GET | `/api/auth/codex/device/status` | Codex OAuth | Public |
| POST | `/api/auth/codex/device/cancel` | Codex OAuth | Public |
| POST | `/api/auth/claude/start` | Claude OAuth | Public |
| POST | `/api/auth/claude/exchange` | Claude OAuth | Public |
| GET | `/api/auth/claude/status` | Claude OAuth | Public |
| GET | `/api/auth/pi/providers` | Pi Providers | Public |
| GET | `/api/auth/pi/status` | Pi Providers | Public |
| POST | `/api/auth/pi/test` | Pi Providers | Public |
| POST | `/api/auth/pi/save` | Pi Providers | Public |
| DELETE | `/api/auth/pi` | Pi Providers | Public |
| POST | `/api/auth/pi/completion` | Pi Providers | Public |
| GET | `/api/push/vapid-public-key` | Push | Public |
| POST | `/api/push/subscribe` | Push | Bearer |
| DELETE | `/api/push/unsubscribe` | Push | Bearer |
| POST | `/api/push/send` | Push | Bearer |
| GET | `/api/push/status` | Push | Bearer |
| POST | `/api/whisper/transcribe` | Whisper | Bearer |
| GET | `/api/files/*` | Static Files | Bearer |
