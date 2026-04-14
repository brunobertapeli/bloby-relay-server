import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import Navbar from '../components/Navbar'
import { API_URL } from '../api'
import Markdown from 'react-markdown'
import {
  HiMagnifyingGlass, HiInformationCircle,
  HiShoppingCart, HiXMark, HiTrash, HiPlus,
  HiChevronLeft, HiChevronRight, HiCheckCircle, HiClipboardDocument,
  HiLink
} from 'react-icons/hi2'

const filterOptions = ['Featured', 'Popular', 'Latest']

// Normalize products.json items for the UI
function normalizeSkill(s) {
  return { ...s, type: 'skill', title: s.name, price: s.price === 0 ? 'Free' : `$${s.price.toFixed(2)}`, priceNum: s.price, forHumans: true, forAgents: true }
}
function authorLabel(item) {
  if (item.bloby && item.bloby_human) return `${item.bloby} (${item.bloby_human})`
  if (item.bloby) return item.bloby
  return item.vendor || 'Bloby'
}

function normalizeBundle(b, allSkills) {
  const resolvedSkills = (b.skills || b.items || []).map(id => {
    const skill = allSkills.find(s => s.id === id)
    return skill ? { name: skill.name, bloby: skill.bloby, bloby_human: skill.bloby_human } : { name: id }
  })
  return { ...b, type: 'bundle', title: b.name, price: b.price === 0 ? 'Free' : `$${b.price.toFixed(2)}`, priceNum: b.price, forHumans: true, forAgents: true, skills: resolvedSkills }
}
function normalizeBlueprint(b) {
  return { ...b, type: 'blueprint', title: b.name, price: b.price === 0 ? 'Free' : `$${b.price.toFixed(2)}`, priceNum: b.price, forHumans: true, forAgents: true }
}
function normalizeService(s) {
  return { ...s, type: 'service', title: s.name, price: s.price === 0 ? 'Free' : `$${s.price}`, priceNum: s.price, forHumans: false, forAgents: true }
}

// Collect all unique categories across a product array
function collectCategories(items) {
  const cats = new Set()
  items.forEach(item => (item.categories || []).forEach(c => cats.add(c)))
  return ['All', ...Array.from(cats).sort()]
}


const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
}

function Stars({ rating }) {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i < full ? 'text-amber-400' : i === full && half ? 'text-amber-400' : 'text-muted-foreground/30'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function ItemIcon({ name }) {
  const colors = {
    'WhatsApp': 'bg-emerald-500/20 text-emerald-400',
    'Google Workspace': 'bg-blue-500/20 text-blue-400',
    'Clinic Secretary': 'bg-rose-500/20 text-rose-400',
    "Doctor's Secretary Bundle": 'bg-rose-500/20 text-rose-400',
    'Standard Workspace (Light Theme)': 'bg-amber-500/20 text-amber-400',
    'Workspace Lock': 'bg-sky-500/20 text-sky-400',
    'Test Service': 'bg-violet-500/20 text-violet-400',
    'Credits': 'bg-amber-500/20 text-amber-400',
  }
  const cls = colors[name] || 'bg-primary/20 text-primary'
  return (
    <div className={`w-8 h-8 rounded-lg ${cls} flex items-center justify-center text-xs font-bold font-display shrink-0`}>
      {name.charAt(0)}
    </div>
  )
}

function ProductImage({ id, name }) {
  const [exists, setExists] = useState(null)
  const src = `/assets/marketplace_img/${id}.png`

  useEffect(() => {
    const img = new Image()
    img.onload = () => setExists(true)
    img.onerror = () => setExists(false)
    img.src = src
  }, [src])

  if (!exists) return null

  return (
    <div className="px-5 pt-5">
      <div className="rounded-xl bg-card border border-border/30 overflow-hidden flex items-center justify-center">
        <img src={src} alt={name} className="w-full h-auto object-contain" />
      </div>
    </div>
  )
}

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-200"
      >
        <HiInformationCircle className="w-5 h-5" />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setShow(false)} />
          <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-xl bg-foreground text-background text-xs leading-relaxed shadow-lg z-50 pointer-events-none">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
          </div>
          <div className="sm:hidden fixed left-4 right-4 top-1/2 -translate-y-1/2 p-4 rounded-xl bg-foreground text-background text-xs leading-relaxed shadow-2xl z-50">
            {text}
          </div>
        </>
      )}
    </div>
  )
}

