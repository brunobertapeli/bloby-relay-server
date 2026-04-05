import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HiBars3, HiXMark, HiChevronRight, HiEllipsisVertical, HiChevronUpDown } from 'react-icons/hi2'
import { FaGithub, FaDiscord, FaCopy, FaCheck, FaLink } from 'react-icons/fa'

// Load all markdown files at build time
const userMdModules = import.meta.glob('../docs/**/*.md', { eager: true, query: '?raw', import: 'default' })
const devMdModules = import.meta.glob('../docs-dev/**/*.md', { eager: true, query: '?raw', import: 'default' })

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\n*/, '')
}

function buildDocsMap(modules) {
  const map = {}
  for (const [path, content] of Object.entries(modules)) {
    const slug = path.split('/').pop().replace('.md', '')
    map[slug] = stripFrontmatter(content)
  }
  return map
}

const userDocs = buildDocsMap(userMdModules)
const devDocs = buildDocsMap(devMdModules)

const docSets = {
  user: {
    label: 'User Guide',
    defaultSlug: 'introduction',
    docs: userDocs,
    sections: [
      {
        group: 'Getting Started',
        items: [
          { slug: 'introduction', title: 'Introduction' },
          { slug: 'installation', title: 'Installation' },
          { slug: 'setup', title: 'Setup (bloby init)' },
          { slug: 'onboarding', title: 'Onboarding Wizard' },
          { slug: 'first-conversation', title: 'First Conversation' },
        ],
      },
      {
        group: 'Core Concepts',
        items: [
          { slug: 'workspace', title: 'The Workspace' },
          { slug: 'chat', title: 'Chat Bubble' },
          { slug: 'memory', title: 'Memory System' },
          { slug: 'pulse-crons', title: 'Pulse & Scheduled Tasks' },
          { slug: 'pwa', title: 'PWA & Mobile' },
        ],
      },
      {
        group: 'Connectivity',
        items: [
          { slug: 'tunnels', title: 'Tunnels & Remote Access' },
          { slug: 'relay', title: 'Bloby Relay' },
        ],
      },
      {
        group: 'Guides',
        items: [
          { slug: 'cli', title: 'CLI Commands' },
          { slug: 'daemon', title: 'Daemon & Auto-Start' },
          { slug: 'configuration', title: 'Configuration' },
          { slug: 'models', title: 'AI Models' },
          { slug: 'skills', title: 'Skills & Plugins' },
        ],
      },
      {
        group: 'Community',
        items: [
          { slug: 'contributing', title: 'Contributing' },
          { slug: 'faq', title: 'FAQ' },
        ],
      },
    ],
  },
  dev: {
    label: 'Developer Docs',
    defaultSlug: 'documentation-index',
    docs: devDocs,
    sections: [
      {
        group: 'Getting Started',
        items: [
          { slug: 'documentation-index', title: 'Documentation Index' },
          { slug: 'reading-order', title: 'Reading Order' },
          { slug: 'quick-reference', title: 'Quick Reference' },
        ],
      },
      {
        group: 'Architecture Overview',
        items: [
          { slug: 'system-overview', title: 'System Overview' },
          { slug: 'high-level-architecture', title: 'High-Level Architecture' },
          { slug: 'process-lifecycle', title: 'Process Lifecycle' },
          { slug: 'request-flow', title: 'Request Flow' },
          { slug: 'data-flow', title: 'Data Flow' },
          { slug: 'design-decisions', title: 'Design Decisions' },
          { slug: 'external-services', title: 'External Services' },
          { slug: 'glossary', title: 'Glossary' },
        ],
      },
      {
        group: 'Project Structure',
        items: [
          { slug: 'root-directory', title: 'Root Directory' },
          { slug: 'directory-tree', title: 'Directory Tree' },
          { slug: 'configuration-files', title: 'Configuration Files' },
          { slug: 'path-aliases', title: 'Path Aliases' },
          { slug: 'port-allocation', title: 'Port Allocation' },
          { slug: 'npm-scripts', title: 'npm Scripts' },
          { slug: 'key-dependencies', title: 'Key Dependencies' },
        ],
      },
      {
        group: 'Tech Stack',
        items: [
          { slug: 'core-framework', title: 'Core Framework' },
          { slug: 'frontend-stack', title: 'Frontend Stack' },
          { slug: 'backend-stack', title: 'Backend Stack' },
          { slug: 'ai-integration', title: 'AI Integration' },
          { slug: 'build-tools', title: 'Build Tools' },
          { slug: 'dependency-table', title: 'Dependency Table' },
        ],
      },
      {
        group: 'Supervisor',
        items: [
          { slug: 'role', title: 'Role' },
          { slug: 'http-server', title: 'HTTP Server' },
          { slug: 'reverse-proxy', title: 'Reverse Proxy' },
          { slug: 'process-management', title: 'Process Management' },
          { slug: 'file-watcher', title: 'File Watcher' },
          { slug: 'file-saving', title: 'File Saving' },
          { slug: 'websocket', title: 'WebSocket' },
          { slug: 'startup', title: 'Startup' },
          { slug: 'shutdown', title: 'Shutdown' },
        ],
      },
      {
        group: 'Worker API',
        items: [
          { slug: 'api-endpoints', title: 'API Endpoints' },
          { slug: 'middleware', title: 'Middleware' },
          { slug: 'database-schema', title: 'Database Schema' },
          { slug: 'oauth-flows', title: 'OAuth Flows' },
          { slug: 'error-handling', title: 'Error Handling' },
          { slug: 'endpoint-summary', title: 'Endpoint Summary' },
        ],
      },
      {
        group: 'Agent System',
        items: [
          { slug: 'architecture', title: 'Architecture' },
          { slug: 'system-prompt', title: 'System Prompt' },
          { slug: 'multi-provider', title: 'Multi-Provider' },
          { slug: 'agent-tools', title: 'Agent Tools' },
          { slug: 'memory-system', title: 'Memory System' },
          { slug: 'conversation-flow', title: 'Conversation Flow' },
          { slug: 'agent-autonomy', title: 'Agent Autonomy' },
        ],
      },
      {
        group: 'Database',
        items: [
          { slug: 'overview', title: 'Overview' },
          { slug: 'schema', title: 'Schema' },
          { slug: 'crud-operations', title: 'CRUD Operations' },
          { slug: 'query-patterns', title: 'Query Patterns' },
          { slug: 'performance', title: 'Performance' },
        ],
      },
      {
        group: 'Auth & Security',
        items: [
          { slug: 'password-auth', title: 'Password Auth' },
          { slug: 'session-management', title: 'Session Management' },
          { slug: 'two-factor-auth', title: 'Two-Factor Auth' },
          { slug: 'oauth-pkce', title: 'OAuth PKCE' },
          { slug: 'web-push', title: 'Web Push' },
          { slug: 'security-considerations', title: 'Security Considerations' },
        ],
      },
      {
        group: 'Networking & Tunnels',
        items: [
          { slug: 'cloudflare-tunnel', title: 'Cloudflare Tunnel' },
          { slug: 'bloby-relay', title: 'Bloby Relay' },
          { slug: 'https-tls', title: 'HTTPS & TLS' },
        ],
      },
      {
        group: 'Development Setup',
        items: [
          { slug: 'prerequisites', title: 'Prerequisites' },
          { slug: 'getting-started', title: 'Getting Started' },
          { slug: 'running-dev', title: 'Running Dev' },
          { slug: 'building', title: 'Building' },
          { slug: 'debugging', title: 'Debugging' },
          { slug: 'dev-workflow', title: 'Dev Workflow' },
        ],
      },
      {
        group: 'Contributing',
        items: [
          { slug: 'coding-standards', title: 'Coding Standards' },
          { slug: 'making-changes', title: 'Making Changes' },
          { slug: 'testing', title: 'Testing' },
          { slug: 'pr-guidelines', title: 'PR Guidelines' },
        ],
      },
    ],
  },
}

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

