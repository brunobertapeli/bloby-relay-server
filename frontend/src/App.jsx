import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import {
  FaTerminal, FaGithub, FaDiscord, FaBook,
  FaArrowRight, FaCopy, FaCheck
} from 'react-icons/fa'
import {
  HiSparkles, HiCpuChip, HiGlobeAlt,
  HiChatBubbleLeftRight, HiCommandLine,
  HiPuzzlePiece, HiBolt
} from 'react-icons/hi2'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  })
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
    >
      {copied ? <FaCheck className="w-4 h-4 text-emerald-400" /> : <FaCopy className="w-4 h-4" />}
    </button>
  )
}

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-8 w-8" />
          <span className="text-lg font-bold text-foreground">Fluxy</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Features</a>
          <a href="#quickstart" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Quick Start</a>
          <a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Integrations</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Docs</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="#" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
            <FaGithub className="w-5 h-5" />
          </a>
          <a href="#" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
            <FaDiscord className="w-5 h-5" />
          </a>
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 h-9 text-sm hidden sm:flex">
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 rounded-full px-4 py-1.5 text-sm font-medium">
            Now in Public Beta
          </Badge>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tight leading-[1.1] mb-6"
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
        >
          The AI that actually
          <br />
          <span className="text-primary">does things.</span>
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          initial="hidden" animate="visible" variants={fadeUp} custom={2}
        >
          Fluxy runs on your machine, connects to your favorite tools, and handles
          real tasks autonomously. No more copy-pasting between apps.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          initial="hidden" animate="visible" variants={fadeUp} custom={3}
        >
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 text-base gap-2 w-full sm:w-auto">
            Get Started Free <FaArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="rounded-full border-border hover:bg-white/5 text-foreground font-medium px-8 h-12 text-base gap-2 w-full sm:w-auto">
            <FaBook className="w-4 h-4" /> Read the Docs
          </Button>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible" variants={fadeUp} custom={4}
        >
          <Terminal />
        </motion.div>
      </div>
    </section>
  )
}

