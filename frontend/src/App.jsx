import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { motion, useInView, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import {
  FaGithub, FaArrowRight, FaCopy, FaCheck, FaDiscord, FaGoogle
} from 'react-icons/fa'
import {
  HiSparkles, HiCpuChip, HiChatBubbleLeftRight,
  HiCommandLine, HiPuzzlePiece, HiBolt,
  HiArrowLeft
} from 'react-icons/hi2'
import HandleSelector from './components/HandleSelector'
import Navbar from './components/Navbar'
import Docs from './pages/Docs'
import Marketplace from './pages/Marketplace'
import Dashboard from './pages/Dashboard'
import Square from './pages/Square'
import { API_URL } from './api'

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

function CopyButton({ text, children }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  if (children) {
    return (
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 mb-2.5 min-w-0 group cursor-pointer"
        title="Click to copy"
      >
        <span className="min-w-0 truncate">{children}</span>
        {copied
          ? <FaCheck className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
          : <FaCopy className="w-2.5 h-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        }
      </button>
    )
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

function Hero({ user, onLogin, onLogout }) {
  return (
    <section className="relative pt-28 pb-8 sm:pt-36 sm:pb-14 px-4 sm:px-6 overflow-hidden">
      <AnimatedGridBg />
      <FloatingOrbs />

      <div className="max-w-4xl mx-auto text-center relative">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="mb-6">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="h-[180px] mx-auto"
          >
            <source src="/assets/videos/fluxy_say_hi.mov" type='video/mp4; codecs="hvc1"' />
            <source src="/assets/videos/fluxy_say_hi.webm" type="video/webm" />
          </video>
        </motion.div>

        <motion.h1
          className="text-[2.25rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-bold font-display text-foreground tracking-tight sm:leading-[1.08] mb-5 sm:mb-6"
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
        >
          Vibe coding
          <br />
          <span className="text-gradient">in your pocket.</span>
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          initial="hidden" animate="visible" variants={fadeUp} custom={2}
        >
          A self-hosted coding agent with its own full-stack app. Talk to it from
          your phone and it builds real software like CRMs, research hubs, and mini tools
          on demand. It runs on your hardware, you access it from anywhere, and your
          workspace grows with every conversation.
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
          initial="hidden" animate="visible" variants={fadeUp} custom={4}
          className="text-center mb-10 sm:mb-14"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4">
            Get started
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto px-2">
            Install locally or launch a hosted instance in seconds.
          </p>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible" variants={scaleIn} custom={5}
        >
          <Terminal user={user} onLogin={onLogin} onLogout={onLogout} />
        </motion.div>
      </div>
    </section>
  )
}

function HostedContent({ step, selectedPlan, selectedRegion, provisionStep, tunnelUrl, instances, onSelectPlan, onSelectRegion, onLogin, onPay, onBack, onCloseReady, onAddNew, onRestart, onManageSubscription }) {
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      instance: 't4g.small',
      price: 29,
      specs: ['2 vCPU', '2 GB RAM', '20 GB gp3', 'ARM64 (Graviton2)'],
      description: 'Perfect for personal use',
      popular: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      instance: 't4g.medium',
      price: 49,
      specs: ['2 vCPU', '4 GB RAM', '40 GB gp3', 'ARM64 (Graviton2)'],
      description: 'For teams & heavy workloads',
    },
  ]

  const regions = [
    { id: 'na', label: 'North America', sublabel: 'Virginia' },
    { id: 'eu', label: 'Europe', sublabel: 'Frankfurt' },
    { id: 'br', label: 'Brazil', sublabel: 'Sao Paulo' },
  ]

  const provisioningSteps = [
    'Spinning up your instance...',
    'Installing Fluxy...',
    'Initializing Fluxy...',
    'Your Fluxy is ready!',
  ]

  if (step === 'plan') {
    return (
      <div className="font-sans">
        <div className="flex items-center gap-2 mb-3">
          {instances.length > 0 && (
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors duration-200">
              <HiArrowLeft className="w-4 h-4" />
            </button>
          )}
          <p className="text-xs text-muted-foreground font-display">Choose your instance</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plans.map(plan => (
            <button
              key={plan.id}
              onClick={() => onSelectPlan(plan.id)}
              className="text-left p-4 rounded-xl border border-border bg-white/[0.02] hover:border-primary/30 hover:bg-primary/[0.04] transition-all duration-300 group relative"
            >
              {plan.popular && (
                <span className="absolute -top-2 right-3 text-[9px] font-display font-semibold bg-gradient-brand text-white px-2 py-0.5 rounded-full">
                  Popular
                </span>
              )}
              <h4 className="font-display font-semibold text-foreground text-sm mb-0.5">{plan.name}</h4>
              <p className="text-[10px] text-muted-foreground/50 font-mono mb-1.5">{plan.instance}</p>
              <div className="text-2xl font-bold font-display text-foreground mb-0.5">
                ${plan.price}<span className="text-xs font-normal text-muted-foreground">/mo</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2.5">{plan.description}</p>
              <ul className="space-y-1">
                {plan.specs.map(spec => (
                  <li key={spec} className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#04D1FE] shrink-0" />
                    {spec}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (step === 'region') {
    const plan = plans.find(p => p.id === selectedPlan)
    return (
      <div className="font-sans">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <HiArrowLeft className="w-4 h-4" />
          </button>
          <p className="text-xs text-muted-foreground font-display">
            {plan.name} &middot; ${plan.price}/mo &mdash; Select region
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {regions.map(region => (
            <button
              key={region.id}
              onClick={() => onSelectRegion(region.id)}
              className="text-center p-3 sm:p-4 rounded-xl border border-border bg-white/[0.02] hover:border-primary/30 hover:bg-primary/[0.04] transition-all duration-300"
            >
              <div className="text-sm font-display font-medium text-foreground mb-0.5">{region.label}</div>
              <div className="text-[10px] text-muted-foreground">{region.sublabel}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (step === 'login') {
    return (
      <div className="font-sans py-2 sm:py-4">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <HiArrowLeft className="w-4 h-4" />
          </button>
          <p className="text-xs text-muted-foreground font-display">Sign in to continue</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4 font-display">Login to launch your hosted Fluxy instance</p>
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-white text-[#1a1a1a] font-medium text-sm hover:bg-white/90 transition-colors duration-200"
          >
            <FaGoogle className="w-4 h-4 text-[#4285F4]" />
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  if (step === 'payment') {
    const plan = plans.find(p => p.id === selectedPlan)
    const region = regions.find(r => r.id === selectedRegion)
    return (
      <div className="font-sans">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <HiArrowLeft className="w-4 h-4" />
          </button>
          <p className="text-xs text-muted-foreground font-display">Confirm & pay</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-white/[0.02] mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-sm font-display font-semibold text-foreground">{plan.name} Instance</div>
              <div className="text-[11px] text-muted-foreground">{region.label} ({region.sublabel})</div>
            </div>
            <div className="text-lg font-bold font-display text-foreground">
              ${plan.price}<span className="text-xs font-normal text-muted-foreground">/mo</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {plan.specs.map(spec => (
              <span key={spec} className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{spec}</span>
            ))}
          </div>
        </div>
        <button
          onClick={onPay}
          className="w-full py-2.5 rounded-full bg-gradient-brand text-white font-medium font-display text-sm hover:opacity-90 transition-opacity duration-200"
        >
          Pay ${plan.price}/mo
        </button>
      </div>
    )
  }

  if (step === 'provisioning') {
    return (
      <div className="font-sans py-2 sm:py-4">
        <div className="space-y-3.5">
          {provisioningSteps.map((label, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: provisionStep >= i ? 1 : 0.3, x: 0 }}
              transition={{ delay: i * 0.15, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              {provisionStep > i ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"
                >
                  <FaCheck className="w-2.5 h-2.5 text-emerald-400" />
                </motion.div>
              ) : provisionStep === i ? (
                <div className="w-5 h-5 rounded-full border-2 border-primary/40 border-t-primary animate-spin shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border border-white/10 shrink-0" />
              )}
              <span className={`text-sm font-display transition-colors duration-300 ${
                provisionStep > i ? 'text-emerald-400' : provisionStep === i ? 'text-foreground' : 'text-muted-foreground/30'
              }`}>
                {label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  if (step === 'ready') {
    return (
      <div className="font-sans text-center py-4 sm:py-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3"
        >
          <FaCheck className="w-5 h-5 text-emerald-400" />
        </motion.div>
        <h4 className="font-display font-semibold text-foreground text-base mb-1">Your Fluxy is ready!</h4>
        <p className="text-xs text-muted-foreground mb-3 font-display">Continue the setup of your Fluxy at:</p>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-border mb-4">
          <span className="text-sm font-mono text-[#04D1FE]">{tunnelUrl}</span>
          <CopyButton text={tunnelUrl} />
        </div>
        <div>
          <button
            onClick={onCloseReady}
            className="text-xs text-muted-foreground hover:text-foreground font-display underline underline-offset-2 transition-colors duration-200"
          >
            Go to my instances
          </button>
        </div>
      </div>
    )
  }

  if (step === 'dashboard') {
    const regionMap = { na: 'North America', eu: 'Europe', br: 'Brazil' }
    const planMap = { starter: { name: 'Starter', instance: 't4g.small' }, pro: { name: 'Pro', instance: 't4g.medium' } }

    return (
      <div className="font-sans">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground font-display">Your instances</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onManageSubscription}
              className="text-[11px] font-display font-medium text-muted-foreground/60 hover:text-foreground px-2.5 py-1 rounded-full border border-white/10 hover:border-primary/30 transition-all duration-200"
            >
              Manage Subscription
            </button>
            <button
              onClick={onAddNew}
              className="text-[11px] font-display font-medium text-foreground/70 hover:text-foreground px-2.5 py-1 rounded-full border border-white/10 hover:border-primary/30 transition-all duration-200"
            >
              + Add new
            </button>
          </div>
        </div>
        {instances.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground/50 font-display mb-3">No instances yet</p>
            <button
              onClick={onAddNew}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-brand text-white font-medium font-display text-sm hover:opacity-90 transition-opacity duration-200"
            >
              Launch your first instance
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {instances.map(inst => {
              const plan = planMap[inst.plan] || { name: inst.plan, instance: '' }
              const isRestarting = inst.status === 'restarting'
              const isCanceling = inst.status === 'canceling'
              const isReady = inst.status === 'ready'
              const isTerminated = inst.status === 'terminated'
              return (
                <div
                  key={inst.id}
                  className={`p-3 rounded-xl border bg-white/[0.02] relative overflow-hidden min-w-0 ${isCanceling ? 'border-amber-500/30' : 'border-border'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isRestarting || isCanceling ? 'bg-amber-400 animate-pulse'
                      : isReady ? 'bg-emerald-400'
                      : isTerminated ? 'bg-red-400'
                      : 'bg-muted-foreground/40'
                    }`} />
                    <span className="text-xs font-display font-semibold text-foreground truncate">{plan.name}</span>
                    {isRestarting && <span className="text-[9px] text-amber-400/80 font-display">Restarting...</span>}
                    {isTerminated && <span className="text-[9px] text-red-400/80 font-display">Terminated</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 font-mono mb-1">{plan.instance}</p>
                  <p className="text-[10px] text-muted-foreground mb-2">{regionMap[inst.region] || inst.region}</p>
                  {isCanceling && inst.cancelAt && (
                    <p className="text-[10px] text-amber-400/80 font-display mb-2">
                      Cancels on {new Date(inst.cancelAt).toLocaleDateString()}
                    </p>
                  )}
                  {(inst.relayUrl || inst.tunnelUrl) && !isTerminated && (
                    <CopyButton text={inst.relayUrl || inst.tunnelUrl}>
                      <span className="text-[9px] font-mono text-[#04D1FE] truncate">{inst.relayUrl || inst.tunnelUrl}</span>
                    </CopyButton>
                  )}
                  {!isTerminated && (
                    <button
                      onClick={() => onRestart(inst.id)}
                      disabled={isRestarting}
                      className={`w-full text-[10px] font-display font-medium py-1.5 rounded-lg border border-white/10 transition-all duration-200 ${isRestarting ? 'opacity-40 cursor-not-allowed text-muted-foreground' : 'text-muted-foreground hover:text-foreground hover:border-primary/30'}`}
                    >
                      {isRestarting ? 'Restarting...' : 'Restart'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return null
}

function Terminal({ user, onLogin, onLogout }) {
  const os = detectOS()
  const defaultTab = os === 'windows' ? 'windows' : 'oneliner'
  const [mode, setMode] = useState('hosted')
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [hostedStep, setHostedStep] = useState('plan')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [provisionStep, setProvisionStep] = useState(-1)
  const [tunnelUrl, setTunnelUrl] = useState('')
  const [instances, setInstances] = useState([])
  const [provisioningId, setProvisioningId] = useState(null)
  const stripeSessionActive = useRef(false)

  const fetchInstances = async () => {
    const token = localStorage.getItem('fluxy_token')
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/instances`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setInstances(data.instances || [])
        return data.instances || []
      }
    } catch (err) {
      console.error('[instances] fetch failed:', err)
    }
    return []
  }

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

  // Handle Stripe redirect back (session_id in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (!sessionId || !user) return

    // Clean the URL
    window.history.replaceState({}, '', window.location.pathname)

    // Prevent the [activeTab, user] effect from overwriting our provisioning view
    stripeSessionActive.current = true

    // Switch to hosted mode and show provisioning
    setMode('hosted')
    setHostedStep('provisioning')
    setProvisionStep(0)

    // Scroll to the terminal section so user sees the progress
    setTimeout(() => {
      document.getElementById('install')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)

    let cancelled = false
    const statusMap = { launching: 0, booting: 1, initializing: 2, ready: 3 }

    const poll = async () => {
      const token = localStorage.getItem('fluxy_token')
      if (!token || cancelled) return

      try {
        // First try to get instance via session ID
        const sessionRes = await fetch(`${API_URL}/api/stripe/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (sessionRes.ok && !cancelled) {
          const { instance } = await sessionRes.json()
          setProvisioningId(instance.id)

          const step = statusMap[instance.status] ?? 0
          setProvisionStep(step)

          if (instance.status === 'ready' && instance.tunnelUrl) {
            setTunnelUrl(instance.relayUrl || instance.tunnelUrl)
            setHostedStep('ready')
            stripeSessionActive.current = false
            return
          }
          if (instance.status === 'failed') {
            setHostedStep('plan')
            stripeSessionActive.current = false
            return
          }
        }
      } catch (err) {
        console.error('[stripe] session poll error:', err)
      }

      if (!cancelled) setTimeout(poll, 3000)
    }

    const t = setTimeout(poll, 2000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [user])

  useEffect(() => {
    // Don't overwrite provisioning view during Stripe session redirect
    if (stripeSessionActive.current) return

    if (mode === 'hosted' && user) {
      fetchInstances().then(list => {
        if (list && list.length > 0) setHostedStep('dashboard')
        else setHostedStep('plan')
      })
    } else if (mode !== 'hosted') {
      setHostedStep('plan')
      setSelectedPlan(null)
      setSelectedRegion(null)
      setProvisionStep(-1)
      setTunnelUrl('')
    }
  }, [mode, user])

  useEffect(() => {
    if (hostedStep !== 'provisioning' || !provisioningId) return

    setProvisionStep(0)
    const statusMap = { launching: 0, booting: 1, initializing: 2, ready: 3 }
    let cancelled = false

    const poll = async () => {
      const token = localStorage.getItem('fluxy_token')
      if (!token || cancelled) return

      try {
        const res = await fetch(`${API_URL}/api/instances/${provisioningId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const { instance } = await res.json()
        if (cancelled) return

        const step = statusMap[instance.status] ?? 0
        setProvisionStep(step)

        if (instance.status === 'ready' && instance.tunnelUrl) {
          setTunnelUrl(instance.tunnelUrl)
          setHostedStep('ready')
          return
        }

        if (instance.status === 'failed') {
          setHostedStep('plan')
          return
        }
      } catch (err) {
        console.error('[provision] poll error:', err)
      }

      if (!cancelled) setTimeout(poll, 3000)
    }

    // Start polling after a short delay
    const t = setTimeout(poll, 1000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [hostedStep, provisioningId])

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId)
    setHostedStep('region')
  }

  const handleRegionSelect = (regionId) => {
    setSelectedRegion(regionId)
    setHostedStep(user ? 'payment' : 'login')
  }

  const handleLoginAndContinue = async () => {
    const success = await onLogin()
    if (success) setHostedStep('payment')
  }

  const handlePay = async () => {
    const token = localStorage.getItem('fluxy_token')
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: selectedPlan, region: selectedRegion }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[stripe] checkout failed:', data.error)
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      console.error('[stripe] checkout failed:', err)
    }
  }

  const handleBack = () => {
    if (hostedStep === 'region') {
      if (instances.length > 0) setHostedStep('dashboard')
      else setHostedStep('plan')
    } else if (hostedStep === 'login' || hostedStep === 'payment') {
      setHostedStep('region')
    } else if (hostedStep === 'plan' && instances.length > 0) {
      setHostedStep('dashboard')
    }
  }

  const handleCloseReady = async () => {
    await fetchInstances()
    setSelectedPlan(null)
    setSelectedRegion(null)
    setTunnelUrl('')
    setProvisionStep(-1)
    setProvisioningId(null)
    setHostedStep('dashboard')
  }

  const handleAddNew = () => {
    setSelectedPlan(null)
    setSelectedRegion(null)
    setTunnelUrl('')
    setProvisionStep(-1)
    setProvisioningId(null)
    setHostedStep('plan')
  }

  // Poll instances while any are restarting
  useEffect(() => {
    if (hostedStep !== 'dashboard') return
    const hasRestarting = instances.some(i => i.status === 'restarting')
    if (!hasRestarting) return

    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      await fetchInstances()
      if (!cancelled) setTimeout(poll, 5000)
    }
    const t = setTimeout(poll, 5000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [hostedStep, instances.some(i => i.status === 'restarting')])

  const handleManageSubscription = async () => {
    const token = localStorage.getItem('fluxy_token')
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/stripe/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      console.error('[stripe] portal failed:', err)
    }
  }

  const handleRestart = async (instanceId) => {
    const token = localStorage.getItem('fluxy_token')
    if (!token) return
    try {
      // Optimistically set status to restarting
      setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, status: 'restarting' } : i))
      await fetch(`${API_URL}/api/instances/${instanceId}/restart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error('[instances] restart failed:', err)
      await fetchInstances()
    }
  }

  const modes = [
    {
      id: 'hosted',
      title: 'Set it up for me',
      desc: 'One click, hosted on Amazon AWS. We handle everything.',
    },
    {
      id: 'selfhost',
      title: "I'll set it up myself",
      desc: 'I have a Raspberry Pi, Mac Mini, or VPS. Free forever.',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-0">
      {/* Mode toggle */}
      <div className="flex gap-3 mb-6">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`relative flex-1 text-left px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl border transition-all duration-300 ${
              mode === m.id
                ? 'border-primary/40 bg-primary/[0.06] shadow-[0_0_20px_-6px_rgba(175,39,227,0.25)]'
                : 'border-border bg-card/50 hover:border-border/80'
            }`}
          >
            {mode === m.id && (
              <motion.div
                layoutId="mode-glow"
                className="absolute inset-0 rounded-xl border border-primary/30"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`relative z-10 block text-sm sm:text-base font-semibold font-display ${
              mode === m.id ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {m.title}
            </span>
            <span className={`relative z-10 block text-[11px] sm:text-xs mt-1 ${
              mode === m.id ? 'text-muted-foreground' : 'text-muted-foreground/50'
            }`}>
              {m.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {mode === 'hosted' ? (
          <motion.div
            key="hosted"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="rounded-2xl border border-border bg-[#1a1a1a] overflow-hidden shadow-2xl shadow-black/40 glow-border hover:glow-border-hover transition-shadow duration-500">
              {!user && (
                <div className="px-4 sm:px-5 pt-4 sm:pt-5 text-center">
                  <p className="text-xs text-muted-foreground/60 font-display">
                    <button onClick={onLogin} className="text-foreground font-medium hover:text-primary transition-colors duration-200 underline underline-offset-2">Login</button> to see your instances
                  </p>
                </div>
              )}
              <div className="p-4 sm:p-5 text-xs sm:text-sm leading-relaxed">
                <HostedContent
                  step={hostedStep}
                  selectedPlan={selectedPlan}
                  selectedRegion={selectedRegion}
                  provisionStep={provisionStep}
                  tunnelUrl={tunnelUrl}
                  instances={instances}
                  onSelectPlan={handlePlanSelect}
                  onSelectRegion={handleRegionSelect}
                  onLogin={handleLoginAndContinue}
                  onPay={handlePay}
                  onBack={handleBack}
                  onCloseReady={handleCloseReady}
                  onAddNew={handleAddNew}
                  onRestart={handleRestart}
                  onManageSubscription={handleManageSubscription}
                />
              </div>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground/50 mt-3 sm:mt-4 text-center">
              Fully managed Fluxy instance on AWS. No setup, no maintenance.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="selfhost"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="rounded-2xl border border-border bg-[#1a1a1a] overflow-hidden shadow-2xl shadow-black/40 glow-border hover:glow-border-hover transition-shadow duration-500">
              <div className="flex items-center justify-center px-3 sm:px-4 py-3 border-b border-white/[0.06] bg-[#1e1e1e] gap-2">
                <div className="flex items-center gap-0.5 sm:gap-1 bg-white/5 rounded-lg p-0.5 overflow-x-auto no-scrollbar">
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
              </div>
              <div className="p-4 sm:p-5 text-xs sm:text-sm leading-relaxed min-h-[100px] sm:min-h-[120px] font-mono">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {commands[activeTab]?.map((line, i) => (
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Features() {
  const features = [
    {
      image: '/assets/images/icons/sandbox.png',
      title: 'Full-stack sandbox',
      description: 'Frontend, backend, and database, all yours. Ask for a CRM today, a finance tracker tomorrow. Fluxy adds them as modules to your workspace.'
    },
    {
      image: '/assets/images/icons/chat.png',
      title: 'Indestructible chat',
      description: 'The chat runs in an isolated iframe. Even if the agent ships a breaking change, the chat never goes down. You can always talk to Fluxy and ask for fixes.',
      scale: 'scale-105',
    },
    {
      image: '/assets/images/icons/miniapps.png',
      title: 'Mini apps on demand',
      description: '"I need a calorie counter." Fluxy builds it, adds it to the sidebar, and it\'s ready in minutes. Your workspace grows one conversation at a time.'
    },
    {
      image: '/assets/images/icons/hardware.png',
      title: 'Runs on your hardware',
      description: 'Mac Mini, VPS, Raspberry Pi, or anything that stays on. Install once, access from anywhere. Your data never leaves your machine.'
    },
    {
      image: '/assets/images/icons/voice.png',
      title: 'Voice & mobile-first',
      description: 'A PWA you install like a native app. Send voice messages, and Fluxy transcribes them with Whisper. It\'s like talking to your codebase.'
    },
    {
      image: '/assets/images/icons/secure.png',
      title: 'Secure by default',
      description: 'Encrypted tunnels via Cloudflare, portal password, and optional 2FA. Accessible from anywhere, but only by you.'
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
            Not just a chat. <span className="text-gradient">A whole app.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Other agents live in your terminal. Fluxy lives in a full-stack app you access from anywhere, and builds whatever you need inside it.
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
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white/[0.06] flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-white/[0.1] transition-colors duration-300 p-2.5 sm:p-3">
                  <img src={feature.image} alt={feature.title} className={`w-full h-full object-contain ${feature.scale || ''}`} />
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

function UseCases() {
  const cases = [
    {
      label: 'Personal dashboard',
      description: 'A private, password-protected hub for your gym stats, finances, and contacts. All built by your agent, all in one place.',
    },
    {
      label: 'Team research hub',
      description: 'Your agent runs daily lead research. Your team checks the findings at fluxy.bot/companybot every morning.',
    },
    {
      label: 'Public showcase',
      description: 'Leave your workspace open and share live reports, tools, or experiments with anyone who visits your URL.',
    },
    {
      label: 'Tools on demand',
      description: '"I need a meal planner." The agent builds it, adds it to the sidebar, and you\'re using it five minutes later.',
    },
  ]

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 border-t border-border/30 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            The ideas are <span className="text-gradient">endless.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            One agent, one workspace, infinite possibilities. Here's what people are building.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {cases.map((item, i) => (
            <motion.div
              key={item.label}
              className="group relative p-5 sm:p-6 rounded-2xl border border-border bg-card hover:glow-border-hover transition-all duration-500 cursor-default"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              variants={scaleIn} custom={i}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="absolute inset-0 rounded-2xl bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <h3 className="text-base sm:text-lg font-semibold font-display text-foreground mb-1.5 sm:mb-2">{item.label}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
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
      description: 'One command. Mac, Windows, Linux. The installer handles everything, Node.js included.',
      detail: 'fluxy init'
    },
    {
      num: '02',
      title: 'Talk',
      description: 'Describe what you need in plain English. Or send a voice message from your phone.',
      detail: '"Build me a contacts CRM"'
    },
    {
      num: '03',
      title: 'Use it everywhere',
      description: 'Open it from your phone, laptop, anywhere. A PWA that\'s always on, always yours.',
      detail: 'fluxy.bot/yourname'
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
            Install. Talk. Build anything.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            From zero to your own AI-powered workspace in under a minute.
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
              autoPlay
              loop
              muted
              playsInline
              className="h-28 sm:h-36 mx-auto"
            >
              <source src="/assets/videos/fluxy_happy.mov" type='video/mp4; codecs="hvc1"' />
              <source src="/assets/videos/fluxy_happy.webm" type="video/webm" />
            </video>
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

function SquareSection() {
  return (
    <section id="square" className="py-16 sm:py-24 px-4 sm:px-6 border-t border-border/30 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#04D1FE]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="max-w-3xl mx-auto text-center relative">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <div className="mx-auto mb-5 sm:mb-6">
            <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-16 sm:h-20 w-auto mx-auto" />
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            Fluxy Square
          </h2>

          <span className="inline-flex items-center h-7 px-3 rounded-full border border-border text-xs text-muted-foreground font-medium font-display mb-4">
            Coming soon
          </span>

          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto mb-8 px-2">
            A public gathering space for fluxies. Discover, interact, and connect with AI agents built by the community.
          </p>

          <a
            href="/square"
            className="inline-flex items-center gap-2 rounded-full border border-border hover:bg-white/5 hover:border-[#04D1FE]/30 text-foreground font-medium font-display px-6 h-11 text-sm transition-all duration-200"
          >
            Learn more
            <span className="text-xs">-&gt;</span>
          </a>
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
          <img src="/assets/images/fluxy.png" alt="Fluxy" className="h-5 sm:h-6 w-auto opacity-60" />
          <span className="text-xs sm:text-sm text-muted-foreground">Open source under MIT. Your agent, your rules.</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://discord.gg/QERDj3CBFj" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
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
  const [user, setUser] = useState(null)
  const [reservedHandles, setReservedHandles] = useState([])
  const tokenClientRef = useRef(null)
  const loginResolveRef = useRef(null)

  const fetchReservedHandles = async () => {
    const token = localStorage.getItem('fluxy_token')
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/stripe/handles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setReservedHandles(data.reservedHandles || [])
      }
    } catch (err) {
      console.error('[handles] fetch failed:', err)
    }
  }

  // Handle #hash scroll on fresh page load (React hasn't rendered targets yet)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const id = hash.replace('#', '')
    const scrollToHash = () => {
      const el = document.getElementById(id)
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return true }
      return false
    }
    if (scrollToHash()) return
    // Element not in DOM yet — retry after render settles
    const timer = setTimeout(scrollToHash, 600)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('fluxy_token')
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          if (data.user) {
            setUser(data.user)
            fetchReservedHandles()
          }
        })
        .catch(() => localStorage.removeItem('fluxy_token'))
    }
  }, [])

  // Handle Stripe handle purchase redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const handleSessionId = params.get('handle_session_id')
    if (!handleSessionId) return

    window.history.replaceState({}, '', window.location.pathname)

    // Wait for auth to resolve, then fetch handles and scroll
    const check = setInterval(() => {
      const token = localStorage.getItem('fluxy_token')
      if (!token) return
      clearInterval(check)
      fetchReservedHandles().then(() => {
        document.getElementById('handle')?.scrollIntoView({ behavior: 'smooth' })
      })
    }, 200)

    return () => clearInterval(check)
  }, [])

  useEffect(() => {
    const init = () => {
      if (!window.google?.accounts?.oauth2) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) return
          try {
            const res = await fetch(`${API_URL}/api/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: tokenResponse.access_token }),
            })
            const data = await res.json()
            if (data.token && data.user) {
              localStorage.setItem('fluxy_token', data.token)
              setUser(data.user)
              fetchReservedHandles()
              if (loginResolveRef.current) {
                loginResolveRef.current()
                loginResolveRef.current = null
              }
            }
          } catch (err) {
            console.error('[auth] Failed:', err)
          }
        },
      })
    }

    if (window.google?.accounts?.oauth2) {
      init()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval)
          init()
        }
      }, 200)
      return () => clearInterval(interval)
    }
  }, [])

  const handleLogin = () => {
    if (!tokenClientRef.current) {
      console.warn('[auth] Google not ready yet, retrying...')
      return new Promise((resolve) => {
        let attempts = 0
        const retry = setInterval(() => {
          attempts++
          if (tokenClientRef.current) {
            clearInterval(retry)
            loginResolveRef.current = () => resolve(true)
            tokenClientRef.current.requestAccessToken()
          } else if (attempts > 15) {
            clearInterval(retry)
            console.error('[auth] Google failed to load')
            resolve(false)
          }
        }, 200)
      })
    }
    return new Promise((resolve) => {
      loginResolveRef.current = () => resolve(true)
      tokenClientRef.current.requestAccessToken()
    })
  }

  const handleReserveHandle = async (handle) => {
    const token = localStorage.getItem('fluxy_token')
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/stripe/handle-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ handle }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[stripe] handle checkout failed:', data.error)
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      console.error('[stripe] handle checkout failed:', err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('fluxy_token')
    setUser(null)
    setReservedHandles([])
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onLogin={handleLogin} onLogout={handleLogout} />
      <main>
        <Hero user={user} onLogin={handleLogin} onLogout={handleLogout} />
        <HandleSelector user={user} onLogin={handleLogin} reservedHandles={reservedHandles} onReserve={handleReserveHandle} />
        <Features />
        <UseCases />
        <HowItWorks />
        <OpenSource />
        <SquareSection />
      </main>
      <Footer />
    </div>
  )
}

// Catch-all: unknown paths on www → redirect to bare domain for bot resolution
function BotRedirect() {
  const { pathname } = useLocation()
  useEffect(() => {
    const slug = pathname.replace(/^\//, '')
    if (slug) {
      window.location.replace(`https://fluxy.bot/${slug}`)
    }
  }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/square" element={<Square />} />
        <Route path="*" element={<BotRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App