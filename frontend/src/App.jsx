import { useState, useEffect, useRef } from 'react'
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import {
  FaGithub, FaArrowRight, FaCopy, FaCheck, FaStar
} from 'react-icons/fa'
import {
  HiSparkles, HiCpuChip, HiChatBubbleLeftRight,
  HiCommandLine, HiPuzzlePiece, HiBolt,
  HiArrowPath
} from 'react-icons/hi2'

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
            linear-gradient(rgba(60, 143, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(60, 143, 255, 0.04) 1px, transparent 1px)
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
      <div className="absolute top-20 left-[10%] w-2 h-2 bg-primary/30 rounded-full animate-float" />
      <div className="absolute top-40 right-[15%] w-1.5 h-1.5 bg-primary/20 rounded-full animate-float-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-60 left-[25%] w-1 h-1 bg-primary/25 rounded-full animate-float-slower" style={{ animationDelay: '3s' }} />
      <div className="absolute top-32 right-[30%] w-2.5 h-2.5 bg-primary/15 rounded-full animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-72 left-[60%] w-1.5 h-1.5 bg-primary/20 rounded-full animate-float-slow" style={{ animationDelay: '4s' }} />
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
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200 active:scale-90"
    >
      {copied ? <FaCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FaCopy className="w-3.5 h-3.5" />}
    </button>
  )
}