function Terminal() {
  const [activeTab, setActiveTab] = useState('npm')
  const tabs = [
    { id: 'oneliner', label: 'One-liner' },
    { id: 'npm', label: 'npm' },
    { id: 'hackable', label: 'Hackable' },
  ]

  const commands = {
    oneliner: [
      { comment: 'Install & run Fluxy in one line', command: 'curl -fsSL https://fluxy.bot/install | sh' },
    ],
    npm: [
      { comment: 'Install Fluxy', command: 'npm i -g fluxy' },
      { comment: 'Meet your new assistant', command: 'fluxy onboard' },
    ],
    hackable: [
      { comment: 'Clone the repo', command: 'git clone https://github.com/fluxy-ai/fluxy.git' },
      { comment: 'Install dependencies', command: 'cd fluxy && npm install' },
      { comment: 'Start Fluxy', command: 'npm start' },
    ],
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-[#1a1a1a] overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-[#1e1e1e]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>

          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full px-2 py-0">
              BETA
            </Badge>
          </div>
        </div>

        <div className="p-5 font-mono text-sm leading-relaxed">
          {commands[activeTab].map((line, i) => (
            <div key={i} className={i > 0 ? 'mt-4' : ''}>
              <div className="text-muted-foreground/50 text-xs mb-1"># {line.comment}</div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-primary">$</span>{' '}
                  <span className="text-foreground">{line.command}</span>
                </div>
                <CopyButton text={line.command} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-4 text-center">
        Works on macOS, Windows & Linux. The one-liner installs Node.js and everything else for you.
      </p>
    </div>
  )
}

function Features() {
  const features = [
    {
      icon: HiCpuChip,
      title: 'Runs locally',
      description: 'Fluxy runs on your machine. Your data stays with you. Mac, Windows, and Linux.'
    },
    {
      icon: HiChatBubbleLeftRight,
      title: 'Works where you chat',
      description: 'Connect through WhatsApp, Telegram, Slack, Discord, or any chat platform you already use.'
    },
    {
      icon: HiSparkles,
      title: 'Persistent memory',
      description: 'Fluxy remembers your preferences, past conversations, and context across sessions.'
    },
    {
      icon: HiGlobeAlt,
      title: 'Browser automation',
      description: 'Navigate websites, fill forms, extract data, and interact with web apps autonomously.'
    },
    {
      icon: HiCommandLine,
      title: 'Full system access',
      description: 'Read and write files, run shell commands, manage processes. Your assistant has real capabilities.'
    },
    {
      icon: HiPuzzlePiece,
      title: 'Extensible skills',
      description: 'Build custom skills or install community plugins. Fluxy adapts to your workflow.'
    },
  ]

  return (
    <section id="features" className="py-20 sm:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Everything you need, nothing you don't
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built for people who want an AI that goes beyond chat. Fluxy takes action.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={i}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function QuickStart() {
  const steps = [
    { step: '01', title: 'Install', description: 'One command. Takes 30 seconds. Works on any OS.' },
    { step: '02', title: 'Connect', description: 'Link your chat apps, calendar, email, and tools.' },
    { step: '03', title: 'Ask', description: 'Tell Fluxy what you need. It handles the rest.' },
  ]

  return (
    <section id="quickstart" className="py-20 sm:py-28 px-6 border-t border-border/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Up and running in minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No complicated setup. No API keys to manage. Just install and go.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              className="text-center"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={i}
            >
              <div className="text-5xl font-bold text-primary/20 mb-4">{item.step}</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Integrations() {
  const platforms = [
    'WhatsApp', 'Telegram', 'Slack', 'Discord',
    'Gmail', 'GitHub', 'Spotify', 'Notion',
    'Google Calendar', 'Obsidian', 'Linear', 'Figma'
  ]

  return (
    <section id="integrations" className="py-20 sm:py-28 px-6 border-t border-border/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Connects to 50+ platforms
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Fluxy integrates with the tools you already use. No migration required.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-3"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp} custom={1}
        >
          {platforms.map((platform) => (
            <div
              key={platform}
              className="px-5 py-2.5 rounded-full border border-border bg-card text-sm text-foreground font-medium hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 cursor-default"
            >
              {platform}
            </div>
          ))}
          <div className="px-5 py-2.5 rounded-full border border-dashed border-border text-sm text-muted-foreground">
            and many more...
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Testimonials() {
  const quotes = [
    {
      text: "Fluxy cleared my inbox, rescheduled three meetings, and ordered my groceries. All while I was on a call.",
      author: "Sarah K.",
      role: "Startup Founder"
    },
    {
      text: "It feels like having a second brain that actually has hands. I can't imagine going back.",
      author: "Marcus T.",
      role: "Software Engineer"
    },
    {
      text: "I told Fluxy to monitor my GitHub PRs and notify me on Telegram. It just worked. No setup, no fuss.",
      author: "Priya R.",
      role: "DevOps Lead"
    },
  ]

  return (
    <section className="py-20 sm:py-28 px-6 border-t border-border/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            People are talking
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quotes.map((quote, i) => (
            <motion.div
              key={i}
              className="p-6 rounded-2xl border border-border bg-card"
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={i}
            >
              <p className="text-foreground leading-relaxed mb-6">"{quote.text}"</p>
              <div>
                <div className="text-sm font-semibold text-foreground">{quote.author}</div>
                <div className="text-xs text-muted-foreground">{quote.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-20 sm:py-28 px-6 border-t border-border/50">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }}
          variants={fadeUp}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <HiBolt className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Ready to get things done?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of users who stopped context-switching and started shipping.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 text-base gap-2 w-full sm:w-auto">
              Install Fluxy <FaArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="rounded-full border-border hover:bg-white/5 text-foreground font-medium px-8 h-12 text-base gap-2 w-full sm:w-auto">
              <FaGithub className="w-4 h-4" /> Star on GitHub
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-border/50">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-7 w-7" />
              <span className="text-base font-bold text-foreground">Fluxy</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your AI assistant that actually does things.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Product</h4>
            <div className="space-y-2.5">
              <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Features</a>
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Pricing</a>
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Changelog</a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Resources</h4>
            <div className="space-y-2.5">
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Documentation</a>
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">API Reference</a>
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Skill Hub</a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Community</h4>
            <div className="space-y-2.5">
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Discord</a>
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">GitHub</a>
              <a href="#" className="block text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Twitter</a>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">2026 Fluxy. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200">Privacy</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <QuickStart />
        <Integrations />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}

export default App