import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HiBars3, HiXMark, HiChevronRight, HiEllipsisVertical } from 'react-icons/hi2'
import { FaGithub, FaDiscord, FaCopy, FaCheck, FaLink } from 'react-icons/fa'

const sections = [
  {
    group: 'Getting Started',
    items: [
      { slug: 'introduction', title: 'Introduction' },
      { slug: 'installation', title: 'Installation' },
      { slug: 'first-conversation', title: 'First Conversation' },
    ],
  },
  {
    group: 'Core Concepts',
    items: [
      { slug: 'workspace', title: 'The Workspace' },
      { slug: 'chat', title: 'Chat Bubble' },
      { slug: 'memory', title: 'Memory System' },
      { slug: 'pwa', title: 'PWA & Mobile' },
    ],
  },
  {
    group: 'Guides',
    items: [
      { slug: 'self-hosting', title: 'Self-Hosting' },
      { slug: 'configuration', title: 'Configuration' },
      { slug: 'models', title: 'AI Models' },
    ],
  },
  {
    group: 'Community',
    items: [
      { slug: 'contributing', title: 'Contributing' },
      { slug: 'faq', title: 'FAQ' },
    ],
  },
]

const docs = {
  introduction: `
# Introduction

Welcome to Fluxy — an AI coding agent with its own workspace.

Fluxy pairs a powerful coding agent with a full-stack app you both share and evolve together. A CRM, a dashboard, a game, anything. It runs on your machine and you shape it the way you want.

## What makes Fluxy different

Most AI tools give you a chat window. Fluxy gives the agent an entire application — frontend, backend, and database — that it builds and evolves through conversation.

- **You talk, it builds.** Describe what you need and watch it appear.
- **One workspace, many features.** Every module lives together in a single codebase.
- **Runs locally.** Your data stays on your machine. No cloud required.
- **Open source.** Fork it, extend it, make it yours.

## How it works

You install Fluxy on your machine (or any server). It spins up a full-stack workspace and opens a chat bubble in the corner. You talk to it. It builds what you ask for. The workspace grows with every conversation.

That's it. No templates. No configuration. Just conversation.
`,

  installation: `
# Installation

Fluxy runs on macOS, Windows, and Linux. Pick your method:

## One-liner (macOS / Linux)

\`\`\`bash
curl -fsSL https://www.fluxy.bot/install | sh
\`\`\`

## Windows

\`\`\`powershell
iwr -useb https://www.fluxy.bot/install.ps1 | iex
\`\`\`

## npm

\`\`\`bash
npm i -g fluxy-bot
fluxy init
\`\`\`

## From source

\`\`\`bash
git clone https://github.com/fluxy-ai/fluxy.git
cd fluxy && npm install
npm run dev
\`\`\`

The installer handles Node.js and all dependencies automatically.

## Requirements

- **OS:** macOS, Windows 10+, or Linux
- **RAM:** 4GB minimum
- **Disk:** 500MB for the workspace
- **API Key:** You'll need a Claude or OpenAI API key

## After install

Run \`fluxy init\` and start talking. Your workspace is ready.
`,

  'first-conversation': `
# Your First Conversation

After installation, Fluxy opens your workspace with a chat bubble in the bottom-right corner. That's where everything starts.

## Say something

Try typing something like:

- *"Build me a personal contacts CRM with tags and search"*
- *"Create a habit tracker where I can log daily habits"*
- *"Add a simple notes app with categories"*

Fluxy will build the frontend UI, create the backend API routes, and set up the database tables. All in one go.

## Keep evolving

Once a feature exists, you can refine it:

- *"Add a dark mode toggle"*
- *"The contacts list should show the most recent first"*
- *"Add an export to CSV button on the habits page"*

Every conversation changes real, working code in your workspace.

## Tips

- Be specific when you can. "Add a contacts page" is good. "Add a contacts page with name, email, phone, and tags" is better.
- Fluxy remembers context within a session. You can refer back to what you just built.
- If something breaks, just tell Fluxy. It can debug and fix its own code.
`,

  workspace: `
# The Workspace

Your workspace is a full-stack application that you and Fluxy share. It has three layers:

## Frontend

A React app with Tailwind CSS. This is what you see in the browser — the UI, the pages, the components. Fluxy builds and modifies these when you ask for new features.

## Backend

An Express server that handles API routes, business logic, and talks to the database. When Fluxy creates a new feature, it wires up the backend automatically.

## Database

Persistent storage for your data. Contacts, notes, habits, whatever you're building — it all lives here.

## One codebase, many features

This is important: everything lives in a single workspace. When you ask for a CRM today and a finance tracker tomorrow, Fluxy adds them as modules — a sidebar icon, a new page, a dashboard card. They all coexist.

Don't think of it as "building apps." Think of it as growing a workspace.

## The chat bubble

The floating chat bubble in the bottom-right corner is your communication channel. It's sandboxed — completely isolated from the workspace itself. Fluxy can't accidentally break it, and modifications to the workspace won't affect it.
`,

  chat: `
# Chat Bubble

The chat bubble is how you and Fluxy communicate. It lives in the bottom-right corner of your workspace.

## How it works

The chat is rendered as an isolated iframe — think of it like a LiveChat widget. It's completely sandboxed from the rest of the workspace. This means:

- Fluxy can rebuild the entire workspace UI and the chat stays intact
- No CSS conflicts between the chat and your app
- The chat is always accessible, no matter what state the workspace is in

## What you can do in the chat

- Ask Fluxy to build new features
- Report bugs or issues
- Ask questions about your workspace
- Request changes to existing features
- Have Fluxy explain how something works

## The chat is the interface

There are no settings panels, no drag-and-drop builders, no configuration screens. The chat is how you control everything. If you want something changed, say it.
`,

  memory: `
# Memory System

Fluxy forgets everything between sessions. Files are the only thing that persists.

## How it works

When Fluxy wakes up, it reads a set of files to rebuild its understanding:

| File | Purpose |
|------|---------|
| \`FLUXY.md\` | Identity and operating manual |
| \`USER.md\` | Who you are — name, preferences |
| \`memory/YYYY-MM-DD.md\` | Daily notes — what happened recently |
| \`MEMORY.md\` | Long-term curated memory |

## Daily notes

As you work together, Fluxy logs what happened in daily note files. What was built, what broke, what decisions were made.

## Long-term memory

Periodically, Fluxy reviews its daily notes and distills the important stuff into \`MEMORY.md\`. Preferences, patterns, lessons learned. This is its curated self.

## You can help

If something is important, tell Fluxy to remember it. If something is wrong in its memory, tell it to forget. You can also edit these files directly.
`,

  pwa: `
# PWA & Mobile

Your Fluxy workspace is a Progressive Web App. You can install it on your phone or tablet and use it like a native app.

## Installing the PWA

1. Open your workspace URL in a mobile browser
2. Tap "Add to Home Screen" (Safari) or the install prompt (Chrome)
3. The workspace appears as an app on your device

## What this means

- Access your workspace from anywhere on your network
- The chat bubble works on mobile — talk to Fluxy from your phone
- Push notifications (when configured) for important updates
- Offline caching for faster loads

## Remote access

Since Fluxy runs on your machine (Mac Mini, VPS, etc.), you can access the workspace from any device on the same network. For external access, set up a reverse proxy or tunnel.
`,

  'self-hosting': `
# Self-Hosting

Fluxy is designed to run on your own hardware. No cloud account needed.

## Recommended setups

| Setup | Best for |
|-------|----------|
| **Mac Mini** | Always-on home server, great performance |
| **Raspberry Pi** | Low-power, always-on, budget friendly |
| **VPS** | Remote access from anywhere |
| **Desktop/Laptop** | Getting started, testing |

## Requirements

- Node.js 20+
- 4GB RAM minimum
- 500MB disk space
- An AI provider API key (Claude or OpenAI)

## Running as a service

To keep Fluxy running in the background:

\`\`\`bash
fluxy start --daemon
\`\`\`

Or use systemd, pm2, or any process manager you prefer.

## Networking

By default, Fluxy binds to \`localhost\`. To access from other devices:

\`\`\`bash
fluxy start --host 0.0.0.0
\`\`\`

For public access, put it behind a reverse proxy (nginx, Caddy) with HTTPS.
`,

  configuration: `
# Configuration

Fluxy works out of the box with sensible defaults. Here's what you can customize.

## Environment variables

Set these in your \`.env\` file:

| Variable | Description | Default |
|----------|-------------|---------|
| \`AI_PROVIDER\` | \`claude\` or \`openai\` | \`claude\` |
| \`AI_API_KEY\` | Your API key | — |
| \`AI_MODEL\` | Model to use | Provider default |
| \`PORT\` | Workspace port | \`3000\` |
| \`HOST\` | Bind address | \`localhost\` |

## FLUXY.md

This is the agent's identity file. You can edit it to change how Fluxy behaves — its personality, rules, and operating principles. See the Memory System docs for details.

## USER.md

Tell Fluxy about yourself. Your name, preferences, what you care about. The more it knows, the better it can help.
`,

  models: `
# AI Models

Fluxy supports multiple AI providers. The agent's capabilities depend on which model powers it.

## Supported providers

### Claude (Anthropic)

- **Claude Code** — Purpose-built for coding tasks. Recommended for Fluxy.
- Strong at reading and writing code across files
- Great at understanding project structure
- Excellent at debugging

### OpenAI

- **ChatGPT Codex** — OpenAI's coding-focused model
- Good at code generation
- Broad general knowledge

## Switching providers

Update your \`.env\` file:

\`\`\`bash
AI_PROVIDER=claude
AI_API_KEY=your-key-here
\`\`\`

Restart Fluxy after changing the provider.

## Which should you use?

Both work well. Claude Code tends to be more careful and thorough with file operations. Codex is faster for simple tasks. Try both and see what fits your workflow.
`,

  contributing: `
# Contributing

Fluxy is open source under the MIT license. Contributions are welcome.

## Getting started

\`\`\`bash
git clone https://github.com/fluxy-ai/fluxy.git
cd fluxy && npm install
npm run dev
\`\`\`

## How to contribute

- **Bug reports** — Open an issue on GitHub
- **Feature requests** — Open a discussion
- **Pull requests** — Fork, branch, submit
- **Documentation** — Help improve these docs

## Code structure

The workspace is the core abstraction. Everything Fluxy builds lives inside it. The chat interface is sandboxed and separate from the workspace.

## Community

Join the Discord to chat with other contributors and users.
`,

  faq: `
# FAQ

## Is Fluxy free?

Yes. Fluxy is open source and free to use. You'll need your own AI provider API key (Claude or OpenAI), which has its own costs.

## Does my data leave my machine?

Only the conversation goes to the AI provider's API. Your workspace files, database, and code stay local.

## Can Fluxy break my computer?

Fluxy operates within its workspace directory. It doesn't have access to your system files by default. That said, it does run commands — use it with the same caution you'd apply to any tool with terminal access.

## Can multiple people use the same workspace?

The workspace is designed for one human + one agent. Multi-user support is on the roadmap.

## What happens if Fluxy makes a mistake?

Tell it. Fluxy can read its own code, understand what went wrong, and fix it. You can also undo changes with git — the workspace is a git repository.

## Can I use Fluxy without coding knowledge?

Yes. That's the point. You describe what you want in plain English, and Fluxy builds it. You don't need to touch the code unless you want to.
`,
}

