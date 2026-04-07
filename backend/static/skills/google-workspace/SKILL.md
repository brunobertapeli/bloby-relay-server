# Google Workspace

## What This Is

Connects the agent to the user's Google account via OAuth 2.0. After setup, the agent can read/send emails, manage calendar events, browse Drive, edit Sheets and Docs — all through the `gws` CLI tool.

This is a **setup skill** — it doesn't add UI to the workspace. It configures an external tool (`@googleworkspace/cli`) and handles the OAuth flow that normally requires a browser on the same machine. Since Bloby is self-hosted (Raspberry Pi, Mac Mini, VPS), the standard localhost callback won't work — so the agent acts as the OAuth middleman.

---

## Setup Flow

The setup is a **conversational flow** — no UI wizard. The agent guides the user through 7 turns of chat. The user only needs to do two things in the Google Cloud Console (unavoidable — it's their Google account). Everything else is agent-handled.

### Turn 1 — Introduce and explain

Tell the user what's happening and what they need to do on their side. Send this message (adapt tone to your personality):

> **Connecting Google Workspace**
>
> I'm going to connect to your Google account so I can help with email, calendar, drive, and more. There's a one-time setup where you create a small project in Google Cloud Console — takes about 5 minutes.
>
> Here's what to do:
>
> 1. Go to [console.cloud.google.com](https://console.cloud.google.com)
> 2. Create a new project (name it anything, like "Bloby")
> 3. Go to **APIs & Services → OAuth consent screen**
>    - Choose **External** → Create
>    - Fill in app name (anything), your email for support and developer contact
>    - Skip scopes — just Save and Continue
>    - **Important: Add yourself as a Test User** (your Google email) — without this you'll get "Access blocked"
>    - Save and finish
> 4. Go to **APIs & Services → Credentials**
>    - Click **+ Create Credentials → OAuth client ID**
>    - Application type: **Desktop app** (not Web!)
>    - Create → **Download the JSON file**
>
> If you need help, here's a short video walkthrough: [How to get Google credentials](https://youtu.be/kHId5vcgqsI)
>
> When you have the JSON file, **paste its contents here** in chat.

**Do NOT proceed until the user sends the JSON contents.** Wait for their response.

---

### Turn 2 — User sends JSON

The user pastes the contents of their `client_secret.json`. It looks like this:

```json
{"installed":{"client_id":"XXXX.apps.googleusercontent.com","project_id":"my-project","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","client_secret":"GOCSPX-XXXX",...}}
```

**What to do:**

1. Validate the JSON — check it has `installed.client_id` and `installed.client_secret`. If it has `web` instead of `installed`, tell the user: "Looks like you created a **Web** client instead of **Desktop**. Go back to Credentials, delete this one, and create a new OAuth client ID with type **Desktop app**."

2. Write the file:
   ```bash
   mkdir -p ~/.config/gws
   ```
   Then write the JSON to `~/.config/gws/client_secret.json` using the Write tool.

3. Extract and save these values (you'll need them):
   - `client_id` — from `installed.client_id`
   - `client_secret` — from `installed.client_secret`
   - `project_id` — from `installed.project_id`

4. Install the CLI silently:
   ```bash
   npm install -g @googleworkspace/cli
   ```

5. Ask the user which services they want. Send:

> Got it! Now, which Google services do you want me to access?
>
> - **Gmail** — read, send, and manage emails
> - **Calendar** — view and create events
> - **Drive** — browse and manage files
> - **Sheets** — read and edit spreadsheets
> - **Docs** — read and edit documents
>
> I'd recommend at least **Gmail + Calendar + Drive** to start. You can always add more later. Which ones?

---

### Turn 3 — User picks services

The user says something like "gmail and calendar", "all of them", "just email", etc.

**Parse their selection** and map to scopes using this table:

| Service | Scope |
|---------|-------|
| Gmail | `https://www.googleapis.com/auth/gmail.modify` |
| Calendar | `https://www.googleapis.com/auth/calendar` |
| Drive | `https://www.googleapis.com/auth/drive` |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Docs | `https://www.googleapis.com/auth/documents` |

**Build the OAuth URL:**

```
https://accounts.google.com/o/oauth2/auth?client_id={client_id}&redirect_uri=http://localhost&response_type=code&scope={scopes_space_separated_and_url_encoded}&access_type=offline&prompt=consent
```

- `redirect_uri` is always `http://localhost` (no port, no path)
- `access_type=offline` is required to get a refresh token
- `prompt=consent` forces the consent screen so we always get a refresh token
- Scopes are space-separated, then URL-encoded (spaces become `%20`)

**Send the auth link and instructions:**

> Click this link to authorize:
>
> 👉 [Authorize Google]({auth_url})
>
> **What will happen:**
> 1. Pick your Google account
> 2. You'll see "Google hasn't verified this app" — click **Advanced → Go to [app name] (unsafe)** (this is normal for personal apps)
> 3. Grant the permissions
> 4. The page won't load — that's expected!
> 5. Copy the **full URL** from your browser's address bar and paste it here
>
> The URL will look like: `http://localhost/?code=4/0Abc...&scope=...`

---

### Turn 4 — User pastes redirect URL

The user pastes something like:
```
http://localhost/?code=4/0Aci98E8ZWkxZOq9oJSDevr54SXUaYYrEPbclLa2TJvsjv91W__t2sLFHh_6-0hVGxtF_wA&scope=...
```

**What to do:**

1. Extract the `code` parameter from the URL. Handle URL-encoded characters — decode `%2F` to `/` etc.

2. Exchange the code for tokens:
   ```bash
   curl -s -X POST https://oauth2.googleapis.com/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "code={code}&client_id={client_id}&client_secret={client_secret}&redirect_uri=http://localhost&grant_type=authorization_code"
   ```

3. The response will contain:
   ```json
   {
     "access_token": "ya29.XXXX",
     "expires_in": 3599,
     "refresh_token": "1//0XXXX",
     "scope": "...",
     "token_type": "Bearer"
   }
   ```

4. **Verify you got a `refresh_token`.** If it's missing, the user may have already authorized this app before. Tell them to go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions), remove the app, and redo the auth step.

5. Write the credentials file that the `gws` CLI expects:
   ```bash
   # Write to ~/.config/gws/credentials.json
   ```

   Format:
   ```json
   {
     "type": "authorized_user",
     "client_id": "{client_id}",
     "client_secret": "{client_secret}",
     "refresh_token": "{refresh_token}"
   }
   ```

   Use the Write tool to create `~/.config/gws/credentials.json`.

6. **Test the connection.** Run a real API call for one of the selected services:

   - If Gmail was selected:
     ```bash
     gws gmail users.messages.list --userId me --maxResults 1
     ```
   - If Calendar was selected:
     ```bash
     gws calendar events.list --calendarId primary --maxResults 1
     ```
   - If Drive was selected:
     ```bash
     gws drive files.list --pageSize 1
     ```

7. **Handle test results:**

   - **Success** — the command returns data. Proceed to the final message.
   - **403 "API not enabled"** — this is expected. The APIs need to be enabled in GCP. Proceed to the final message where you show enable links.
   - **401 "Invalid credentials"** — token exchange failed. Re-check the credentials.json contents. Try refreshing the token manually.

8. **Send the final message:**

   > ✅ **Connected!**
   >
   > {If test succeeded: "I just checked — your [service] is working. [Show a real result, like an email subject or calendar event name.]"}
   >
   > {If 403: "The connection is set up, but the APIs need to be enabled in your Google Cloud Console. Click each link below — just hit **Enable** on each page:"}
   >
   > {Only show links for selected services:}
   > - [Enable Gmail API](https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project={project_id})
   > - [Enable Calendar API](https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project={project_id})
   > - [Enable Drive API](https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project={project_id})
   > - [Enable Sheets API](https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project={project_id})
   > - [Enable Docs API](https://console.developers.google.com/apis/api/docs.googleapis.com/overview?project={project_id})
   >
   > Once enabled, I can start working with your Google data. Try asking me to read your latest emails or check your calendar!

---

## API Enable URLs Reference

Each service has a specific API that must be enabled in GCP. The URL format is:

```
https://console.developers.google.com/apis/api/{api_name}/overview?project={project_id}
```

| Service | API name for URL |
|---------|-----------------|
| Gmail | `gmail.googleapis.com` |
| Calendar | `calendar-json.googleapis.com` |
| Drive | `drive.googleapis.com` |
| Sheets | `sheets.googleapis.com` |
| Docs | `docs.googleapis.com` |

---

## Post-Setup: What the Agent Can Do

Once connected, use the `gws` CLI for Google operations. Common commands:

### Gmail
```bash
# List recent messages
gws gmail users.messages.list --userId me --maxResults 10

# Read a specific message
gws gmail users.messages.get --userId me --id {messageId} --format full

# Search emails
gws gmail users.messages.list --userId me --q "from:someone@example.com subject:invoice"

# Helper shortcuts
gws +triage          # inbox triage
gws +read {id}       # read a message
gws +send --to x@y.com --subject "Hi" --body "Hello"
gws +reply {id} --body "Thanks!"
```

### Calendar
```bash
# List upcoming events
gws calendar events.list --calendarId primary --timeMin {ISO_DATE} --maxResults 10 --singleEvents true --orderBy startTime

# Create an event
gws calendar events.insert --calendarId primary --requestBody '{"summary":"Meeting","start":{"dateTime":"2026-04-07T10:00:00-03:00"},"end":{"dateTime":"2026-04-07T11:00:00-03:00"}}'

# Helper
gws +agenda          # today's agenda
```

### Drive
```bash
# List files
gws drive files.list --pageSize 20

# Search files
gws drive files.list --q "name contains 'report'"
```

### Sheets
```bash
# Read a range
gws sheets spreadsheets.values.get --spreadsheetId {id} --range "Sheet1!A1:D10"

# Write to a range
gws sheets spreadsheets.values.update --spreadsheetId {id} --range "Sheet1!A1" --valueInputOption USER_ENTERED --requestBody '{"values":[["Hello","World"]]}'
```

### Docs
```bash
# Get document content
gws docs documents.get --documentId {id}
```

---

## Token Refresh & Re-Auth

Google access tokens expire every **1 hour**. The `gws` CLI handles refresh automatically using the `refresh_token` in `credentials.json`.

However, refresh tokens can expire too:
- **Testing mode apps** (unverified): refresh tokens expire after **7 days of inactivity**
- **Published apps**: refresh tokens last until revoked

### If a `gws` command fails with 401/403 auth error:

1. Try a manual token refresh:
   ```bash
   curl -s -X POST https://oauth2.googleapis.com/token \
     -d "client_id={client_id}&client_secret={client_secret}&refresh_token={refresh_token}&grant_type=refresh_token"
   ```

2. If the refresh also fails, the user needs to re-authorize. Run a mini re-auth flow:
   - Read `~/.config/gws/client_secret.json` to get `client_id` and `client_secret`
   - Build a new auth URL (same as Turn 3)
   - Tell the user: "Your Google connection expired — click this link to reconnect" and show the auth link
   - When they paste the redirect URL, exchange and write new credentials (same as Turn 4)

### Proactive tip

If the user's app is in "testing" mode and they use Google services infrequently, the 7-day expiry will be annoying. Suggest they publish the app (in GCP Console → OAuth consent screen → Publish App). For personal use, Google doesn't actually review it — publishing just removes the testing restrictions.

---

## Save to Memory

After setup completes, save to the agent's `MEMORY.md`:

```markdown
## Google Workspace
- Connected on {date}
- Services: {list of enabled services}
- GCP Project ID: {project_id}
- Client credentials: ~/.config/gws/client_secret.json
- Auth tokens: ~/.config/gws/credentials.json
- CLI: @googleworkspace/cli (installed globally)
- Token refresh: automatic via gws CLI. If 401 errors, re-auth needed (see skills/google-workspace/SKILL.md)
```

Also log the setup in today's daily notes (`memory/{date}.md`).

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Access blocked" during auth | User not added as test user | Go to OAuth consent screen → Test users → Add their email |
| `redirect_uri_mismatch` | Created Web client instead of Desktop | Delete credential, create new one as Desktop app |
| No `refresh_token` in response | App was previously authorized | User goes to [myaccount.google.com/permissions](https://myaccount.google.com/permissions), removes the app, redo auth |
| 403 "API not enabled" | API not turned on in GCP | Click the Enable link for that specific API |
| 401 after days of working | Refresh token expired (testing mode) | Re-auth flow, or publish the app |
| Too many scopes error | Over 25 scopes in testing mode | Only select needed services |
| `gws` command not found | CLI not installed | `npm install -g @googleworkspace/cli` |

---

## Cleanup

This skill should **NOT** be archived after setup. It stays in `skills/google-workspace/` as a reference for:
- Re-auth flow when tokens expire
- Adding new services later (re-run auth with additional scopes)
- Troubleshooting
- Post-setup command reference
