---
title: First Conversation
---

# Your First Conversation

After onboarding, you're in the chat. This is where everything happens. Your agent builds, debugs, and evolves your workspace through conversation.

## Start with something real

Don't start small. Morphy handles full features end-to-end. Try:

- *"Build me a personal contacts CRM with tags, search, and import from CSV"*
- *"Create a habit tracker with streaks and a weekly overview chart"*
- *"I want a finance dashboard. Let me log expenses and see monthly breakdowns"*

Morphy builds the frontend UI, creates the backend API routes, sets up the database tables, and wires everything together. You'll see your workspace update in real time.

## Keep going

Once a feature exists, refine it:

- *"Add a dark mode toggle to the whole app"*
- *"The contacts list should show the most recent first"*
- *"Add an export to CSV button on the habits page"*
- *"I need a quick calorie counter too. Add it to the sidebar"*

Every conversation changes real, working code. Your workspace grows with each request.

## Talk to it from your phone

Open the PWA on your phone and send a voice message: "Hey, add a notes section to the dashboard." Voice input works out of the box using your browser's built-in speech recognition. If you enabled Whisper during onboarding, Morphy transcribes with that instead for better accuracy. Either way, it's like talking to your codebase.

You can also attach or paste images with a message. Send a screenshot of a bug or a design you like, and Morphy compresses it automatically before passing it to the model.

## What happens behind the scenes

When you send a message:

1. Your message goes to your AI provider (Claude, Codex, or Pi if you brought your own model)
2. The agent reads your workspace files to understand context
3. It writes code: edits files, creates new ones, runs commands
4. Your workspace hot-reloads automatically
5. If backend code changed, the server restarts

The chat shows what tools the agent is using in real time. And the chat lives in its own shell, outside the frame that hosts your workspace, so it never goes down. Reloads, rebuilds, and crashes stay inside the workspace frame, even if the agent accidentally breaks something.

## Tips

- Be specific when you can. "Add a contacts page" is good. "Add a contacts page with name, email, phone, and tags" is better.
- Morphy remembers context within a session. Refer back to what you just built.
- If something breaks, just tell Morphy. The chat always works, and the agent can debug and fix its own code.
- Voice works without any setup in most browsers. Enable Whisper during onboarding if you want more accurate transcription.
- Attach a screenshot when words aren't enough. A picture of a broken layout beats a paragraph describing it.
- Think big. The workspace can hold many features. A CRM, a tracker, a research log, mini tools. All in one place.