function TypewriterLine({ text, delay = 0 }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      let i = 0
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1))
        i++
        if (i >= text.length) {
          clearInterval(interval)
          setDone(true)
        }
      }, 25)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timeout)
  }, [text, delay])

  return (
    <span>
      {displayed}
      {!done && <span className="animate-blink text-primary">|</span>}
    </span>
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'backdrop-blur-xl bg-background/80 border-b border-border/50' : 'bg-transparent'
      }`}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
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
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Features</a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">How it works</a>
          <a href="#open-source" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">Open Source</a>
        </div>

        <div className="flex items-center gap-3">
          <a href="#" className="hidden sm:flex items-center gap-2 px-4 h-9 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-200">
            <FaGithub className="w-4 h-4" />
            <FaStar className="w-3 h-3" />
            <span className="font-medium">Star</span>
          </a>
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-display px-5 h-9 text-sm">
            Get Started
          </Button>
        </div>
      </div>
    </motion.nav>
  )
}

function Hero() {
  return (
    <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 px-6 overflow-hidden">
      <AnimatedGridBg />
      <FloatingOrbs />

      <div className="max-w-4xl mx-auto text-center relative">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 rounded-full px-4 py-1.5 text-sm font-medium font-display inline-flex items-center gap-2 cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open Source & Free
          </Badge>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-display text-foreground tracking-tight leading-[1.08] mb-6"
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
        >
          Software that
          <br />
          <span className="text-gradient">evolves itself.</span>
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          initial="hidden" animate="visible" variants={fadeUp} custom={2}
        >
          Fluxy is an open-source AI agent that builds its own interface. Describe the module
          you need and watch it appear. Your dashboard grows as you talk to it.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          initial="hidden" animate="visible" variants={fadeUp} custom={3}
        >
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold font-display px-8 h-12 text-base gap-2 w-full sm:w-auto group">
            Get Started Free
            <FaArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
          </Button>
          <Button variant="outline" className="rounded-full border-border hover:bg-white/5 hover:border-primary/30 text-foreground font-medium font-display px-8 h-12 text-base gap-2 w-full sm:w-auto">
            <FaGithub className="w-4 h-4" /> Star on GitHub
          </Button>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible" variants={scaleIn} custom={4}
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
      { comment: 'Install & start Fluxy in one line', command: 'curl -fsSL https://fluxy.bot/install | sh' },
    ],
    npm: [
      { comment: 'Install Fluxy', command: 'npm i -g fluxy' },
      { comment: 'Launch your self-evolving dashboard', command: 'fluxy init' },
    ],
    hackable: [
      { comment: 'Clone the repo', command: 'git clone https://github.com/fluxy-ai/fluxy.git' },
      { comment: 'Install dependencies', command: 'cd fluxy && npm install' },
      { comment: 'Start Fluxy', command: 'npm run dev' },
    ],
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-[#1a1a1a] overflow-hidden shadow-2xl shadow-black/40 glow-border hover:glow-border-hover transition-shadow duration-500">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#1e1e1e]">
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
                className={`relative px-3 py-1 rounded-md text-xs font-medium font-display transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="terminal-tab"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>

          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full px-2.5 py-0 font-display">
            BETA
          </Badge>
        </div>

        <div className="p-5 font-mono text-sm leading-relaxed min-h-[120px]">
          {commands[activeTab].map((line, i) => (
            <motion.div
              key={`${activeTab}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15, duration: 0.3 }}
              className={i > 0 ? 'mt-4' : ''}
            >
              <div className="text-muted-foreground/40 text-xs mb-1"># {line.comment}</div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-primary">$</span>{' '}
                  <span className="text-foreground">{line.command}</span>
                </div>
                <CopyButton text={line.command} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground/50 mt-4 text-center">
        Works on macOS, Windows & Linux. The one-liner installs Node.js and everything else for you.
      </p>
    </div>
  )
}

function Features() {
  const features = [
    {
      icon: HiArrowPath,
      title: 'Self-evolving UI',
      description: 'Describe a feature in plain English and Fluxy builds the interface for it. Your dashboard grows with every conversation.'
    },
    {
      icon: HiChatBubbleLeftRight,
      title: 'Prompt-driven modules',
      description: 'Need a CRM? A kanban board? An analytics view? Just ask. Fluxy creates fully functional modules on the fly.'
    },
    {
      icon: HiSparkles,
      title: 'Persistent memory',
      description: 'Fluxy remembers your data, preferences, and context. Every module it creates is saved and refined over time.'
    },
    {
      icon: HiCpuChip,
      title: 'Runs locally',
      description: 'Your data stays on your machine. No cloud dependencies, no vendor lock-in. Full control, always.'
    },
    {
      icon: HiCommandLine,
      title: 'Full autonomy',
      description: 'Fluxy reads files, runs commands, manages processes, and interacts with APIs. It does the work, not just the chat.'
    },
    {
      icon: HiPuzzlePiece,
      title: 'Open & extensible',
      description: 'Fork it, extend it, build on it. Community plugins and custom skills make Fluxy fit any workflow.'
    },
  ]

  return (
    <section id="features" className="py-20 sm:py-28 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight mb-4">
            Your dashboard is a conversation
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every prompt creates something real. Not mockups. Not templates. Working software.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="group relative p-6 rounded-2xl border border-border bg-card hover:glow-border-hover transition-all duration-500 cursor-default"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              variants={scaleIn} custom={i}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="absolute inset-0 rounded-2xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors duration-300">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Install',
      description: 'One command. 30 seconds. Works everywhere.',
      detail: 'npm i -g fluxy'
    },
    {
      num: '02',
      title: 'Talk',
      description: 'Describe the module you want in plain English.',
      detail: '"Add a contacts CRM with tags"'
    },
    {
      num: '03',
      title: 'Ship',
      description: 'Fluxy builds it, saves it, and evolves it as you go.',
      detail: 'Module is live instantly'
    },
  ]

  return (
    <section id="how-it-works" className="py-20 sm:py-28 px-6 border-t border-border/30 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight mb-4">
            Three steps. Zero config.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From install to a fully personalized dashboard in under a minute.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((item, i) => (
            <motion.div
              key={item.num}
              className="relative text-center"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              variants={fadeUp} custom={i}
            >
              {i < 2 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px border-t border-dashed border-border/50" />
              )}
              <div className="text-6xl font-bold font-display text-primary/10 mb-4">{item.num}</div>
              <h3 className="text-xl font-semibold font-display text-foreground mb-2">{item.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">{item.description}</p>
              <code className="inline-block text-xs text-primary/70 bg-primary/5 px-3 py-1.5 rounded-full font-mono">
                {item.detail}
              </code>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function OpenSource() {
  return (
    <section id="open-source" className="py-20 sm:py-28 px-6 border-t border-border/30 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto text-center relative">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <motion.div
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <HiBolt className="w-8 h-8 text-primary" />
          </motion.div>

          <h2 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight mb-4">
            Built in the open.
            <br />
            <span className="text-gradient">Owned by everyone.</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-4 max-w-xl mx-auto">
            Fluxy is fully open source. Fork it, run it, break it, rebuild it.
            The best tools are the ones the community shapes together.
          </p>

          <div className="flex justify-center gap-10 mb-10 pt-2">
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-foreground">
                <AnimatedCounter target={100} />%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Open source</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-foreground">
                <AnimatedCounter target={0} />
              </div>
              <div className="text-xs text-muted-foreground mt-1">Cloud required</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-display text-foreground">
                <AnimatedCounter target={100} />%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Your data</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold font-display px-8 h-12 text-base gap-2 w-full sm:w-auto group">
              Install Fluxy
              <FaArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </Button>
            <Button variant="outline" className="rounded-full border-border hover:bg-white/5 hover:border-primary/30 text-foreground font-medium font-display px-8 h-12 text-base gap-2 w-full sm:w-auto">
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
    <footer className="py-10 px-6 border-t border-border/30">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-6 w-6 opacity-60" />
          <span className="text-sm text-muted-foreground">Fluxy is open source under MIT.</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <FaGithub className="w-4.5 h-4.5" />
          </a>
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
        <HowItWorks />
        <OpenSource />
      </main>
      <Footer />
    </div>
  )
}

export default App