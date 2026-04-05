---
title: First Conversation
---

# Your First Conversation

After onboarding, you're in the chat. This is where everything happens — your agent builds, debugs, and evolves your workspace through conversation.

## Start with something real

Don't start small. Bloby handles full features end-to-end. Try:

- *"Build me a personal contacts CRM with tags, search, and import from CSV"*
- *"Create a habit tracker with streaks and a weekly overview chart"*
- *"I want a finance dashboard — let me log expenses and see monthly breakdowns"*

Bloby builds the frontend UI, creates the backend API routes, sets up the database tables, and wires everything together. You'll see your workspace update in real time.

## Keep going

Once a feature exists, refine it. This is where the vibe coding magic happens:

- *"Add a dark mode toggle to the whole app"*
- *"The contacts list should show the most recent first"*
- *"Add an export to CSV button on the habits page"*
- *"I need a quick calorie counter too — add it to the sidebar"*

Every conversation changes real, working code. Your workspace grows with each request.

## Talk to it from your phone

Open the PWA on your phone and send a voice message: "Hey, add a notes section to the dashboard." Bloby transcribes it with Whisper and gets to work. It's like talking to your codebase.

## What happens behind the scenes

When you send a message:

1. Your message goes to the AI model (Claude or OpenAI)
2. The agent reads your workspace files to understand context
3. It writes code — edits files, creates new ones, runs commands
4. The dashboard hot-reloads automatically
5. If backend code changed, the server restarts

The chat shows what tools the agent is using in real time. And because the chat is sandboxed in an iframe, it never goes down — even if the agent accidentally breaks something.

## Tips

- Be specific when you can. "Add a contacts page" is good. "Add a contacts page with name, email, phone, and tags" is better.
- Bloby remembers context within a session. Refer back to what you just built.
- If something breaks, just tell Bloby. The chat always works, and the agent can debug and fix its own code.
- Send voice messages from your phone if you set up Whisper during onboarding.
- Think big — the workspace can hold many features. A CRM, a tracker, a research log, mini tools. All in one place.
