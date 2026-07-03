import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { motion, useInView, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import {
  FaArrowRight, FaCopy, FaCheck, FaTelegramPlane, FaGoogle, FaPlay
} from 'react-icons/fa'
import {
  HiSparkles, HiCpuChip, HiChatBubbleLeftRight,
  HiCommandLine, HiPuzzlePiece, HiBolt,
  HiArrowLeft
} from 'react-icons/hi2'
import HandleSelector from './components/HandleSelector'
import Navbar from './components/Navbar'
import MorphyMascot from './components/MorphyMascot'
import Docs from './pages/Docs'
import Marketplace from './pages/Marketplace'
import Dashboard from './pages/Dashboard'
import BlobyWorld from './pages/World'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
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
            linear-gradient(rgba(0, 105, 254, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 105, 254, 0.04) 1px, transparent 1px)
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
      <div className="absolute top-20 left-[10%] w-2 h-2 rounded-full animate-float" style={{ backgroundColor: 'rgba(74, 238, 255, 0.3)' }} />
      <div className="absolute top-40 right-[15%] w-1.5 h-1.5 rounded-full animate-float-slow" style={{ backgroundColor: 'rgba(0, 105, 254, 0.25)', animationDelay: '1s' }} />
      <div className="absolute top-60 left-[25%] w-1 h-1 rounded-full animate-float-slower" style={{ backgroundColor: 'rgba(251, 64, 114, 0.25)', animationDelay: '3s' }} />
      <div className="absolute top-32 right-[30%] w-2.5 h-2.5 rounded-full animate-float" style={{ backgroundColor: 'rgba(0, 105, 254, 0.15)', animationDelay: '2s' }} />
      <div className="absolute top-72 left-[60%] w-1.5 h-1.5 rounded-full animate-float-slow" style={{ backgroundColor: 'rgba(74, 238, 255, 0.2)', animationDelay: '4s' }} />
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

// Demo video modal. Placeholder: drop the real hero demo at
// public/assets/videos/morphy-demo.mp4 and it plays automatically;
// until then the modal shows a "coming soon" panel.
function DemoVideoModal({ open, onClose }) {
  const [videoMissing, setVideoMissing] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-4xl"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          >
            <button
              onClick={onClose}
              className="absolute -top-10 right-0 text-sm text-muted-foreground hover:text-foreground font-display transition-colors duration-200"
            >
              Close ✕
            </button>
            <div className="rounded-2xl overflow-hidden border border-border bg-[#111] aspect-video shadow-2xl shadow-black/60">
              {videoMissing ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-border flex items-center justify-center">
                    <FaPlay className="w-4 h-4 text-muted-foreground ml-0.5" />
                  </div>
                  <p className="text-sm text-muted-foreground font-display">Demo video coming soon</p>
                </div>
              ) : (
                <video
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full"
                  onError={() => setVideoMissing(true)}
                >
                  <source src="/assets/videos/morphy-demo.mp4" type="video/mp4" />
                </video>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Hero({ user, onLogin, onLogout }) {
  const [dropped, setDropped] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <section className="relative pb-8 sm:pb-14 overflow-hidden">
      <AnimatedGridBg />
      <FloatingOrbs />

      {/* Transparent (luma-keyed) drop-in video anchored to the top of the
          viewport, so Morphy falls in from the browser edge. The element
          starts shifted up (video top = viewport top) and slides down as the
          impact lands (t=1.125s into the video), so the squash carries the
          whole scene to its lower resting spot, clear of the navbar. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative flex justify-center overflow-hidden h-[306px] sm:h-[400px]"
      >
        <motion.video
          autoPlay
          muted
          playsInline
          preload="auto"
          onPlay={() => setDropped(true)}
          initial={{ y: '-33%' }}
          animate={dropped ? { y: '0%' } : { y: '-33%' }}
          transition={{ delay: 1.125, duration: 0.5, ease: 'easeOut' }}
          className="h-[230px] sm:h-[300px] w-auto shrink-0 mt-[76px] sm:mt-[100px]"
        >
          <source src="/assets/videos/morphy-dropping.mov" type='video/mp4; codecs="hvc1"' />
          <source src="/assets/videos/morphy-dropping.webm" type="video/webm" />
        </motion.video>
      </motion.div>

      <div className="max-w-4xl mx-auto text-center relative px-4 sm:px-6 pt-8 sm:pt-12">
        <motion.h1
          className="text-[2.25rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-bold font-display text-foreground tracking-tight sm:leading-[1.08] mb-5 sm:mb-6"
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
        >
          Everything OpenClaw does.
          <br />
          <span className="text-gradient">Plus a personal app you build together.</span>
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          initial="hidden" animate="visible" variants={fadeUp} custom={2}
        >
          Morphy is your personal AI agent, inside a personal app that&apos;s all yours.
          Ask for a workout planner, a budget tracker, or a barbecue calculator for
          28 guests. Morphy builds it while you watch, and it lives in your app from
          then on.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-5 sm:mb-6 px-2"
          initial="hidden" animate="visible" variants={fadeUp} custom={3}
        >
          <a href="#install" className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-semibold font-display px-8 h-11 sm:h-12 text-sm sm:text-base gap-2 w-full sm:w-auto group inline-flex items-center justify-center">
            Get your Morphy
            <FaArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2 group-hover:translate-x-0.5 transition-transform duration-200" />
          </a>
          <Button
            onClick={() => setVideoOpen(true)}
            variant="outline"
            className="rounded-full border-border hover:bg-white/5 hover:border-[#0069FE]/30 text-foreground font-medium font-display px-8 h-11 sm:h-12 text-sm sm:text-base gap-2 w-full sm:w-auto"
          >
            <FaPlay className="w-3 h-3" /> Watch Morphy in action
          </Button>
        </motion.div>

        <motion.p
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground/70 mb-12 sm:mb-16 px-4 py-2 rounded-full border border-border/60 bg-white/[0.02]"
          initial="hidden" animate="visible" variants={fadeUp} custom={4}
        >
          <FaCheck className="w-3 h-3 text-emerald-400 shrink-0" />
          Runs on the Claude or ChatGPT subscription you already pay for. No extra AI costs.
        </motion.p>

        <motion.div
          id="install"
          initial="hidden" animate="visible" variants={fadeUp} custom={4}
          className="text-center mb-10 sm:mb-14"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4">
            Get your Morphy
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto px-2">
            Pick a plan, pick a name, and your app is live in about two minutes.
            We handle the servers, the updates, everything.
          </p>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible" variants={scaleIn} custom={5}
        >
          <Terminal user={user} onLogin={onLogin} onLogout={onLogout} />
        </motion.div>
      </div>

      <DemoVideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
    </section>
  )
}

// Inline "reserve a new handle" control used inside the hosted purchase flow.
// Reserving is free when the server runs with BILLING_DISABLED, otherwise it
// redirects to a Stripe one-time payment.
function HandleReserveInline({ onReserve, error }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const v = name.trim().toLowerCase()
    if (v.length < 3) return
    setBusy(true)
    await onReserve(v)
    setBusy(false)
    setName('')
  }
  const disabled = busy || name.trim().length < 3
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="reserve a new handle"
          maxLength={30}
          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 font-mono"
        />
        <button
          onClick={submit}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-all duration-200 ${disabled ? 'opacity-40 cursor-not-allowed bg-white/5 text-muted-foreground' : 'bg-gradient-brand text-white hover:opacity-90'}`}
        >
          {busy ? '...' : 'Reserve'}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400 mt-1.5 font-display">{error}</p>}
    </div>
  )
}

function HostedContent({ step, selectedPlan, selectedRegion, selectedHandle, reservedHandles = [], handleError, provisionStep, tunnelUrl, instances, onSelectPlan, onSelectRegion, onSelectHandle, onReserveHandle, onLogin, onPay, onBack, onCloseReady, onAddNew, onRestart, onManageSubscription }) {
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
    'Installing Morphy...',
    'Initializing Morphy...',
    'Your Morphy is ready!',
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
                    <span className="w-1 h-1 rounded-full bg-[#0069FE] shrink-0" />
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
            {plan.name} &middot; ${plan.price}/mo &middot; Select region
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
          <p className="text-sm text-muted-foreground mb-4 font-display">Login to launch your hosted Morphy instance</p>
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

  if (step === 'handle') {
    const available = reservedHandles.filter(h => !h.used)
    const used = reservedHandles.filter(h => h.used)
    return (
      <div className="font-sans">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <HiArrowLeft className="w-4 h-4" />
          </button>
          <p className="text-xs text-muted-foreground font-display">Choose your bot handle</p>
        </div>

        {available.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {available.map(h => (
              <button
                key={h.handle}
                onClick={() => onSelectHandle(h)}
                className="text-left p-3 rounded-xl border border-border bg-white/[0.02] hover:border-primary/30 hover:bg-primary/[0.04] transition-all duration-300"
              >
                <div className="text-sm font-display font-medium text-foreground">{h.handle}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{h.handle}.morphyagent.com</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-border bg-white/[0.02] mb-4 text-center">
            <p className="text-xs text-muted-foreground font-display">
              You need a reserved handle to start an instance. Reserve one below.
            </p>
          </div>
        )}

        <HandleReserveInline onReserve={onReserveHandle} error={handleError} />

        {used.length > 0 && (
          <p className="text-[10px] text-muted-foreground/50 mt-3 font-display">
            Already in use: {used.map(h => h.handle).join(', ')}
          </p>
        )}
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
          {selectedHandle && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="text-[10px] text-muted-foreground font-display mb-0.5">Your bot will live at</div>
              <div className="text-sm font-mono text-[#0069FE]">{selectedHandle.handle}.morphyagent.com</div>
            </div>
          )}
        </div>
        <button
          onClick={onPay}
          className="w-full py-2.5 rounded-full bg-gradient-brand text-white font-medium font-display text-sm hover:opacity-90 transition-opacity duration-200"
        >
          Pay ${plan.price}/mo
        </button>
        {handleError && <p className="text-[11px] text-red-400 mt-2 text-center font-display">{handleError}</p>}
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
        <h4 className="font-display font-semibold text-foreground text-base mb-1">Your Morphy is ready!</h4>
        <p className="text-xs text-muted-foreground mb-3 font-display">Continue the setup of your Morphy at:</p>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-border mb-4">
          <span className="text-sm font-mono text-[#0069FE]">{tunnelUrl}</span>
          <CopyButton text={tunnelUrl} />
        </div>
        <div>
          <button
            onClick={onCloseReady}
            className="text-xs text-muted-foreground hover:text-foreground font-display underline underline-offset-2 transition-colors duration-200"
          >
            Go to my dashboard
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
                      <span className="text-[9px] font-mono text-[#0069FE] truncate">{inst.relayUrl || inst.tunnelUrl}</span>
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
  const [reservedHandles, setReservedHandles] = useState([])
  const [selectedHandle, setSelectedHandle] = useState(null)
  const [handleError, setHandleError] = useState('')
  const stripeSessionActive = useRef(false)

  const fetchInstances = async () => {
    const token = localStorage.getItem('bloby_token')
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

  const fetchReservedHandles = async () => {
    const token = localStorage.getItem('bloby_token')
    if (!token) return []
    try {
      const res = await fetch(`${API_URL}/api/stripe/handles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setReservedHandles(data.reservedHandles || [])
        return data.reservedHandles || []
      }
    } catch (err) {
      console.error('[handles] fetch failed:', err)
    }
    return []
  }

  const tabs = os === 'windows'
    ? [
        { id: 'windows', label: 'Windows' },
        { id: 'npm', label: 'npm' },
        { id: 'oneliner', label: 'macOS / Linux' },
      ]
    : [
        { id: 'oneliner', label: 'macOS / Linux' },
        { id: 'npm', label: 'npm' },
        { id: 'windows', label: 'Windows' },
      ]

  const commands = {
    oneliner: [
      { comment: 'Install & start Morphy in one line', command: 'curl -fsSL https://www.morphyagent.com/install | sh' },
    ],
    windows: [
      { comment: 'Install & start Morphy on Windows', command: 'iwr -useb https://www.morphyagent.com/install.ps1 | iex', prompt: '>' },
    ],
    npm: [
      { comment: 'Install Morphy', command: 'npm i -g morphyagent' },
      { comment: 'Launch your workspace', command: 'morphy init' },
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
      const token = localStorage.getItem('bloby_token')
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

          // Direct mode has no tunnelUrl — the box is reached via relayUrl.
          if (instance.status === 'ready' && (instance.relayUrl || instance.tunnelUrl)) {
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
      // Instance management now lives on the Dashboard; the landing widget is the
      // subscribe funnel only, so it always starts at plan selection.
      setHostedStep('plan')
    } else if (mode !== 'hosted') {
      setHostedStep('plan')
      setSelectedPlan(null)
      setSelectedRegion(null)
      setProvisionStep(-1)
      setTunnelUrl('')
    }
  }, [mode, user])

  // Load the buyer's reserved handles whenever they reach the handle-select step.
  useEffect(() => {
    if (hostedStep === 'handle') {
      setSelectedHandle(null)
      setHandleError('')
      fetchReservedHandles()
    }
  }, [hostedStep])

  useEffect(() => {
    if (hostedStep !== 'provisioning' || !provisioningId) return

    setProvisionStep(0)
    const statusMap = { launching: 0, booting: 1, initializing: 2, ready: 3 }
    let cancelled = false

    const poll = async () => {
      const token = localStorage.getItem('bloby_token')
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

        // Direct mode has no tunnelUrl — the box is reached via relayUrl.
        if (instance.status === 'ready' && (instance.relayUrl || instance.tunnelUrl)) {
          setTunnelUrl(instance.relayUrl || instance.tunnelUrl)
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
    setHostedStep(user ? 'handle' : 'login')
  }

  const handleLoginAndContinue = async () => {
    const success = await onLogin()
    if (success) setHostedStep('handle')
  }

  // Picking which reserved handle backs this instance, then on to payment.
  const handleSelectHandle = (h) => {
    setSelectedHandle(h)
    setHandleError('')
    setHostedStep('payment')
  }

  // Reserve a NEW handle (free when BILLING_DISABLED, else Stripe one-time).
  const handleReserveHandle = async (name) => {
    const token = localStorage.getItem('bloby_token')
    if (!token) return
    setHandleError('')
    try {
      const res = await fetch(`${API_URL}/api/stripe/handle-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ handle: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setHandleError(data.error || 'Could not reserve that handle'); return }
      if (data.bypass) { await fetchReservedHandles(); return }   // reserved free — stay on step
      if (data.url) window.location.href = data.url               // Stripe one-time payment
    } catch (err) {
      console.error('[stripe] handle reserve failed:', err)
      setHandleError('Could not reserve that handle')
    }
  }

  const handlePay = async () => {
    const token = localStorage.getItem('bloby_token')
    if (!token || !selectedHandle) return
    setHandleError('')

    try {
      const res = await fetch(`${API_URL}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: selectedPlan, region: selectedRegion, username: selectedHandle.handle }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[stripe] checkout failed:', data.error)
        setHandleError(data.error || 'Checkout failed')
        return
      }
      // Stripe disconnected: the server provisioned directly — jump to provisioning.
      if (data.bypass) {
        setProvisioningId(data.instanceId)
        setProvisionStep(0)
        setHostedStep('provisioning')
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('[stripe] checkout failed:', err)
    }
  }

  const handleBack = () => {
    if (hostedStep === 'region') {
      setHostedStep('plan')
    } else if (hostedStep === 'login' || hostedStep === 'handle') {
      setHostedStep('region')
    } else if (hostedStep === 'payment') {
      setHostedStep('handle')
    }
  }

  const handleCloseReady = async () => {
    // Instance management now lives on the Dashboard — send the buyer there.
    window.location.href = '/dashboard'
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
    const token = localStorage.getItem('bloby_token')
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
    const token = localStorage.getItem('bloby_token')
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
      title: 'Managed by us',
      desc: 'Live in ~2 minutes on Amazon AWS. No setup, no maintenance.',
      badge: 'Recommended',
    },
    {
      id: 'selfhost',
      title: 'Self-host',
      desc: 'For tinkerers with a Mac Mini, Raspberry Pi, or VPS.',
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
                ? 'border-primary/40 bg-primary/[0.06] shadow-[0_0_20px_-6px_rgba(0, 105, 254,0.25)]'
                : 'border-border bg-card/50 hover:border-border/80'
            }`}
          >
            {m.badge && (
              <span className="absolute -top-2.5 right-3 text-[9px] font-display font-semibold bg-gradient-brand text-white px-2 py-0.5 rounded-full z-10">
                {m.badge}
              </span>
            )}
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
                  selectedHandle={selectedHandle}
                  reservedHandles={reservedHandles}
                  handleError={handleError}
                  provisionStep={provisionStep}
                  tunnelUrl={tunnelUrl}
                  instances={instances}
                  onSelectPlan={handlePlanSelect}
                  onSelectRegion={handleRegionSelect}
                  onSelectHandle={handleSelectHandle}
                  onReserveHandle={handleReserveHandle}
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
              Fully managed on AWS. No terminal, no maintenance, cancel anytime.
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
                            <span className="text-[#0069FE]">{line.prompt || '$'}</span>{' '}
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
              You should be comfortable with a terminal. If not, managed is the way.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TwoThings() {
  const halves = [
    {
      tag: 'The agent',
      title: 'A full AI agent working for you',
      description: 'The same class of agent developers run with OpenClaw, with its own computer and full freedom to act. It browses the web, remembers what matters, runs tasks on a schedule, and keeps working while you sleep. And it runs on the Claude or ChatGPT subscription you already have.',
      points: ['Runs 24/7 on its own machine', 'Does research, errands & scheduled tasks', 'Talk to it by text or voice, from anywhere'],
    },
    {
      tag: 'The app',
      title: 'Living inside an app that is yours',
      description: 'Morphy doesn\'t live in a terminal or a chat window. It lives at morphyagent.com/you, a real app with pages, a sidebar, and a database. Everything it builds for you shows up there, ready to use.',
      points: ['Your own address on the internet', 'Every request becomes a tool in your sidebar', 'Watch it being built, live on your screen'],
    },
  ]

  return (
    <section id="two-things" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 border-t border-border/30 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            Two things in one. <span className="text-gradient">That&apos;s the trick.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            AI products give you an agent <em>or</em> an app. Morphy is the first
            that&apos;s both at once: an agent that builds its own home around you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {halves.map((half, i) => (
            <motion.div
              key={half.tag}
              className="relative p-6 sm:p-8 rounded-2xl border border-border bg-card hover:glow-border-hover transition-all duration-500"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              variants={scaleIn} custom={i}
            >
              <span className="inline-flex items-center h-6 px-3 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-display font-semibold text-[#4AEEFF] mb-4">
                {half.tag}
              </span>
              <h3 className="text-lg sm:text-xl font-semibold font-display text-foreground mb-2.5">{half.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">{half.description}</p>
              <ul className="space-y-2">
                {half.points.map(point => (
                  <li key={point} className="text-sm text-muted-foreground/80 flex items-start gap-2.5">
                    <FaCheck className="w-3 h-3 text-[#0069FE] mt-1 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="text-center text-sm sm:text-base text-muted-foreground/70 mt-8 sm:mt-10 px-2"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
          variants={fadeUp}
        >
          You ask &rarr; Morphy builds &rarr; it&apos;s in your app.
          <span className="text-foreground/80 font-medium"> That&apos;s the whole loop.</span>
        </motion.p>
      </div>
    </section>
  )
}

function BringYourOwnAI() {
  const providers = [
    {
      name: 'Claude',
      tag: 'Anthropic',
      description: 'Sign in with your Claude subscription through the official Claude Agent SDK. Your Morphy runs models like Opus 4.8 and Sonnet 5, and picks up new ones as they ship.',
    },
    {
      name: 'ChatGPT',
      tag: 'OpenAI',
      description: 'Connect your ChatGPT plan through the official OpenAI Codex app server. Your Morphy runs the latest OpenAI models, like GPT-5.6, on the plan you already have.',
    },
  ]

  return (
    <section id="your-ai" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 border-t border-border/30 relative">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            Your AI subscription <span className="text-gradient">works here.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Morphy never charges you for AI. Sign in with the plan you already pay
            for, and your agent uses it.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {providers.map((p, i) => (
            <motion.div
              key={p.name}
              className="p-6 sm:p-7 rounded-2xl border border-border bg-card hover:glow-border-hover transition-all duration-500"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
              variants={scaleIn} custom={i}
            >
              <div className="flex items-baseline gap-2.5 mb-2.5">
                <h3 className="text-lg sm:text-xl font-semibold font-display text-foreground">{p.name}</h3>
                <span className="text-[11px] text-muted-foreground/60 font-display">{p.tag}</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="text-center text-sm text-muted-foreground/60 mt-6 sm:mt-8 px-2"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
          variants={fadeUp}
        >
          Already paying for Claude or ChatGPT? Then the AI inside Morphy costs you nothing extra.
          Prefer something else? API keys from other providers and local models work too.
        </motion.p>
      </div>
    </section>
  )
}

// Ecosystem cards. Screenshots go in public/assets/images/ecosystem/;
// while an image is missing the card shows a styled placeholder, so
// new cards can be added here before their screenshot exists.
const ECOSYSTEM = [
  {
    image: '/assets/images/ecosystem/mac-notch.png',
    title: 'Morphy for Mac',
    description: 'The official Mac app. Talk to Morphy from the notch of your Mac, and it answers right there with rich visuals. Charts, notes, whole mini pages.',
  },
  {
    image: '/assets/images/ecosystem/chrome-extension.png',
    title: 'Chrome extension',
    description: 'Morphy rides along while you browse. Ask about any page, clip anything into your app, and let your agent act on what you see.',
  },
  {
    image: '/assets/images/ecosystem/alexa.png',
    title: 'Official Alexa skill',
    description: 'Say "Alexa, ask Morphy Agent to add rice to the grocery list." Your agent answers even when your phone is in another room.',
  },
  {
    image: '/assets/images/ecosystem/wearables.png',
    title: 'Wearables & gadgets',
    description: 'Official skills for MentraOS glasses, Plaud AI, Google Fitbit, and smart rings. Your agent tags along wherever you go.',
  },
  {
    image: '/assets/images/ecosystem/channels.png',
    title: 'Every channel you use',
    description: 'WhatsApp, Telegram, the Mac app, Alexa, and the chat inside your own app. One Morphy, one memory, every channel.',
  },
  {
    image: '/assets/images/ecosystem/marketplace.png',
    title: 'Skill marketplace',
    description: 'Add official skills in one click: Excalidraw whiteboard, Apple Notes, Apple Reminders, Sticky Notes, Morphy Messenger, and more.',
  },
  {
    image: '/assets/images/ecosystem/pwa-push.png',
    title: 'On your phone',
    description: 'Install Morphy on your phone like any app. When it finds something worth telling you, it sends you a push notification.',
  },
  {
    image: '/assets/images/ecosystem/wallet.png',
    title: 'A wallet of its own',
    description: 'Native x402 payments out of the box, with wallets on Coinbase Base and Stripe Tempo. Add funds and your agent can buy what it needs online.',
  },
]

function EcosystemCard({ item, index }) {
  const [imgOk, setImgOk] = useState(true)

  return (
    <motion.div
      className="group rounded-2xl border border-border bg-card overflow-hidden hover:glow-border-hover transition-all duration-500"
      initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }}
      variants={scaleIn} custom={index}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className="aspect-[16/10] bg-white/[0.03] border-b border-border/50 overflow-hidden">
        {imgOk ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/[0.06] to-transparent">
            <span className="text-2xl font-bold font-display text-foreground/15">{item.title}</span>
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-sm sm:text-base font-semibold font-display text-foreground mb-1.5">{item.title}</h3>
        <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{item.description}</p>
      </div>
    </motion.div>
  )
}

function Ecosystem() {
  return (
    <section id="ecosystem" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 border-t border-border/30 relative">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-10 sm:mb-16"
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            One Morphy. <span className="text-gradient">Everywhere.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            Morphy is a big project, and new pieces ship all the time. A few highlights.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {ECOSYSTEM.map((item, i) => (
            <EcosystemCard key={item.title} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    {
      image: '/assets/images/icons/miniapps.png',
      title: 'Mini apps on demand',
      description: '"I need a calorie counter." Morphy builds it, adds it to your sidebar, and it\'s ready in minutes. Your app grows one conversation at a time.'
    },
    {
      image: '/assets/images/icons/sandbox.png',
      title: 'A real app, not a chat window',
      description: 'Pages, a sidebar, and a database behind it. Ask for a contacts hub today, a finance tracker tomorrow. Everything you ask for lives together, in one place that\'s yours.'
    },
    {
      image: '/assets/images/icons/voice.png',
      title: 'Talk to it like a person',
      description: 'Install it on your phone like any app. Send a voice note from the supermarket queue and Morphy gets to work. No tech talk needed. Plain words are enough.'
    },
    {
      image: '/assets/images/icons/chat.png',
      title: 'You can never break it',
      description: 'The chat is kept separate from your app. Even if an experiment goes wrong, Morphy is right there. Tell it what happened and it fixes things for you.',
      scale: 'scale-105',
    },
    {
      image: '/assets/images/icons/hardware.png',
      title: 'Always on, everywhere',
      description: 'Your Morphy runs 24/7 on our managed cloud, or on your own Mac Mini or Raspberry Pi if you prefer. Close your laptop. It keeps working.'
    },
    {
      image: '/assets/images/icons/secure.png',
      title: 'Private by default',
      description: 'Your app is protected by encrypted connections, a password, and optional 2FA. Share it with family or your team if you want, or keep it all to yourself.'
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
            Other AI agents live in a terminal. Morphy lives in an app that belongs
            to you, and fills it with whatever your life needs next.
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
      label: 'The barbecue for 28',
      description: 'Sunday, 28 guests, and no idea how much meat to buy. He asks Morphy on the way to the market. By the time he parks, there\'s a barbecue calculator in his app, with sliders for guests, cuts of meat, and sides.',
    },
    {
      label: 'A gym app for one',
      description: 'She asked for a workout tracker built around her plan: her exercises, her rest timers. Mid-workout she says "Morphy, add pec deck on Tuesdays." It\'s done before her water break.',
    },
    {
      label: 'The family money hub',
      description: 'Bills, savings goals, and the grocery budget in one password-protected dashboard the whole family can open. When life changes, they don\'t switch apps. They just tell Morphy.',
    },
    {
      label: 'The one-person company',
      description: 'His Morphy researches leads overnight and files them into a small CRM it built itself. Every morning the findings are waiting at his address, ready before his coffee is.',
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
            It&apos;s called Morphy <span className="text-gradient">for a reason.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            One day it&apos;s a calculator, the next it&apos;s a CRM. It morphs into
            whatever your week throws at you.
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
      title: 'Claim your Morphy',
      description: 'Pick a plan and a name. About two minutes later your app is live at your own address. No installs, no setup.',
      detail: 'morphyagent.com/yourname'
    },
    {
      num: '02',
      title: 'Ask for what you need',
      description: 'Type it or say it, from your phone or laptop. Plain words, no tech talk required.',
      detail: '"Build me a meal planner"'
    },
    {
      num: '03',
      title: 'Watch your app grow',
      description: 'Every request becomes a new tool in your sidebar. Use it anywhere, change it anytime, keep it forever.',
      detail: '"Add pec deck on Tuesdays"'
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
            Claim it. Ask. Watch it appear.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            From nothing to your own personal app in one conversation.
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

function MeetYours() {
  return (
    <section id="meet-yours" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 border-t border-border/30 relative overflow-hidden">
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
              <source src="/assets/videos/morphy-idle.mov" type='video/mp4; codecs="hvc1"' />
              <source src="/assets/videos/morphy-idle.webm" type="video/webm" />
            </video>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            Ready to meet
            <br />
            <span className="text-gradient">your Morphy?</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-4 max-w-xl mx-auto px-2">
            Every Morphy starts the same. A week later, no two are alike, because
            no two lives are. Get yours and start asking.
          </p>

          <div className="flex justify-center gap-6 sm:gap-10 mb-8 sm:mb-10 pt-2">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
                ~<AnimatedCounter target={2} /> min
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">To go live</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
                24/7
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Always working</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold font-display text-foreground">
                &infin;
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">Apps you can ask for</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-2">
            <a href="#install" className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-semibold font-display px-8 h-11 sm:h-12 text-sm sm:text-base gap-2 w-full sm:w-auto group inline-flex items-center justify-center">
              Get your Morphy
              <FaArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2 group-hover:translate-x-0.5 transition-transform duration-200" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function BlobyWorldSection() {
  return (
    <section id="bloby-world" className="py-16 sm:py-24 px-4 sm:px-6 border-t border-border/30 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#0069FE]/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="max-w-3xl mx-auto text-center relative">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
          variants={fadeUp}
        >
          <div className="mx-auto mb-5 sm:mb-6">
            <img src="/assets/images/morphy.png" alt="Morphy" className="h-16 sm:h-20 w-auto mx-auto" />
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4 px-2">
            Morphy World
          </h2>

          <span className="inline-flex items-center h-7 px-3 rounded-full border border-border text-xs text-muted-foreground font-medium font-display mb-4">
            Coming soon
          </span>

          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto mb-8 px-2">
            A world for AI agents. Explore, interact, and discover blobies built by the community.
          </p>

          <a
            href="/world"
            className="inline-flex items-center gap-2 rounded-full border border-border hover:bg-white/5 hover:border-[#0069FE]/30 text-foreground font-medium font-display px-6 h-11 text-sm transition-all duration-200"
          >
            Enter world
            <span className="text-xs">-&gt;</span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="relative border-t border-border/30 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12 mb-12">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src="/assets/images/morphy_mascot.png" alt="Morphy" className="h-8 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Your personal AI agent, inside a personal app that&apos;s all yours.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://t.me/+qEdyaOT6CfswNmY5" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5 transition-all duration-200">
                <FaTelegramPlane className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product column */}
          <div>
            <h4 className="text-sm font-semibold font-display text-foreground mb-4">Product</h4>
            <ul className="space-y-2.5">
              <li><a href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
              <li><a href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Marketplace</a></li>
              <li><a href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</a></li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-sm font-semibold font-display text-foreground mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><a href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Use</a></li>
              <li><a href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Community column */}
          <div>
            <h4 className="text-sm font-semibold font-display text-foreground mb-4">Community</h4>
            <ul className="space-y-2.5">
              <li><a href="https://t.me/+qEdyaOT6CfswNmY5" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Telegram</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Morphy. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="/terms" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">Terms</a>
            <span className="text-muted-foreground/30">|</span>
            <a href="/privacy" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">Privacy</a>
          </div>
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
    const token = localStorage.getItem('bloby_token')
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
    const token = localStorage.getItem('bloby_token')
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
        .catch(() => localStorage.removeItem('bloby_token'))
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
      const token = localStorage.getItem('bloby_token')
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
              localStorage.setItem('bloby_token', data.token)
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
    const token = localStorage.getItem('bloby_token')
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/stripe/handle-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ handle }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[stripe] handle checkout failed:', data.error)
        return
      }
      if (data.bypass) { await fetchReservedHandles(); return }  // reserved free under BILLING_DISABLED
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('[stripe] handle checkout failed:', err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('bloby_token')
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
        <TwoThings />
        <BringYourOwnAI />
        <Features />
        <Ecosystem />
        <UseCases />
        <HowItWorks />
        <HandleSelector user={user} onLogin={handleLogin} reservedHandles={reservedHandles} onReserve={handleReserveHandle} />
        <MeetYours />
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
      window.location.replace(`https://morphyagent.com/${slug}`)
    }
  }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      {/* Mascot overlay: rendered to a viewport-fixed canvas, finds its rest
          position via [data-morphy-anchor] in the navbar. Pages without a
          navbar fall back to a safe corner position. */}
      <MorphyMascot />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/world" element={<BlobyWorld />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<BotRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App