const defaultSlug = 'introduction'

function CopyDropdown({ markdown }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdown.trim())
    setCopied('md')
    setTimeout(() => { setCopied(null); setOpen(false) }, 1500)
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied('url')
    setTimeout(() => { setCopied(null); setOpen(false) }, 1500)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
      >
        <HiEllipsisVertical className="w-5 h-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card shadow-xl shadow-black/30 overflow-hidden z-20"
          >
            <button
              onClick={copyMarkdown}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors duration-200"
            >
              {copied === 'md' ? <FaCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FaCopy className="w-3.5 h-3.5" />}
              Copy as markdown
            </button>
            <button
              onClick={copyUrl}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors duration-200"
            >
              {copied === 'url' ? <FaCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FaLink className="w-3.5 h-3.5" />}
              Copy URL to your agent
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DocsNav({ currentSlug, onSelect, className = '' }) {
  return (
    <nav className={className}>
      {sections.map((section) => (
        <div key={section.group} className="mb-6">
          <h4 className="text-xs font-semibold font-display uppercase tracking-wider text-muted-foreground/50 mb-2 px-3">
            {section.group}
          </h4>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <button
                key={item.slug}
                onClick={() => onSelect(item.slug)}
                className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${
                  currentSlug === item.slug
                    ? 'text-foreground bg-white/[0.06] font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function Docs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentSlug = searchParams.get('page') || defaultSlug
  const content = docs[currentSlug] || docs[defaultSlug]

  const handleSelect = (slug) => {
    setSearchParams({ page: slug })
    setSidebarOpen(false)
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const currentTitle = sections
    .flatMap(s => s.items)
    .find(i => i.slug === currentSlug)?.title || 'Docs'

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-8 w-auto" />
              <span className="text-lg font-bold font-display text-foreground">Fluxy</span>
            </Link>
            <HiChevronRight className="w-4 h-4 text-muted-foreground/40 hidden sm:block" />
            <span className="text-sm text-muted-foreground hidden sm:block">Docs</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <FaDiscord className="w-[18px] h-[18px]" />
            </a>
            <a href="#" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <FaGithub className="w-[18px] h-[18px]" />
            </a>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground lg:hidden transition-colors duration-200"
            >
              <HiBars3 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="flex gap-10">
          <aside className="hidden lg:block w-56 shrink-0 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
            <DocsNav currentSlug={currentSlug} onSelect={handleSelect} />
          </aside>

          <motion.article
            key={currentSlug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 min-w-0 max-w-3xl prose-docs relative"
          >
            <div className="absolute top-0 right-0">
              <CopyDropdown markdown={content} />
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.trim()}
            </ReactMarkdown>
          </motion.article>
        </div>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-[280px] bg-background border-r border-border/50 p-6 overflow-y-auto"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
          >
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold font-display text-foreground">Docs</span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
            <DocsNav currentSlug={currentSlug} onSelect={handleSelect} />
          </motion.div>
        </div>
      )}
    </div>
  )
}
