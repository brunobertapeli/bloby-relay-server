import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/button'
import {
  HiPlus, HiXMark, HiClipboardDocument,
  HiEye, HiEyeSlash, HiCheckCircle, HiChevronDown
} from 'react-icons/hi2'
import { API_URL } from '../api'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (d = 0) => ({ opacity: 1, y: 0, transition: { delay: d * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
}

const walletPresets = [5, 10, 25]

function generateClaimCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-')
}

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
  return (
    <motion.nav
      className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.img
              src="/assets/images/fluxy.png"
              alt="Fluxy"
              className="h-8 w-auto"
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            />
            <span className="text-lg font-bold font-display text-foreground">Fluxy</span>
          </Link>
          <span className="text-border select-none">/</span>
          <span className="text-sm font-medium font-display text-foreground">Dashboard</span>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-foreground/80 font-display hidden sm:inline">
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
      </div>
    </motion.nav>
  )
}

function ClaimFluxyCard() {
  const [claimCode, setClaimCode] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    setClaimCode(generateClaimCode())
  }

  const premadeMessage = claimCode
    ? `Link your self-hosted Fluxy to your fluxy.bot account using this claim code: ${claimCode}`
    : ''

  const copyMessage = () => {
    navigator.clipboard.writeText(premadeMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
      <p className="text-xs text-muted-foreground font-display">Generate a claim code and send it to your Fluxy. Once verified, it will appear here.</p>
      {!claimCode ? (
        <Button
          onClick={handleGenerate}
          className="rounded-xl bg-gradient-brand hover:opacity-90 text-white font-medium font-display h-10 px-5 text-sm"
        >
          Generate Claim Code
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-background border border-border/50 p-4">
            <p className="text-xs text-muted-foreground mb-2 font-display">Your claim code</p>
            <div className="flex items-center justify-between">
              <code className="text-lg font-mono font-semibold text-foreground tracking-wider">{claimCode}</code>
              <CopyButton text={claimCode} />
            </div>
          </div>
          <div className="rounded-xl bg-background border border-border/50 p-4">
            <p className="text-xs text-muted-foreground mb-2 font-display">Copy and paste this to your Fluxy</p>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-foreground/80 font-display flex-1">{premadeMessage}</p>
              <button onClick={copyMessage} className="text-muted-foreground hover:text-foreground transition-colors duration-200 p-1 shrink-0 mt-0.5">
                {copied ? <HiCheckCircle className="w-4 h-4 text-emerald-400" /> : <HiClipboardDocument className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            onClick={() => setClaimCode(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 font-display"
          >
            Generate another code
          </button>
        </div>
      )}
    </div>
  )
}

function FluxyCard({ fluxy, onAddBalance }) {
  const [showTopup, setShowTopup] = useState(false)
  const [selected, setSelected] = useState(null)
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const activeAmount = showCustom ? parseFloat(custom) : selected

  const handleAdd = () => {
    if (!activeAmount || activeAmount <= 0) return
    onAddBalance(fluxy.id, activeAmount)
    setSelected(null)
    setCustom('')
    setShowCustom(false)
    setShowTopup(false)
  }

  const initial = fluxy.name.charAt(0).toUpperCase()

  return (
    <div className="rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:border-border overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold font-display text-primary">{initial}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold font-display text-foreground text-sm">{fluxy.name}</h3>
            <p className="text-[11px] text-muted-foreground font-mono truncate">{fluxy.url}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-display mb-0.5">Balance</p>
            <span className="text-lg font-semibold font-display text-foreground">${fluxy.balance.toFixed(2)}</span>
          </div>
          <button
            onClick={() => setShowTopup(!showTopup)}
            className={`h-8 px-3.5 rounded-lg text-xs font-medium font-display border transition-all duration-200 ${
              showTopup
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30'
            }`}
          >
            {showTopup ? 'Cancel' : 'Add Funds'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-display shrink-0">USDC Wallet</p>
          <code className="text-[11px] text-muted-foreground font-mono truncate">{fluxy.wallet}</code>
          <CopyButton text={fluxy.wallet} />
        </div>
      </div>

      <AnimatePresence>
        {showTopup && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 pb-5 pt-3 border-t border-border/30 flex-wrap">
              {walletPresets.map((amount) => (
                <button
                  key={amount}
                  onClick={() => { setSelected(amount); setShowCustom(false) }}
                  className={`h-8 px-3.5 rounded-lg text-xs font-medium font-display border transition-all duration-200 ${
                    !showCustom && selected === amount
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  ${amount}
                </button>
              ))}
              {showCustom ? (
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="h-8 w-20 pl-6 pr-2 rounded-lg text-xs font-medium font-display border border-primary bg-primary/10 text-foreground outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setShowCustom(true); setSelected(null) }}
                  className="h-8 px-3.5 rounded-lg text-xs font-medium font-display border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200"
                >
                  Other
                </button>
              )}
              <Button
                onClick={handleAdd}
                disabled={!activeAmount || activeAmount <= 0}
                size="sm"
                className="rounded-lg bg-gradient-brand hover:opacity-90 text-white font-medium font-display h-8 px-4 text-xs disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
              >
                Add
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HandleCard({ handle, visibleHash, onToggleHash }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-border/30 last:border-b-0 gap-2 sm:gap-4">
      <span className="font-mono text-sm text-foreground">
        fluxy.bot/<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#AF27E3] to-[#04D1FE] font-semibold">{handle.handle}</span>
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
  bundle: 'bg-primary/10 text-primary border-primary/20',
  wallet: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  handle: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  hosting: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false)

  const itemCount = order.items.length
  const summary = order.items.length <= 2
    ? order.items.map(i => i.name).join(', ')
    : `${order.items[0].name} + ${order.items.length - 1} more`

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden transition-all duration-200 hover:border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold font-display text-foreground">Order #{order.id}</span>
            <span className="text-[11px] text-muted-foreground font-display">{order.date}</span>
          </div>
          <p className="text-xs text-muted-foreground font-display truncate">{summary}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {order.redeemed ? (
            <span className="text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Redeemed
            </span>
          ) : (
            <span className="text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border bg-amber-500/10 text-amber-400 border-amber-500/20">
              Pending
            </span>
          )}
          <span className="text-sm font-semibold font-display text-foreground">{order.total}</span>
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
                  {order.redeemed ? (
                    <span className="text-xs text-muted-foreground/40 font-mono line-through">{order.redeemCode}</span>
                  ) : (
                    <>
                      <code className="text-xs font-mono font-semibold text-foreground">{order.redeemCode}</code>
                      <CopyButton text={order.redeemCode} />
                    </>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground font-display">
                  Fluxy: <span className="text-foreground font-medium">{order.fluxy}</span>
                </span>
              </div>

              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 border-t border-border/20">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={`text-[10px] font-semibold font-display uppercase px-2 py-0.5 rounded-md border shrink-0 ${typeStyles[item.type] || typeStyles.skill}`}>
                      {item.type}
                    </span>
                    <span className="text-sm text-foreground font-display truncate">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium font-display text-muted-foreground shrink-0 ml-4">{item.amount}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const mockFluxies = [
  { id: 'fluxy-1', name: 'Jarvis', url: 'fluxy.bot/jarvis', balance: 12.50, wallet: '0x7a3B...4f2E' },
  { id: 'fluxy-2', name: 'Nova', url: 'my.fluxy.bot/nova', balance: 0, wallet: '0x9c1D...8b3A' },
  { id: 'fluxy-3', name: 'Atlas', url: 'fluxy.bot/atlas', balance: 25.00, wallet: '0x2e5F...1d7C' },
]

const mockOrders = [
  {
    id: '1042',
    date: 'Mar 28, 2026',
    fluxy: 'Jarvis',
    total: '$77.00',
    redeemCode: 'RDM-7K4P-X9BN-Q2LF',
    redeemed: false,
    items: [
      { type: 'bundle', name: 'Fluxy for Lawyers', amount: '$49.00' },
      { type: 'skill', name: 'Gmail Integration', amount: '$3.00' },
      { type: 'wallet', name: 'Wallet Top-up', amount: '$25.00' },
    ],
  },
  {
    id: '1038',
    date: 'Mar 20, 2026',
    fluxy: 'Jarvis',
    total: '$10.00',
    redeemCode: 'RDM-2NVT-8HCW-J5MR',
    redeemed: true,
    items: [
      { type: 'skill', name: 'WhatsApp Business', amount: '$5.00' },
      { type: 'handle', name: 'fluxy.bot/jarvis', amount: '$5.00' },
    ],
  },
  {
    id: '1031',
    date: 'Mar 15, 2026',
    fluxy: 'Atlas',
    total: '$69.00',
    redeemCode: 'RDM-5FGY-3KPL-W8DN',
    redeemed: true,
    items: [
      { type: 'bundle', name: 'Fluxy for Hotels', amount: '$69.00' },
    ],
  },
  {
    id: '1025',
    date: 'Mar 8, 2026',
    fluxy: 'Nova',
    total: '$29.00/mo',
    redeemCode: 'RDM-9QAZ-6TBX-M4JR',
    redeemed: true,
    items: [
      { type: 'hosting', name: 'Starter Instance (NA)', amount: '$29.00/mo' },
      { type: 'skill', name: 'Slack Integration', amount: 'Free' },
    ],
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [reservedHandles, setReservedHandles] = useState([])
  const [fluxies, setFluxies] = useState(mockFluxies)
  const [orders] = useState(mockOrders)
  const [visibleHashes, setVisibleHashes] = useState({})
  const [showClaim, setShowClaim] = useState(false)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    const token = localStorage.getItem('fluxy_token')
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
        } else {
          navigate('/')
        }
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('fluxy_token')
        setLoading(false)
        navigate('/')
      })
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('fluxy_token')
    setUser(null)
    setReservedHandles([])
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
    navigate('/')
  }

  const handleAddBalance = (fluxyId, amount) => {
    setFluxies(prev => prev.map(f =>
      f.id === fluxyId ? { ...f, balance: f.balance + amount } : f
    ))
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
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">My Fluxies</h2>
            <button
              onClick={() => setShowClaim(!showClaim)}
              className="flex items-center gap-1.5 text-sm font-medium font-display text-primary hover:text-primary/80 transition-colors duration-200"
            >
              <HiPlus className="w-4 h-4" />
              Claim a Fluxy
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
                <ClaimFluxyCard />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fluxies.map((fluxy) => (
              <FluxyCard key={fluxy.id} fluxy={fluxy} onAddBalance={handleAddBalance} />
            ))}
          </div>
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
                to="/#handle"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium font-display transition-colors duration-200"
              >
                Reserve your first handle
                <span className="text-xs">-&gt;</span>
              </Link>
            </div>
          )}
          <p className="text-xs text-muted-foreground/60 mt-3 font-display">
            Use the activation code during <code className="text-foreground/50">fluxy init</code> to claim your handle
          </p>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Purchase History</h2>
          </div>
          {orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground font-display mb-3">No purchases yet.</p>
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
    </div>
  )
}
