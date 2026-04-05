import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/button'
import {
  HiPlus, HiXMark, HiClipboardDocument,
  HiEye, HiEyeSlash, HiCheckCircle, HiChevronDown,
  HiBars3
} from 'react-icons/hi2'
import { FaDiscord } from 'react-icons/fa'
import { API_URL } from '../api'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (d = 0) => ({ opacity: 1, y: 0, transition: { delay: d * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
}

const CLAIM_POLL_INTERVAL = 3000
const CLAIM_DURATION = 300 // 5 minutes in seconds

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className={`text-muted-foreground hover:text-foreground transition-colors duration-200 p-1 ${className}`}>
      {copied ? <HiCheckCircle className="w-4 h-4 text-emerald-400" /> : <HiClipboardDocument className="w-4 h-4" />}
    </button>
  )
}

function DashNavbar({ user, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const navLinks = [
    { href: '/#features', label: 'Features' },
    { href: '/#how-it-works', label: 'How it works' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/square', label: 'Square' },
    { href: '/docs', label: 'Docs' },
  ]

  return (
    <>
      <motion.nav
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.img
              src="/assets/images/bloby.png"
              alt="Bloby"
              className="h-8 w-auto"
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            />
            <span className="text-lg font-bold font-display text-foreground">Bloby</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              link.href.includes('#') ? (
                <a key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  {link.label}
                </Link>
              )
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="https://discord.gg/QERDj3CBFj" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <FaDiscord className="w-[18px] h-[18px]" />
            </a>
            <div className="hidden sm:flex items-center gap-3">
              {user && (
                <>
                  <span className="text-sm text-foreground/80 font-display">
                    {user.name?.split(' ')[0]}
                  </span>
                  <button
                    onClick={onLogout}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 underline underline-offset-2"
                  >
                    Sair
                  </button>
                </>
              )}
            </div>
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
            className="fixed inset-0 z-[60] sm:hidden"
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <img src="/assets/images/bloby.png" alt="Bloby" className="h-7 w-auto" />
                  <span className="font-bold font-display text-foreground">Bloby</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              {user && (
                <div className="mb-4">
                  <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-white/[0.03] border border-border/50">
                    <span className="text-sm text-foreground/80 font-display">
                      Hey, <span className="font-semibold text-foreground">{user.name?.split(' ')[0]}</span>
                    </span>
                    <button
                      onClick={() => { onLogout(); setMobileOpen(false) }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 underline underline-offset-2"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 px-3 rounded-xl text-base text-foreground font-medium bg-white/5 transition-colors duration-200"
                >
                  Dashboard
                </Link>
                {navLinks.map(link => (
                  link.href.includes('#') ? (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="py-3 px-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="py-3 px-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  )
                ))}
              </div>

              <div className="mt-auto">
                <a href="https://discord.gg/QERDj3CBFj" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 h-10 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-all duration-200">
                  <FaDiscord className="w-4 h-4" /> Discord
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function ClaimBlobyCard({ onClaimed }) {
  const [claimCode, setClaimCode] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(false)
  const [claimed, setClaimed] = useState(null)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)
  const timerRef = useRef(null)

  const cleanup = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    pollRef.current = null
    timerRef.current = null
  }

  useEffect(() => () => cleanup(), [])

  const handleGenerate = async () => {
    cleanup()
    setError(null)
    setClaimed(null)
    setLoading(true)

    try {
      const token = localStorage.getItem('bloby_token')
      const res = await fetch(`${API_URL}/api/claim/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to generate code')
      }

      const { code, expiresAt } = await res.json()
      setClaimCode(code)

      // Countdown
      const expDate = new Date(expiresAt)
      const tick = () => {
        const remaining = Math.max(0, Math.floor((expDate - Date.now()) / 1000))
        setTimeLeft(remaining)
        if (remaining <= 0) {
          cleanup()
          setClaimCode(null)
        }
      }
      tick()
      timerRef.current = setInterval(tick, 1000)

      // Poll for claim status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/api/claim/status/${code}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (statusRes.ok) {
            const status = await statusRes.json()
            if (status.claimed) {
              cleanup()
              setClaimed(status.bloby)
              onClaimed?.()
            }
          }
        } catch { /* silent — next poll will retry */ }
      }, CLAIM_POLL_INTERVAL)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const premadeMessage = claimCode
    ? `I need you to link yourself to my bloby.bot dashboard. Use this claim code to verify: ${claimCode}`
    : ''

  if (claimed) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <HiCheckCircle className="w-5 h-5 text-emerald-400" />
          <p className="text-sm font-medium font-display text-emerald-400">Bloby claimed successfully!</p>
        </div>
        <p className="text-xs text-muted-foreground font-display">
          <span className="text-foreground font-medium">{claimed.username}</span> is now linked to your dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
      <p className="text-xs text-muted-foreground font-display">Generate a claim code and send it to your Bloby. Once verified, it will appear here.</p>
      {error && <p className="text-xs text-red-400 font-display">{error}</p>}
      {!claimCode ? (
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-xl bg-gradient-brand hover:opacity-90 text-white font-medium font-display h-10 px-5 text-sm disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Claim Code'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-background border border-border/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-display">Your claim code</p>
              <span className="text-xs font-mono text-muted-foreground/60">{formatTime(timeLeft)}</span>
            </div>
            <code className="text-lg font-mono font-semibold text-foreground tracking-wider">{claimCode}</code>
            <div className="mt-3 h-1 rounded-full bg-border/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${(timeLeft / CLAIM_DURATION) * 100}%` }}
              />
            </div>
          </div>
          <div className="rounded-xl bg-background border border-border/50 p-4">
            <p className="text-xs text-muted-foreground mb-2 font-display">Copy and paste this to your Bloby</p>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-foreground/80 font-display flex-1">{premadeMessage}</p>
              <CopyButton text={premadeMessage} className="shrink-0 mt-0.5" />
            </div>
          </div>
          <button
            onClick={handleGenerate}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 font-display"
          >
            Generate another code
          </button>
        </div>
      )}
    </div>
  )
}

const fundPresets = [5, 10, 25]

function FundWalletModal({ bloby, onClose, onFunded }) {
  const [selected, setSelected] = useState(null)
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [step, setStep] = useState('select') // 'select' | 'loading' | 'pay' | 'done'
  const [error, setError] = useState(null)
  const onrampRef = useRef(null)
  const [onrampSession, setOnrampSession] = useState(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      onrampSession?.destroy?.()
    }
  }, [])

  // Mount the onramp widget once the container and session are both ready
  useEffect(() => {
    if (step === 'pay' && onrampSession && onrampRef.current) {
      onrampRef.current.innerHTML = ''
      onrampSession.mount(onrampRef.current)
    }
  }, [step, onrampSession])

  const activeAmount = showCustom ? parseFloat(custom) : selected
  const canProceed = activeAmount && activeAmount > 0

  const handleProceed = async () => {
    if (!canProceed) return
    setStep('loading')
    setError(null)

    try {
      const token = localStorage.getItem('bloby_token')
      const res = await fetch(`${API_URL}/api/stripe/onramp-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ blobyId: bloby.id, amount: activeAmount }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create session')
      }

      const { clientSecret } = await res.json()

      const { loadStripeOnramp } = await import('@stripe/crypto')
      const stripeOnramp = await loadStripeOnramp(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
      const session = stripeOnramp.createSession({
        clientSecret,
        appearance: { theme: 'dark' },
      })

      session.addEventListener('onramp_session_updated', (e) => {
        if (e.payload.session.status === 'fulfillment_complete') {
          setStep('done')
          onFunded?.()
        }
      })

      setOnrampSession(session)
      setStep('pay')
    } catch (err) {
      console.error('[fund] onramp error:', err)
      setError(err.message)
      setStep('select')
    }
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={step !== 'loading' ? onClose : undefined}
      />
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-background border border-border/50 rounded-2xl w-full max-w-md shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="flex items-center justify-between p-5 border-b border-border/30">
            <div className="flex items-center gap-3">
              <img src="/assets/images/icons/wallet.png" alt="Wallet" className="h-8 w-auto" />
              <div>
                <h3 className="text-base font-bold font-display text-foreground">Fund Wallet</h3>
                <p className="text-xs text-muted-foreground">{bloby.name} &middot; USDC</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {step === 'select' && (
              <>
                {error && <p className="text-xs text-red-400 font-display mb-3">{error}</p>}
                <p className="text-xs text-muted-foreground mb-3">Select an amount to add</p>
                <div className="flex items-center gap-2 mb-4">
                  {fundPresets.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => { setSelected(amount); setShowCustom(false) }}
                      className={`flex-1 h-11 rounded-xl text-sm font-medium font-display border transition-all duration-200 ${
                        !showCustom && selected === amount
                          ? 'border-foreground/30 bg-foreground/10 text-foreground'
                          : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                  {showCustom ? (
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                        placeholder="0"
                        autoFocus
                        className="h-11 w-full pl-7 pr-3 rounded-xl text-sm font-medium font-display border border-foreground/30 bg-foreground/10 text-foreground outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setShowCustom(true); setSelected(null) }}
                      className="flex-1 h-11 rounded-xl text-sm font-medium font-display border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200"
                    >
                      Other
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 h-11 rounded-full border border-border/50 text-sm font-medium font-display text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProceed}
                    disabled={!canProceed}
                    className="flex-1 h-11 rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Purchase {canProceed ? `$${activeAmount.toFixed(2)}` : ''}
                  </button>
                </div>
              </>
            )}

            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
                />
                <p className="text-xs text-muted-foreground font-display">Loading payment...</p>
              </div>
            )}

            {step === 'pay' && (
              <>
                <div ref={onrampRef} className="min-h-[400px] rounded-xl overflow-hidden mb-4" />
                <button
                  onClick={onClose}
                  className="w-full h-11 rounded-full border border-border/50 text-sm font-medium font-display text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200"
                >
                  Cancel
                </button>
              </>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <HiCheckCircle className="w-12 h-12 text-emerald-400" />
                <div className="text-center">
                  <p className="text-sm font-semibold font-display text-foreground mb-1">Funds delivered!</p>
                  <p className="text-xs text-muted-foreground font-display">
                    ${activeAmount.toFixed(2)} USDC has been sent to {bloby.name}'s wallet.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="h-11 px-8 rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display text-sm transition-all duration-200"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}

function BlobyCard({ bloby, onAddFunds }) {
  const hasWallet = !!bloby.walletAddress
  const truncatedWallet = hasWallet
    ? `${bloby.walletAddress.slice(0, 6)}...${bloby.walletAddress.slice(-4)}`
    : null
  const balanceNum = parseFloat(bloby.balance || '0')
  const formattedBalance = balanceNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="group rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-border/80 hover:shadow-lg hover:shadow-black/5 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src="/assets/images/bloby.png"
              alt={bloby.name}
              className="w-9 h-9 object-contain"
              style={{ filter: 'grayscale(1) opacity(0.55)' }}
            />
            <span className={`absolute bottom-1.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${bloby.isOnline ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold font-display text-foreground text-sm leading-tight">{bloby.name}</h3>
            <p className="text-[11px] text-muted-foreground/60 font-mono truncate mt-0.5">{bloby.url}</p>
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-display mb-1">Balance</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold font-display text-foreground tracking-tight">${formattedBalance}</span>
              <span className="text-[10px] text-muted-foreground/40 font-display">USDC</span>
            </div>
          </div>
          <button
            onClick={() => onAddFunds(bloby)}
            className="flex items-center gap-1.5 h-7 text-muted-foreground/50 hover:text-primary transition-all duration-200 text-[11px] font-medium font-display"
          >
            <span className="w-6 h-6 rounded-md border border-border/50 flex items-center justify-center hover:border-primary/40">
              <HiPlus className="w-3 h-3" />
            </span>
            Add Funds
          </button>
        </div>
      </div>

      {/* Wallet */}
      <div className="px-5 py-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-display">USDC Wallet</p>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${hasWallet ? 'bg-emerald-400/60' : 'bg-amber-400/60'}`} />
            <span className="text-[10px] text-muted-foreground/50 font-display">{hasWallet ? 'Linked' : 'Not linked'}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
          <svg className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
          </svg>
          <span className={`text-[11px] font-mono flex-1 ${hasWallet ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`}>
            {truncatedWallet || '0x0000...0000'}
          </span>
          {hasWallet && <CopyButton text={bloby.walletAddress} />}
        </div>
      </div>
    </div>
  )
}

function HandleCard({ handle, visibleHash, onToggleHash }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-border/30 last:border-b-0 gap-2 sm:gap-4">
      <span className="font-mono text-sm text-foreground">
        bloby.bot/<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#AF27E3] to-[#04D1FE] font-semibold">{handle.handle}</span>
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground/60 font-display shrink-0">Activation code:</span>
        <code className="font-mono text-xs text-muted-foreground select-all">
          {visibleHash ? handle.hash : '\u2022\u2022\u2022\u2022\u2022'}
        </code>
        {visibleHash && <CopyButton text={handle.hash} />}
        <button
          onClick={onToggleHash}
          className="text-muted-foreground hover:text-foreground transition-colors duration-200 p-1"
        >
          {visibleHash ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

const typeStyles = {
  skill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  service: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  blueprint: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  bundle: 'bg-primary/10 text-primary border-primary/20',
  wallet: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  handle: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  hosting: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(amount) {
  if (amount === 0) return 'Free'
  return `$${amount.toFixed(2)}`
}

function PurchaseCard({ tx }) {
  const [expanded, setExpanded] = useState(false)

  const summary = tx.items?.length <= 2
    ? tx.items.map(i => i.name).join(', ')
    : `${tx.items[0].name} + ${tx.items.length - 1} more`

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden transition-all duration-200 hover:border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border shrink-0 ${typeStyles[tx.productType] || typeStyles.skill}`}>
              {tx.productType}
            </span>
            <span className="text-sm font-semibold font-display text-foreground">{tx.productName}</span>
          </div>
          <p className="text-xs text-muted-foreground font-display truncate">{summary}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {tx.redeemed ? (
            <span className="text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Redeemed
            </span>
          ) : (
            <span className="text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border bg-amber-500/10 text-amber-400 border-amber-500/20">
              Pending
            </span>
          )}
          <span className="text-sm font-semibold font-display text-foreground">{formatPrice(tx.totalSpent)}</span>
          <HiChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30">
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-display shrink-0">Redeem Code</p>
                  {tx.redeemed ? (
                    <span className="text-xs text-muted-foreground/40 font-mono line-through">{tx.redeemCode}</span>
                  ) : (
                    <>
                      <code className="text-xs font-mono font-semibold text-foreground">{tx.redeemCode}</code>
                      <CopyButton text={tx.redeemCode} />
                    </>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground/50 font-display">{formatDate(tx.firstAt)}</span>
              </div>

              {tx.items?.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 border-t border-border/20">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border shrink-0 ${typeStyles[item.type] || typeStyles.skill}`}>
                      {item.type}
                    </span>
                    <span className="text-sm text-foreground font-display truncate">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium font-display text-muted-foreground shrink-0 ml-4">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BotTransactionCard({ tx }) {
  const isService = tx.productType === 'service'

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden transition-all duration-200 hover:border-border px-5 py-4 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border shrink-0 ${typeStyles[tx.productType] || typeStyles.skill}`}>
            {tx.productType}
          </span>
          <span className="text-sm font-semibold font-display text-foreground">{tx.productName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-display">{tx.botUsername}</span>
          <span className="text-[11px] text-muted-foreground/50 font-display">{formatDate(tx.lastAt)}</span>
          {isService && tx.usageCount > 0 && (
            <span className="text-[11px] text-muted-foreground font-display">
              {tx.usageCount} {tx.usageCount === 1 ? 'use' : 'uses'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold font-display text-foreground">
          {isService && tx.usageCount > 1 ? formatPrice(tx.totalSpent) : formatPrice(tx.unitPrice)}
        </span>
        {isService && tx.unitPrice > 0 && (
          <span className="text-[10px] text-muted-foreground font-display">
            {formatPrice(tx.unitPrice)}/use
          </span>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [reservedHandles, setReservedHandles] = useState([])
  const [blobies, setBlobies] = useState([])
  const [transactions, setTransactions] = useState([])
  const [visibleHashes, setVisibleHashes] = useState({})
  const [showClaim, setShowClaim] = useState(false)
  const [fundingBloby, setFundingBloby] = useState(null)
  const [loading, setLoading] = useState(true)
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

  const fetchBlobies = async () => {
    const token = localStorage.getItem('bloby_token')
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/claim/blobies`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBlobies(data.blobies || [])
      }
    } catch (err) {
      console.error('[blobies] fetch failed:', err)
    }
  }

  const fetchTransactions = async () => {
    const token = localStorage.getItem('bloby_token')
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/marketplace/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setTransactions(data || [])
      }
    } catch (err) {
      console.error('[transactions] fetch failed:', err)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('bloby_token')
    if (!token) {
      setLoading(false)
      navigate('/')
      return
    }
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.user) {
          setUser(data.user)
          fetchReservedHandles()
          fetchBlobies()
          fetchTransactions()
        } else {
          navigate('/')
        }
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('bloby_token')
        setLoading(false)
        navigate('/')
      })
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('bloby_token')
    setUser(null)
    setReservedHandles([])
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
    navigate('/')
  }

  const toggleHash = (handle) => {
    setVisibleHashes(prev => ({ ...prev, [handle]: !prev[handle] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <DashNavbar user={user} onLogout={handleLogout} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 sm:space-y-14">
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">My Blobies</h2>
            <button
              onClick={() => setShowClaim(!showClaim)}
              className="flex items-center gap-1.5 text-sm font-medium font-display text-primary hover:text-primary/80 transition-colors duration-200"
            >
              <HiPlus className="w-4 h-4" />
              Claim a Bloby
            </button>
          </div>
          <AnimatePresence>
            {showClaim && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden mb-4"
              >
                <ClaimBlobyCard onClaimed={fetchBlobies} />
              </motion.div>
            )}
          </AnimatePresence>
          {blobies.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {blobies.map((bloby) => (
                <BlobyCard key={bloby.id} bloby={bloby} onAddFunds={setFundingBloby} />
              ))}
            </div>
          ) : !showClaim && (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground font-display mb-3">No Blobies linked yet.</p>
              <button
                onClick={() => setShowClaim(true)}
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium font-display transition-colors duration-200"
              >
                Claim your first Bloby
                <span className="text-xs">-&gt;</span>
              </button>
            </div>
          )}
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">My Handles</h2>
          </div>
          {reservedHandles.length > 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
              {reservedHandles.map((rh) => (
                <HandleCard
                  key={rh.handle}
                  handle={rh}
                  visibleHash={visibleHashes[rh.handle]}
                  onToggleHash={() => toggleHash(rh.handle)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground font-display mb-3">You haven't reserved any handles yet.</p>
              <Link
                to="/#reserve"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium font-display transition-colors duration-200"
              >
                Reserve your first handle
                <span className="text-xs">-&gt;</span>
              </Link>
            </div>
          )}
          <p className="text-xs text-muted-foreground/60 mt-3 font-display">
            Use the activation code during <code className="text-foreground/50">bloby init</code> to claim your handle
          </p>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Transaction History</h2>
          </div>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                tx.source === 'purchase'
                  ? <PurchaseCard key={`purchase-${tx.redeemCode}`} tx={tx} />
                  : <BotTransactionCard key={`bot-${tx.botUsername}-${tx.productId}`} tx={tx} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground font-display mb-3">No transactions yet.</p>
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium font-display transition-colors duration-200"
              >
                Browse the Marketplace
                <span className="text-xs">-&gt;</span>
              </Link>
            </div>
          )}
        </motion.section>
      </main>

      <AnimatePresence>
        {fundingBloby && (
          <FundWalletModal
            bloby={fundingBloby}
            onClose={() => setFundingBloby(null)}
            onFunded={fetchBlobies}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
