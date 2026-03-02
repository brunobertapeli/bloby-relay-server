import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { motion, useInView, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import {
  FaGithub, FaArrowRight, FaCopy, FaCheck, FaStar, FaDiscord
} from 'react-icons/fa'
import {
  HiSparkles, HiCpuChip, HiChatBubbleLeftRight,
  HiCommandLine, HiPuzzlePiece, HiBolt,
  HiArrowPath, HiBars3, HiXMark
} from 'react-icons/hi2'
import HandleSelector from './components/HandleSelector'
import Docs from './pages/Docs'

function detectOS() {
  if (typeof navigator === 'undefined') return 'mac'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'mac'
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  })
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  })
}

function AnimatedGridBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 animate-grid-fade"
        style={{
          backgroundImage: `
            linear-gradient(rgba(175, 39, 227, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(175, 39, 227, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[150px] animate-glow-pulse" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-[120px] animate-glow-pulse" style={{ animationDelay: '2s' }} />
    </div>
  )
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-[10%] w-2 h-2 rounded-full animate-float" style={{ backgroundColor: 'rgba(4, 209, 254, 0.3)' }} />
      <div className="absolute top-40 right-[15%] w-1.5 h-1.5 rounded-full animate-float-slow" style={{ backgroundColor: 'rgba(175, 39, 227, 0.25)', animationDelay: '1s' }} />
      <div className="absolute top-60 left-[25%] w-1 h-1 rounded-full animate-float-slower" style={{ backgroundColor: 'rgba(251, 64, 114, 0.25)', animationDelay: '3s' }} />
      <div className="absolute top-32 right-[30%] w-2.5 h-2.5 rounded-full animate-float" style={{ backgroundColor: 'rgba(175, 39, 227, 0.15)', animationDelay: '2s' }} />
      <div className="absolute top-72 left-[60%] w-1.5 h-1.5 rounded-full animate-float-slow" style={{ backgroundColor: 'rgba(4, 209, 254, 0.2)', animationDelay: '4s' }} />
    </div>
  )
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
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200 active:scale-90 shrink-0"
    >
      {copied ? <FaCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FaCopy className="w-3.5 h-3.5" />}
    </button>
  )
}

function AnimatedCounter({ target, duration = 2 }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, v => Math.floor(v))
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, target, { duration })
      return controls.stop
    }
  }, [isInView, target, duration, count])

  useEffect(() => {
    return rounded.on('change', v => setDisplay(v))
  }, [rounded])

  return <span ref={ref}>{display}</span>
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#open-source', label: 'Open Source' },
    { href: '/docs', label: 'Docs' },
  ]

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'backdrop-blur-xl bg-background/80 border-b border-border/50' : 'bg-transparent'
        }`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <motion.img
              src="/assets/images/fluxy.png"
              alt="Fluxy"
              className="h-8 w-8"
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            />
            <span className="text-lg font-bold font-display text-foreground">Fluxy</span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="#" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <FaDiscord className="w-[18px] h-[18px]" />
            </a>
            <a href="#" className="hidden sm:flex items-center gap-2 px-4 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-[#AF27E3]/30 transition-all duration-200">
              <FaGithub className="w-4 h-4" />
              <FaStar className="w-3 h-3" />
              <span className="font-medium">Star</span>
            </a>
            <Button className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display px-5 h-9 text-sm hidden sm:flex">
              Demo
            </Button>
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground md:hidden transition-colors duration-200"
            >
              <HiBars3 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-[280px] bg-background border-l border-border/50 p-6 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-7 w-7" />
                  <span className="font-bold font-display text-foreground">Fluxy</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {navLinks.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 px-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <a href="#" className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-all duration-200">
                    <FaGithub className="w-4 h-4" /> Star
                  </a>
                  <a href="#" className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-all duration-200">
                    <FaDiscord className="w-4 h-4" /> Discord
                  </a>
                </div>
                <Button className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display h-11 text-sm w-full">
                  Demo
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Hero() {
  return (
    <section className="relative pt-28 pb-8 sm:pt-36 sm:pb-14 px-4 sm:px-6 overflow-hidden">
      <AnimatedGridBg />
      <FloatingOrbs />

      <div className="max-w-4xl mx-auto text-center relative">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="mb-6">
          <video
            src="/assets/videos/fluxy_say_hi.webm"
            autoPlay
            loop
            muted
            playsInline
            className="h-[180px] mx-auto"
          />
        </motion.div>

        <motion.h1
          className="text-[2.25rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-bold font-display text-foreground tracking-tight sm:leading-[1.08] mb-5 sm:mb-6"
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
        >
          An AI agent with
          <br />
          <span className="text-gradient">its own workspace.</span>
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          initial="hidden" animate="visible" variants={fadeUp} custom={2}
        >
          Fluxy is a coding agent with its own playground: a full-stack app you both
          share and evolve together. A CRM, a dashboard, a game, anything. It runs on
          your machine and you and your agent shape it the way you want.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16 px-2"
          initial="hidden" animate="visible" variants={fadeUp} custom={3}
        >
          <Button className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-semibold font-display px-8 h-11 sm:h-12 text-sm sm:text-base gap-2 w-full sm:w-auto group">
            Demo
            <FaArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </Button>
          <Button variant="outline" className="rounded-full border-border hover:bg-white/5 hover:border-[#AF27E3]/30 text-foreground font-medium font-display px-8 h-11 sm:h-12 text-sm sm:text-base gap-2 w-full sm:w-auto">
            <FaGithub className="w-4 h-4" /> Star on GitHub
          </Button>
        </motion.div>

        <motion.div
          id="install"
          initial="hidden" animate="visible" variants={scaleIn} custom={4}
        >
          <Terminal />
        </motion.div>
      </div>
    </section>
  )
}

function Terminal() {
  const os = detectOS()
  const defaultTab = os === 'windows' ? 'windows' : 'oneliner'
  const [activeTab, setActiveTab] = useState(defaultTab)

  const tabs = os === 'windows'
    ? [
        { id: 'windows', label: 'Windows' },
        { id: 'npm', label: 'npm' },
        { id: 'oneliner', label: 'macOS / Linux' },
        { id: 'hackable', label: 'Hackable' },
      ]
    : [
        { id: 'oneliner', label: os === 'mac' ? 'macOS' : 'Linux' },
        { id: 'npm', label: 'npm' },
        { id: 'windows', label: 'Windows' },
        { id: 'hackable', label: 'Hackable' },
      ]

  const commands = {
    oneliner: [
      { comment: 'Install & start Fluxy in one line', command: 'curl -fsSL https://www.fluxy.bot/install | sh' },
    ],
    windows: [
      { comment: 'Install & start Fluxy on Windows', command: 'iwr -useb https://www.fluxy.bot/install.ps1 | iex', prompt: '>' },
    ],
    npm: [
      { comment: 'Install Fluxy', command: 'npm i -g fluxy-bot' },
      { comment: 'Launch your workspace', command: 'fluxy init' },
    ],
    hackable: [
      { comment: 'Clone the repo', command: 'git clone https://github.com/fluxy-ai/fluxy.git' },
      { comment: 'Install dependencies', command: 'cd fluxy && npm install' },
      { comment: 'Start Fluxy', command: 'npm run dev' },
    ],
  }

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-0">
      <div className="rounded-2xl border border-border bg-[#1a1a1a] overflow-hidden shadow-2xl shadow-black/40 glow-border hover:glow-border-hover transition-shadow duration-500">
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-white/[0.06] bg-[#1e1e1e] gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 bg-white/5 rounded-lg p-0.5 flex-1 sm:flex-initial overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium font-display transition-colors duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="terminal-tab"
                    className="absolute inset-0 bg-gradient-brand rounded-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>

          <Badge className="bg-white/5 text-foreground/60 border-white/10 text-[10px] rounded-full px-2 sm:px-2.5 py-0 font-display shrink-0">
            BETA
          </Badge>
        </div>

        <div className="p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed min-h-[100px] sm:min-h-[120px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {commands[activeTab].map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.3 }}
                  className={i > 0 ? 'mt-3 sm:mt-4' : ''}
                >
                  <div className="text-muted-foreground/40 text-[10px] sm:text-xs mb-1"># {line.comment}</div>
                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 overflow-x-auto no-scrollbar">
                      <span className="text-[#04D1FE]">{line.prompt || '$'}</span>{' '}
                      <span className="text-foreground whitespace-nowrap">{line.command}</span>
                    </div>
                    <CopyButton text={line.command} />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <p className="text-[11px] sm:text-xs text-muted-foreground/50 mt-3 sm:mt-4 text-center">
        Works on macOS, Windows & Linux. The one-liner installs Node.js and everything else for you.
      </p>
    </div>
  )
}

function Features() {
  const features = [
    {
      icon: HiArrowPath,
      title: 'Full-stack workspace',
      description: 'Frontend, backend, and database — all yours. Both you and the agent can change anything in the workspace, anytime.'
    },
    {
      icon: HiChatBubbleLeftRight,
      title: 'Built-in chat',
      description: 'A floating chat bubble lives inside your workspace. Talk to Fluxy right where you work — sandboxed, always accessible.'
    },
    {
      icon: HiCommandLine,
      title: 'Real coding skills',
      description: 'Powered by Claude Code or ChatGPT Codex. Fluxy writes, debugs, and ships production code — not HTML snippets.'
    },
    {
      icon: HiCpuChip,
      title: 'Runs on your hardware',
      description: 'Install it on a Mac Mini, a VPS, a Raspberry Pi — anything. Your data never leaves your machine.'
    },
    {
      icon: HiSparkles,
      title: 'Works as a PWA',
      description: 'Access your workspace from your phone or any device. Install it like a native app, use it anywhere.'
    },
    {
      icon: HiPuzzlePiece,
      title: 'Open & extensible',
      description: 'Fork it, extend it, make it yours. Fluxy is fully open source and built to be shaped by its community.'
    },
  ]

  return (
    <section id="features" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            An agent that builds. A workspace that grows.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            You talk, Fluxy builds. Everything it creates is real, working software you can use right away.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="group relative p-5 sm:p-6 rounded-2xl border border-border bg-card hover:glow-border-hover transition-all duration-500 cursor-default"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              variants={scaleIn} custom={i}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="absolute inset-0 rounded-2xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-white/[0.1] transition-colors duration-300">
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#04D1FE]" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold font-display text-foreground mb-1.5 sm:mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StepConnectorH() {
  return (
    <div className="hidden md:flex items-center self-start mt-8 -mx-2 lg:-mx-3">
      <div className="w-8 lg:w-12 border-t border-dashed border-border/50" />
    </div>
  )
}

function StepConnectorV() {
  return (
    <div className="flex md:hidden justify-center py-2">
      <div className="h-8 border-l border-dashed border-border/50" />
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Install',
      description: 'One command. Works on macOS, Windows, and Linux.',
      detail: 'npm i -g fluxy-bot'
    },
    {
      num: '02',
      title: 'Talk',
      description: 'Tell Fluxy what you need. A CRM, a dashboard, a game.',
      detail: '"Build me a contacts CRM"'
    },
    {
      num: '03',
      title: 'Evolve',
      description: 'Your workspace grows with every conversation. Fluxy remembers and refines.',
      detail: 'Always improving'
    },
  ]

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 border-t border-border/30 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4">
            Install it. Talk to it. Watch it evolve.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            From zero to a personalized workspace in under a minute.
          </p>
        </motion.div>

        <div className="flex flex-col md:flex-row items-center md:items-start justify-center">
          {steps.map((item, i) => (
            <div key={item.num} className="contents">
              {i > 0 && <StepConnectorH />}
              {i > 0 && <StepConnectorV />}
              <motion.div
                className="text-center flex-1 max-w-[280px] md:max-w-none"
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
                variants={fadeUp} custom={i}
              >
                <div className="text-5xl sm:text-6xl font-bold font-display text-foreground/10 mb-3 sm:mb-4">{item.num}</div>
                <h3 className="text-lg sm:text-xl font-semibold font-display text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">{item.description}</p>
                <code className="inline-block text-xs text-foreground/60 bg-white/5 px-3 py-1.5 rounded-full font-mono">
                  {item.detail}
                </code>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OpenSource() {
  return (
    <section id="open-source" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 border-t border-border/30 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[200px] sm:h-[300px] bg-primary/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto text-center relative">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <div className="mx-auto mb-5 sm:mb-6">
            <video
              src="/assets/videos/fluxy_happy.webm"
              autoPlay
              loop
              muted
              playsInline
              className="h-28 sm:h-36 mx-auto"
            />
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            Built in the open.
            <br />
            <span className="text-gradient">Owned by everyone.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-4 max-w-xl mx-auto px-2">
            Fluxy is fully open source. Fork it, run it, break it, rebuild it.
            The best tools are the ones the community shapes together.
          </p>

          <div className="flex justify-center gap-6 sm:gap-10 mb-8 sm:mb-10 pt-2">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
                <AnimatedCounter target={100} />%
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Open source</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
                <AnimatedCounter target={0} />
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Cloud required</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
                <AnimatedCounter target={100} />%
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Your data</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-2">
            <a href="#install" className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-semibold font-display px-8 h-11 sm:h-12 text-sm sm:text-base gap-2 w-full sm:w-auto group inline-flex items-center justify-center">
              Install Fluxy
              <FaArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2 group-hover:translate-x-0.5 transition-transform duration-200" />
            </a>
            <Button variant="outline" className="rounded-full border-border hover:bg-white/5 hover:border-[#AF27E3]/30 text-foreground font-medium font-display px-8 h-11 sm:h-12 text-sm sm:text-base gap-2 w-full sm:w-auto">
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
    <footer className="py-8 sm:py-10 px-4 sm:px-6 border-t border-border/30">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-5 w-5 sm:h-6 sm:w-6 opacity-60" />
          <span className="text-xs sm:text-sm text-muted-foreground">Fluxy is open source under MIT.</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <FaDiscord className="w-4 h-4" />
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <FaGithub className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  )
}

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <HandleSelector />
        <Features />
        <HowItWorks />
        <OpenSource />
      </main>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App