function DocSetSwitcher({ currentSet, onSwitch }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative mb-5" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-white/[0.03] text-sm font-medium text-foreground hover:bg-white/[0.06] transition-colors duration-200"
      >
        <span>{docSets[currentSet].label}</span>
        <HiChevronUpDown className="w-4 h-4 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-border bg-card shadow-xl shadow-black/30 overflow-hidden z-30"
          >
            {Object.entries(docSets).map(([key, set]) => (
              <button
                key={key}
                onClick={() => { onSwitch(key); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-200 ${
                  currentSet === key
                    ? 'text-foreground bg-white/[0.06] font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                }`}
              >
                {set.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DocsNav({ currentSlug, onSelect, sections, currentSet, onSwitchSet, className = '' }) {
  return (
    <nav className={className}>
      <DocSetSwitcher currentSet={currentSet} onSwitch={onSwitchSet} />
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

  const currentSet = searchParams.get('set') || 'user'
  const set = docSets[currentSet] || docSets.user
  const currentSlug = searchParams.get('page') || set.defaultSlug
  const content = set.docs[currentSlug] || set.docs[set.defaultSlug] || ''

  const handleSelect = (slug) => {
    setSearchParams({ set: currentSet, page: slug })
    setSidebarOpen(false)
    window.scrollTo(0, 0)
  }

  const handleSwitchSet = (newSet) => {
    const newDefault = docSets[newSet].defaultSlug
    setSearchParams({ set: newSet, page: newDefault })
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

  const currentTitle = set.sections
    .flatMap(s => s.items)
    .find(i => i.slug === currentSlug)?.title || 'Docs'

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img src="/assets/images/bloby.png" alt="Bloby" className="h-8 w-auto" />
              <span className="text-lg font-bold font-display text-foreground">Bloby</span>
            </Link>
            <HiChevronRight className="w-4 h-4 text-muted-foreground/40 hidden sm:block" />
            <span className="text-sm text-muted-foreground hidden sm:block">Docs</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="https://discord.gg/QERDj3CBFj" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
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

      <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-2 px-4 h-11">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <HiBars3 className="w-4 h-4" />
            <span>Menu</span>
          </button>
          <HiChevronRight className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-sm text-foreground font-medium truncate">{currentTitle}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-[7.5rem] lg:pt-24 pb-16">
        <div className="flex gap-10">
          <aside className="hidden lg:block w-56 shrink-0 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
            <DocsNav
              currentSlug={currentSlug}
              onSelect={handleSelect}
              sections={set.sections}
              currentSet={currentSet}
              onSwitchSet={handleSwitchSet}
            />
          </aside>

          <motion.article
            key={`${currentSet}-${currentSlug}`}
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

      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-[280px] bg-background border-r border-border/50 p-6 overflow-y-auto"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold font-display text-foreground">Docs</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>
              <DocsNav
                currentSlug={currentSlug}
                onSelect={handleSelect}
                sections={set.sections}
                currentSet={currentSet}
                onSwitchSet={handleSwitchSet}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