function CategoryDropdown({ categories, active, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 text-xs font-medium transition-colors duration-200 ${
          active !== 'All' ? 'text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'
        }`}
      >
        {active === 'All' ? 'Category' : active}
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 rounded-xl border border-border/50 bg-card shadow-xl z-50 py-1 max-h-52 overflow-y-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { onChange(cat); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors duration-150 ${
                active === cat ? 'text-primary bg-primary/5 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-card/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterTabs({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {filterOptions.map((opt, i) => (
        <span key={opt} className="flex items-center gap-1">
          {i > 0 && <span className="text-border mx-1 select-none">|</span>}
          <button
            onClick={() => onChange(opt)}
            className={`font-medium transition-colors duration-200 ${
              active === opt
                ? 'text-primary'
                : 'text-muted-foreground/60 hover:text-muted-foreground'
            }`}
          >
            {opt}
          </button>
        </span>
      ))}
    </div>
  )
}

function BlobyIcon({ active }) {
  return (
    <img
      src="/assets/images/bloby.png"
      alt=""
      className="w-5 h-5 object-contain transition-all duration-200"
      style={{ filter: active ? 'brightness(1.3) saturate(0.3)' : 'grayscale(1) opacity(0.55)' }}
    />
  )
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border/50 bg-card/80 p-1">
      <button
        onClick={() => onChange('humans')}
        className={`flex items-center gap-1.5 h-8 px-4 rounded-full text-sm font-medium font-display transition-all duration-200 ${
          mode === 'humans'
            ? 'bg-gradient-brand text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 20 20" fill="url(#user-grad)">
          <defs>
            <linearGradient id="user-grad" x1="0" y1="0" x2="1" y2="1">
              {mode === 'humans' ? (
                <>
                  <stop offset="0%" stopColor="#C8F0F0" />
                  <stop offset="50%" stopColor="#A262A1" />
                  <stop offset="100%" stopColor="#BD8C95" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#969696" />
                  <stop offset="50%" stopColor="#424242" />
                  <stop offset="100%" stopColor="#585858" />
                </>
              )}
            </linearGradient>
          </defs>
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
        For Humans
      </button>
      <button
        onClick={() => onChange('agents')}
        className={`flex items-center gap-1.5 h-8 px-4 rounded-full text-sm font-medium font-display transition-all duration-200 ${
          mode === 'agents'
            ? 'bg-gradient-brand text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <BlobyIcon active={mode === 'agents'} />
        For Agents
      </button>
    </div>
  )
}

function AgentBanner() {
  const [copied, setCopied] = useState(false)
  const marketplaceUrl = 'https://bloby.bot/api/marketplace.md'

  const handleCopy = () => {
    navigator.clipboard.writeText(marketplaceUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5 mb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div>
            <h3 className="text-sm font-semibold font-display text-foreground">Agent Marketplace</h3>
            <p className="text-xs text-muted-foreground">Send this URL to your agent so it can browse and purchase items autonomously</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border/50 bg-background hover:border-primary/30 transition-all duration-200 group shrink-0"
        >
          <HiLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
          <code className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors duration-200 max-w-[200px] truncate">{marketplaceUrl}</code>
          {copied ? (
            <HiCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <HiClipboardDocument className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors duration-200 shrink-0" />
          )}
        </button>
      </div>
    </motion.div>
  )
}

function Carousel({ children, className = '' }) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  const scroll = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 300, behavior: 'smooth' })
  }

  return (
    <div className="relative group/carousel">
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        onLoad={checkScroll}
        className={`overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 snap-x snap-mandatory ${className}`}
      >
        {children}
      </div>
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-xl bg-background/90 border border-border/50 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border shadow-lg transition-all duration-200 opacity-0 group-hover/carousel:opacity-100"
        >
          <HiChevronLeft className="w-5 h-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-xl bg-background/90 border border-border/50 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border shadow-lg transition-all duration-200 opacity-0 group-hover/carousel:opacity-100"
        >
          <HiChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}



function ConfettiDot({ delay, left }) {
  const colors = ['bg-primary', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-violet-400']
  const color = colors[Math.floor(Math.random() * colors.length)]
  return (
    <motion.div
      className={`absolute w-2 h-2 rounded-full ${color}`}
      style={{ left: `${left}%`, top: '-8px' }}
      initial={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, 200 + Math.random() * 150],
        x: [0, (Math.random() - 0.5) * 120],
        scale: [1, 0.6],
        rotate: [0, Math.random() * 360],
      }}
      transition={{ duration: 1.8 + Math.random() * 0.8, delay, ease: 'easeOut' }}
    />
  )
}

const CREDIT_PRESETS = [5, 10, 20]

function CartSheet({ cart, onClose, onRemove, onCheckout, onAddCredit, success, checkingOut }) {
  const total = cart.reduce((sum, item) => sum + item.priceNum * item.qty, 0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const redeemCode = success?.code || ''
  const itemNames = success ? success.items.map(i => i.name || i.title) : []
  const creditOnly = success ? success.items.every(i => i.type === 'credit') : false

  const premadeMessage = redeemCode
    ? `I bought new skills for you from the Bloby Marketplace. Redeem with this code: ${redeemCode}`
    : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(premadeMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <motion.div
        className="hidden sm:block fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:bottom-0 z-[80] w-full sm:w-[420px] bg-background sm:border-l border-border/50 flex flex-col shadow-2xl"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            {success ? (
              <HiCheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <HiShoppingCart className="w-5 h-5 text-foreground" />
            )}
            <h2 className="text-lg font-bold font-display text-foreground">
              {success ? 'Order Complete' : 'Your Cart'}
            </h2>
            {!success && cart.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="relative overflow-hidden">
              {[...Array(30)].map((_, i) => (
                <ConfettiDot key={i} delay={i * 0.04} left={Math.random() * 100} />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              className="flex justify-center mt-1 mb-1"
            >
              <video
                autoPlay
                muted
                playsInline
                className="w-[200px] object-contain"
              >
                <source src="/assets/videos/bloby_happy_reappearing.mov" type='video/mp4; codecs="hvc1"' />
                <source src="/assets/videos/bloby_happy_reappearing.webm" type="video/webm" />
              </video>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-8"
            >
              <h3 className="text-xl font-bold font-display text-foreground mb-2">Success!</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {creditOnly
                  ? 'Credits have been added to your account balance.'
                  : 'Send the code below to any of your Bloby agents to redeem.'}
              </p>
            </motion.div>

            {!creditOnly && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="rounded-xl border border-border/30 bg-card p-4 mb-5"
              >
                <p className="text-xs text-muted-foreground mb-3">
                  Send this code to your agent to redeem:
                </p>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border/50 mb-4">
                  <code className="flex-1 text-sm font-mono text-primary tracking-wide break-all">{redeemCode}</code>
                </div>

                <p className="text-xs text-muted-foreground mb-2">Or copy a premade message:</p>
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-2 p-3 rounded-lg border border-border/30 bg-background hover:border-primary/30 transition-all duration-200 text-left group"
                >
                  <p className="flex-1 text-xs text-muted-foreground leading-relaxed">{premadeMessage}</p>
                  <div className="shrink-0 w-8 h-8 rounded-md border border-border/50 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/40 transition-all duration-200">
                    {copied ? (
                      <HiCheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <HiClipboardDocument className="w-4 h-4" />
                    )}
                  </div>
                </button>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="space-y-2"
            >
              <p className="text-xs text-muted-foreground font-medium mb-2">Items purchased</p>
              {success.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <HiCheckCircle className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-sm text-foreground">{item.name || item.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.price}</span>
                </div>
              ))}
            </motion.div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <HiShoppingCart className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm text-muted-foreground mb-1">Your cart is empty</p>
                  <p className="text-xs text-muted-foreground/60">Add skills or bundles from the marketplace</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border/30 bg-card"
                    >
                      <ItemIcon name={item.name || item.title} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium font-display text-foreground leading-tight">{item.name || item.title}</p>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{item.type}</p>
                          </div>
                          <button
                            onClick={() => onRemove(item.id)}
                            className="p-1 rounded-md text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors duration-200 shrink-0"
                          >
                            <HiTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="mt-2">
                          <span className="text-sm font-semibold text-foreground">{item.price}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-5 border-t border-border/50">
                {!cart.some(c => c.type === 'credit') && (
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-display mb-2">Add Credits</p>
                    <div className="flex items-center gap-2">
                      {CREDIT_PRESETS.slice(0, 2).map(amount => (
                        <button
                          key={amount}
                          onClick={() => onAddCredit(amount)}
                          className="flex-1 h-8 rounded-lg border border-border/50 bg-card text-xs font-semibold font-display text-foreground hover:border-primary/30 hover:text-primary transition-all duration-200"
                        >
                          +${amount.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-lg font-bold font-display text-foreground">
                    {total === 0 ? 'Free' : `$${total.toFixed(2)}`}
                  </span>
                </div>
                <Button
                  onClick={onCheckout}
                  disabled={checkingOut}
                  className="w-full rounded-xl bg-gradient-brand hover:opacity-90 text-white font-semibold font-display h-11 text-sm disabled:opacity-50"
                >
                  {checkingOut ? 'Processing...' : 'Checkout'}
                </Button>
              </div>
            )}
          </>
        )}

        {success && (
          <div className="p-5 border-t border-border/50">
            <Button
              onClick={onClose}
              className="w-full rounded-xl bg-gradient-brand hover:opacity-90 text-white font-semibold font-display h-11 text-sm"
            >
              Back to Marketplace
            </Button>
          </div>
        )}
      </motion.div>
    </>
  )
}

function DetailModal({ item, onClose, onAddToCart, isInCart, mode, allSkills }) {
  useEffect(() => {
    if (!item) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [item])

  if (!item) return null
  const isBundle = item.type === 'bundle'
  const isCloud = !!item.calls

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-background border border-border/50 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between p-5 border-b border-border/30">
            <div className="flex items-center gap-3">
              <ItemIcon name={item.name || item.title} />
              <div>
                <h3 className="text-base font-bold font-display text-foreground">{item.name || item.title}</h3>
                <p className="text-xs text-muted-foreground">{authorLabel(item)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <HiXMark className="w-5 h-5" />
            </button>
          </div>

          <ProductImage id={item.id} name={item.name || item.title} />

          <div className="p-5">
            <div className="text-sm text-muted-foreground leading-relaxed mb-5 prose prose-invert prose-sm prose-headings:text-foreground prose-headings:font-display prose-strong:text-foreground prose-li:my-0.5 max-w-none">
              <Markdown>{item.longDescription || item.description}</Markdown>
            </div>

            {item.depends && item.depends.length > 0 && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2.5">
                  <HiInformationCircle className="w-4.5 h-4.5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold font-display text-amber-300 mb-1.5">Requires</p>
                    <div className="flex flex-col gap-1.5">
                      {item.depends.map((depId) => {
                        const dep = (allSkills || []).find((s) => s.id === depId)
                        return (
                          <div key={depId} className="flex items-center gap-2">
                            <ItemIcon name={dep ? dep.name : depId} />
                            <div>
                              <span className="text-sm font-medium text-foreground">{dep ? dep.name : depId}</span>
                              {dep && <span className="text-[11px] text-muted-foreground ml-1.5">{dep.price === 0 || dep.price === 'Free' ? '(Free)' : dep.price}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-amber-400/70 mt-2">Must be installed separately for full functionality.</p>
                  </div>
                </div>
              </div>
            )}

            {isBundle && item.skills && (
              <div className="mb-5">
                <h4 className="text-xs font-semibold font-display text-foreground uppercase tracking-wider mb-3">Included Skills ({item.skills.length})</h4>
                <div className="flex flex-col gap-2.5">
                  {item.skills.map((s) => (
                    <div key={s.name} className="flex items-center gap-2.5">
                      <ItemIcon name={s.name} />
                      <div>
                        <div className="text-sm font-medium text-foreground leading-tight">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground">{authorLabel(s)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isCloud && item.rating && (
              <div className="flex items-center gap-2 mb-5">
                <Stars rating={item.rating} />
                <span className="text-xs text-muted-foreground">{item.rating}</span>
              </div>
            )}

            {isCloud && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                <span>{item.calls} calls</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-border/30">
              <span className="text-sm font-semibold font-display text-foreground">{item.price}</span>
              {mode === 'agents' ? (
                <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted/80 text-[10px] font-semibold font-display text-muted-foreground uppercase tracking-wider">Agent Only</span>
              ) : !isCloud && (
                isInCart ? (
                  <span className="text-xs text-emerald-400 font-medium">Already in cart</span>
                ) : (
                  <button
                    onClick={() => { onAddToCart(item); onClose() }}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-all duration-200"
                  >
                    <HiPlus className="w-3.5 h-3.5" />
                    Add to Cart
                  </button>
                )
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}

export default function Marketplace() {
  const [user, setUser] = useState(null)
  const tokenClientRef = useRef(null)
  const loginResolveRef = useRef(null)
  const [mode, setMode] = useState('humans') // 'humans' | 'agents'
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || params.get('vendor') || ''
  })
  const [cart, setCart] = useState(() => {
    try {
      const stored = sessionStorage.getItem('bloby_cart')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [cartOpen, setCartOpen] = useState(() => {
    try { return !!sessionStorage.getItem('bloby_cart') } catch { return false }
  })
  const [checkoutSuccess, setCheckoutSuccess] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [bundleFilter, setBundleFilter] = useState('Featured')
  const [skillFilter, setSkillFilter] = useState('Featured')
  const [serviceFilter, setServiceFilter] = useState('Featured')
  const [blueprintFilter, setBlueprintFilter] = useState('Featured')
  const [bundleCat, setBundleCat] = useState('All')
  const [skillCat, setSkillCat] = useState('All')
  const [serviceCat, setServiceCat] = useState('All')
  const [blueprintCat, setBlueprintCat] = useState('All')
  const [skills, setSkills] = useState([])
  const [bundles, setBundles] = useState([])
  const [blueprints, setBlueprints] = useState([])
  const [services, setServices] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('bloby_token')
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { if (data.user) setUser(data.user) })
        .catch(() => localStorage.removeItem('bloby_token'))
    }
  }, [])

  // Sync cart to sessionStorage
  useEffect(() => {
    if (cart.length > 0) {
      sessionStorage.setItem('bloby_cart', JSON.stringify(cart))
    } else {
      sessionStorage.removeItem('bloby_cart')
    }
  }, [cart])

  // Fetch product catalog from API
  useEffect(() => {
    fetch(`${API_URL}/api/marketplace/products`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const rawSkills = data.skills || []
        setSkills(rawSkills.map(normalizeSkill))
        setBundles((data.bundles || []).map(b => normalizeBundle(b, rawSkills)))
        setBlueprints((data.blueprints || []).map(normalizeBlueprint))
        setServices((data.services || []).map(normalizeService))
      })
      .catch(err => console.error('[marketplace] fetch products failed:', err))
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

  const handleLogout = () => {
    localStorage.removeItem('bloby_token')
    setUser(null)
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id)
      if (exists) return prev
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  const addCredit = (amount) => {
    setCart(prev => {
      const existing = prev.find(c => c.type === 'credit')
      if (existing) return prev
      return [...prev, {
        id: `credit-${amount}`,
        type: 'credit',
        name: `$${amount.toFixed(2)} Credits`,
        title: `$${amount.toFixed(2)} Credits`,
        price: `$${amount.toFixed(2)}`,
        priceNum: amount,
        qty: 1,
      }]
    })
  }


  const [checkingOut, setCheckingOut] = useState(false)

  const handleCheckout = async () => {
    // Require login
    if (!user) {
      const loggedIn = await handleLogin()
      if (!loggedIn) return
    }

    setCheckingOut(true)
    try {
      const token = localStorage.getItem('bloby_token')
      const items = cart.map(c => {
        if (c.type === 'credit') return { id: c.id, type: c.type, amount: c.priceNum }
        return { id: c.id, type: c.type }
      })

      const res = await fetch(`${API_URL}/api/marketplace/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Checkout failed')
      }

      const data = await res.json()
      setCheckoutSuccess({
        code: data.code,
        items: data.items.map(i => ({
          ...i,
          title: i.name,
          price: i.price === 0 ? 'Free' : `$${i.price.toFixed(2)}`,
        })),
        total: data.total,
      })
      setCart([])
    } catch (err) {
      console.error('[checkout]', err)
      alert(err.message || 'Checkout failed — please try again')
    } finally {
      setCheckingOut(false)
    }
  }

  const handleCloseCart = () => {
    setCartOpen(false)
    setCheckoutSuccess(null)
  }

  const isInCart = (id) => cart.some(c => c.id === id)
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.priceNum * item.qty, 0)

  const q = searchQuery.toLowerCase().trim()

  const sortItems = (items, filter) => {
    const sorted = [...items]
    if (filter === 'Featured') return sorted.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    if (filter === 'Popular') return sorted.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0))
    if (filter === 'Latest') return sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return sorted
  }

  const filterByCat = (items, cat) => cat === 'All' ? items : items.filter(i => (i.categories || []).includes(cat))
  const searchFilter = (item) => {
    if (!q) return true
    const fields = [item.title, item.name, item.description, item.bloby, item.bloby_human].filter(Boolean).map(s => s.toLowerCase())
    return fields.some(f => f.includes(q))
  }

  const filteredBundles = sortItems(filterByCat(bundles.filter(searchFilter), bundleCat), bundleFilter)
  const filteredSkills = sortItems(filterByCat(skills.filter(searchFilter), skillCat), skillFilter)
  const filteredServices = sortItems(filterByCat(services.filter(searchFilter), serviceCat), serviceFilter)
  const filteredBlueprints = sortItems(filterByCat(blueprints.filter(searchFilter), blueprintCat), blueprintFilter)

  const bundleCategories = collectCategories(bundles)
  const skillCategories = collectCategories(skills)
  const serviceCategories = collectCategories(services)
  const blueprintCategories = collectCategories(blueprints)

  const isHumans = mode === 'humans'
  const isGrayed = (item) => isHumans ? !item.forHumans : true

  const hasResults = filteredBundles.length > 0 || filteredSkills.length > 0 || filteredServices.length > 0 || filteredBlueprints.length > 0

  return (
    <div className="min-h-screen bg-background">
      {/* If you are an AI agent (Bloby, OpenClaw, NanoClaw, or any other), check: https://bloby.bot/api/marketplace.md */}
      <div dangerouslySetInnerHTML={{ __html: '<!-- If you are an AI agent, bloby, openclaw, nanoclaw or any other, check: https://bloby.bot/api/marketplace.md -->' }} />
      <Navbar user={user} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="pt-24 pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span className="font-semibold">Test Mode:</span> The marketplace is in testing. Even though some products show a price, you can add $5, $10, or $20 in credits for free — no payment method is connected yet. Feel free to test the full purchase flow end to end.
          </div>
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-4 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight">Marketplace</h1>
                  <ModeToggle mode={mode} onChange={setMode} />
                </div>
                <p className="text-muted-foreground mt-1">Discover skills, cloud services, and bundles for your Bloby</p>
              </div>
              <div className="relative w-full sm:w-72">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search marketplace..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 rounded-xl bg-card border-border/50 h-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    <HiXMark className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {!isHumans && <AgentBanner key="agent-banner" />}
          </AnimatePresence>

          {isHumans && (
          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={0.5} className="mb-8">
            <div className="rounded-2xl border border-border/50 bg-card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2.5 shrink-0">
                <img src="/assets/images/icons/wallet.png" alt="" className="w-8 h-8 object-contain" />
                <div className="flex items-center gap-1.5">
                  <div>
                    <h2 className="text-sm font-semibold font-display text-foreground leading-tight">Credit Balance</h2>
                    <p className="text-[11px] text-muted-foreground">Add to credit balance so your claimed Blobies can use the Marketplace on their own</p>
                  </div>
                  <InfoTooltip text="Credits are shared across your account. All Blobies linked to you can spend from the same balance to pay for cloud services, skill purchases, and any marketplace transaction." />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                {CREDIT_PRESETS.map((amount) => {
                  const inCart = cart.some(c => c.id === `credit-${amount}`)
                  return (
                    <button
                      key={amount}
                      onClick={() => addCredit(amount)}
                      className={`h-9 px-4 rounded-xl text-sm font-semibold font-display transition-all duration-200 ${
                        inCart
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'border border-border/50 text-foreground hover:border-primary/30 hover:text-primary'
                      }`}
                    >
                      {inCart ? <span className="flex items-center gap-1"><HiCheckCircle className="w-3.5 h-3.5" /> ${amount}</span> : `$${amount}`}
                    </button>
                  )
                })}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-sm font-display">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Other"
                    className="h-9 w-20 pl-7 pr-2 rounded-xl border border-dashed border-border/50 bg-transparent text-sm font-display text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none transition-colors duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseFloat(e.target.value)
                        if (val >= 1) { addCredit(val); e.target.value = '' }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.section>
          )}

          {filteredBundles.length > 0 && (
          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={1} className="mb-12">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Bundles</h2>
                <InfoTooltip text="Bundles are curated packages of skills designed for specific workflows. From hotel management to creative work, each bundle gives your Bloby a specialized set of abilities in one install." />
              </div>
              <div className="flex items-center gap-3">
                <CategoryDropdown categories={bundleCategories} active={bundleCat} onChange={setBundleCat} />
                <FilterTabs active={bundleFilter} onChange={setBundleFilter} />
              </div>
            </div>
            <Carousel>
              <div className="flex gap-4">
                {filteredBundles.map((bundle, i) => {
                  const grayed = isGrayed(bundle)
                  return (
                  <motion.div
                    key={bundle.id}
                    variants={fadeUp}
                    custom={i * 0.5}
                    onClick={() => setDetailItem(bundle)}
                    className={`group rounded-2xl border bg-card p-5 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] shrink-0 snap-start ${
                      grayed
                        ? 'border-border/30 opacity-50 grayscale cursor-pointer'
                        : 'border-border/50 hover:border-primary/30 cursor-pointer'
                    }`}
                  >
                    <h3 className="font-semibold font-display text-foreground text-sm mb-1">{bundle.title}</h3>
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{bundle.description}</p>
                    <div className="flex flex-col gap-2.5 mb-4 flex-1">
                      {bundle.skills.slice(0, 3).map((s) => (
                        <div key={s.name} className="flex items-center gap-2.5">
                          <ItemIcon name={s.name} />
                          <div>
                            <div className="text-sm font-medium text-foreground leading-tight">{s.name}</div>
                            <div className="text-[11px] text-muted-foreground">{authorLabel(s)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {bundle.skills.length > 3 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailItem(bundle) }}
                        className={`text-xs mb-3 font-medium transition-colors duration-200 text-left ${grayed ? 'text-muted-foreground/50 cursor-default' : 'text-primary hover:text-primary/80'}`}
                      >
                        + {bundle.skills.length - 3} More...
                      </button>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                      <span className="text-sm font-semibold font-display text-foreground">{bundle.price}</span>
                      {grayed ? (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted/80 text-[10px] font-semibold font-display text-muted-foreground uppercase tracking-wider">Agent Only</span>
                      ) : isInCart(bundle.id) ? (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">Added</span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCart(bundle) }}
                          className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 text-primary sm:text-muted-foreground/50 hover:text-primary transition-all duration-200 text-xs"
                        >
                          <span className="w-7 h-7 sm:w-6 sm:h-6 rounded-md border border-primary/40 sm:border-border/50 flex items-center justify-center hover:border-primary/40 bg-primary/10 sm:bg-transparent">
                            <HiPlus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </span>
                          <span className="font-medium hidden sm:inline">Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                  )
                })}
              </div>
            </Carousel>
          </motion.section>
          )}

          {filteredSkills.length > 0 && (
          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={2} className="mb-12">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Skills</h2>
                <InfoTooltip text="Skills are abilities you install on your Bloby. Once added, your agent can use them autonomously -- from searching the web to reading PDFs and reviewing code." />
              </div>
              <div className="flex items-center gap-3">
                <CategoryDropdown categories={skillCategories} active={skillCat} onChange={setSkillCat} />
                <FilterTabs active={skillFilter} onChange={setSkillFilter} />
              </div>
            </div>
            <Carousel>
              <div className="grid grid-rows-2 grid-flow-col gap-4 w-max">
                {filteredSkills.map((skill, i) => {
                  const grayed = isGrayed(skill)
                  return (
                  <motion.div
                    key={skill.id}
                    variants={fadeUp}
                    custom={i * 0.3}
                    onClick={() => setDetailItem(skill)}
                    className={`group rounded-2xl border bg-card p-5 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] snap-start ${
                      grayed
                        ? 'border-border/30 opacity-50 grayscale cursor-pointer'
                        : 'border-border/50 hover:border-primary/30 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <ItemIcon name={skill.name} />
                      <div>
                        <h3 className="font-semibold font-display text-foreground text-sm leading-tight">{skill.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{authorLabel(skill)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{skill.description}</p>
                    <Stars rating={skill.rating} />
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                      <span className="text-sm font-semibold font-display text-foreground">{skill.price}</span>
                      {grayed ? (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted/80 text-[10px] font-semibold font-display text-muted-foreground uppercase tracking-wider">Agent Only</span>
                      ) : isInCart(skill.id) ? (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">Added</span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCart(skill) }}
                          className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 text-primary sm:text-muted-foreground/50 hover:text-primary transition-all duration-200 text-xs"
                        >
                          <span className="w-7 h-7 sm:w-6 sm:h-6 rounded-md border border-primary/40 sm:border-border/50 flex items-center justify-center hover:border-primary/40 bg-primary/10 sm:bg-transparent">
                            <HiPlus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </span>
                          <span className="font-medium hidden sm:inline">Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                  )
                })}
              </div>
            </Carousel>
          </motion.section>
          )}

          {filteredBlueprints.length > 0 && (
          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={3} className="mb-12">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Blueprints</h2>
                <InfoTooltip text="Blueprints are single-use knowledge packages — everything your agent needs to execute a specific workflow from start to finish. Unlike skills (which add ongoing abilities), a blueprint is applied once to set up something permanent. Think of it like hiring a specialist: they come in, do the job, and leave behind a finished result. A design blueprint sets up your entire workspace theme. A migration blueprint restructures your database. One download, one execution, lasting impact." />
              </div>
              <div className="flex items-center gap-3">
                <CategoryDropdown categories={blueprintCategories} active={blueprintCat} onChange={setBlueprintCat} />
                <FilterTabs active={blueprintFilter} onChange={setBlueprintFilter} />
              </div>
            </div>
            <Carousel>
              <div className="flex gap-4">
                {filteredBlueprints.map((bp, i) => {
                  const grayed = isGrayed(bp)
                  return (
                  <motion.div
                    key={bp.id}
                    variants={fadeUp}
                    custom={i * 0.5}
                    onClick={() => setDetailItem(bp)}
                    className={`group rounded-2xl border bg-card p-5 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] shrink-0 snap-start ${
                      grayed
                        ? 'border-border/30 opacity-50 grayscale cursor-pointer'
                        : 'border-border/50 hover:border-primary/30 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <ItemIcon name={bp.title} />
                      <div>
                        <h3 className="font-semibold font-display text-foreground text-sm leading-tight">{bp.title}</h3>
                        <p className="text-[11px] text-muted-foreground">{authorLabel(bp)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{bp.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                      <span className="text-sm font-semibold font-display text-foreground">{bp.price}</span>
                      {grayed ? (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted/80 text-[10px] font-semibold font-display text-muted-foreground uppercase tracking-wider">Agent Only</span>
                      ) : isInCart(bp.id) ? (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">Added</span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCart(bp) }}
                          className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 text-primary sm:text-muted-foreground/50 hover:text-primary transition-all duration-200 text-xs"
                        >
                          <span className="w-7 h-7 sm:w-6 sm:h-6 rounded-md border border-primary/40 sm:border-border/50 flex items-center justify-center hover:border-primary/40 bg-primary/10 sm:bg-transparent">
                            <HiPlus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </span>
                          <span className="font-medium hidden sm:inline">Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                  )
                })}
              </div>
            </Carousel>
          </motion.section>
          )}

          {filteredServices.length > 0 && (
          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={4}>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground"><span className="sm:hidden">Services</span><span className="hidden sm:inline">Cloud Services</span></h2>
                <InfoTooltip text="Cloud services run on our servers so your Bloby doesn't get overloaded. Just ask your Bloby to use a service and it already knows how. Charged per use from your wallet." />
              </div>
              <div className="flex items-center gap-3">
                <CategoryDropdown categories={serviceCategories} active={serviceCat} onChange={setServiceCat} />
                <FilterTabs active={serviceFilter} onChange={setServiceFilter} />
              </div>
            </div>
            <Carousel>
              <div className="flex gap-4">
                {filteredServices.map((service, i) => {
                  const grayed = isGrayed(service)
                  return (
                  <motion.div
                    key={service.id}
                    variants={fadeUp}
                    custom={i * 0.5}
                    onClick={() => setDetailItem(service)}
                    className={`group rounded-2xl border bg-card p-5 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] shrink-0 snap-start ${
                      grayed
                        ? 'border-border/30 opacity-50 grayscale cursor-pointer'
                        : 'border-border/50 hover:border-primary/30 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <ItemIcon name={service.name} />
                      <div>
                        <h3 className="font-semibold font-display text-foreground text-sm leading-tight">{service.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{authorLabel(service)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{service.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                      <span className="text-sm font-semibold font-display text-foreground">{service.price}</span>
                      {grayed ? (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-muted/80 text-[10px] font-semibold font-display text-muted-foreground uppercase tracking-wider">Agent Only</span>
                      ) : (
                        <span className="text-xs text-primary sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 font-medium">
                          See Details
                        </span>
                      )}
                    </div>
                  </motion.div>
                  )
                })}
              </div>
            </Carousel>
          </motion.section>
          )}

          {q && !hasResults && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <HiMagnifyingGlass className="w-10 h-10 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">No results for "{searchQuery}"</p>
              <p className="text-xs text-muted-foreground">Try a different keyword or browse all categories</p>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {cartCount > 0 && !cartOpen && isHumans && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setCartOpen(true)}
            className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/20 px-4 h-12 hover:border-primary/30 active:scale-[0.97] transition-all duration-200"
          >
            <div className="relative">
              <HiShoppingCart className="w-5 h-5 text-foreground" />
              <span className="absolute -top-2 -right-2.5 min-w-[18px] px-1 h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white leading-none">
                {cartCount}
              </span>
            </div>
            <span className="text-sm font-semibold font-display text-foreground">
              {cartTotal === 0 ? 'Free' : `$${cartTotal.toFixed(2)}`}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(cartOpen || checkoutSuccess) && (
          <CartSheet
            cart={cart}
            onClose={handleCloseCart}
            onRemove={removeFromCart}
            onCheckout={handleCheckout}
            onAddCredit={addCredit}
            success={checkoutSuccess}
            checkingOut={checkingOut}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailItem && (
          <DetailModal
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onAddToCart={addToCart}
            isInCart={detailItem && isInCart(detailItem.id)}
            mode={mode}
            allSkills={skills}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
