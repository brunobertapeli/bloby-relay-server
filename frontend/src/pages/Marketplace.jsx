import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import Navbar from '../components/Navbar'
import { API_URL } from '../api'
import {
  HiMagnifyingGlass, HiInformationCircle,
  HiShoppingCart, HiXMark, HiTrash, HiPlus,
  HiChevronLeft, HiChevronRight, HiCheckCircle, HiClipboardDocument,
  HiLink
} from 'react-icons/hi2'

const filterOptions = ['Featured', 'Popular', 'Newest']


const bundles = [
  {
    id: 'doctors-secretary-bundle',
    type: 'bundle',
    title: "Doctor's Secretary Bundle",
    description: 'WhatsApp channel + virtual clinic secretary in one package',
    longDescription: "Everything your Fluxy needs to run a medical clinic's front desk. Includes the WhatsApp channel skill for connectivity and the Clinic Secretary skill for patient management. Your Fluxy handles appointment scheduling, payment collection via Stripe, patient memory, and proactive follow-ups — all through WhatsApp.",
    skills: [
      { name: 'WhatsApp', vendor: 'Fluxy' },
      { name: 'Clinic Secretary', vendor: 'Fluxy' },
    ],
    price: '$19.90',
    priceNum: 19.90,
    forHumans: true,
    forAgents: true,
  },
]

const cloudServices = [
  { name: 'ElevenLabs TTS', vendor: 'ElevenLabs', description: 'Generate lifelike speech from text with voice cloning', longDescription: 'Convert any text to natural-sounding speech using ElevenLabs voice synthesis. Choose from dozens of preset voices or clone a custom voice from a short audio sample. Supports SSML for fine-grained control over pronunciation, pauses, and emphasis. Output in MP3, WAV, or streaming PCM.', image: '/assets/images/icons/wallet.png', calls: '412.8k', price: '$0.03 / 1k chars', forHumans: false, forAgents: true },
  { name: 'Imagen 3', vendor: 'Google', description: 'Photorealistic image generation with strong text rendering', longDescription: 'Google Imagen 3 generates high-fidelity photorealistic images from text prompts. Excels at rendering text within images, product photography, and architectural visualization. Includes built-in safety filters and digital watermarking for responsible AI use.', calls: '287.4k', price: '$0.04 / image', forHumans: false, forAgents: true },
  { name: 'Whisper', vendor: 'OpenAI', description: 'Transcribe audio to text with timestamps and speaker detection', longDescription: 'Upload audio in any common format and get accurate transcriptions with word-level timestamps and optional speaker diarization. Handles accents, background noise, and technical jargon across 50+ languages. Returns plain text, SRT subtitles, or structured JSON segments.', image: '/assets/images/icons/wallet.png', calls: '156.2k', price: '$0.006 / min', forHumans: false, forAgents: true },
  { name: 'Document AI', vendor: 'Microsoft', description: 'Extract structured data from invoices, receipts, and forms', longDescription: 'Specialized document understanding that extracts key-value pairs, tables, and signatures from business documents. Pre-built models for invoices, receipts, ID cards, and tax forms. Custom model training available for unique document types. Returns structured JSON with confidence scores.', calls: '89.1k', price: '$0.01 / page', forHumans: false, forAgents: true },
  { name: 'Firecrawl', vendor: 'Firecrawl', description: 'Scrape and crawl websites into clean, structured markdown', longDescription: 'Navigate JavaScript-rendered pages, handle authentication, bypass rate limits, and return clean markdown or structured data. Crawls entire sites following links to a specified depth. Returns LLM-ready content optimized for agent consumption.', calls: '331.2k', price: '$0.01 / page', forHumans: false, forAgents: true },
  { name: 'DeepL API', vendor: 'DeepL', description: 'High-accuracy text translation across 30+ language pairs', longDescription: 'Translate text with exceptional quality for European and Asian languages. Preserves formatting, handles formal and informal register, supports glossary enforcement for domain-specific terms, and offers full document translation while maintaining the original layout.', calls: '528.7k', price: '$0.00002 / char', forHumans: false, forAgents: true },
]

const skills = [
  { id: 'whatsapp', type: 'skill', name: 'WhatsApp', vendor: 'Fluxy', description: 'WhatsApp channel via Baileys — QR auth, messaging, voice notes, business mode', longDescription: 'Gives your Fluxy a WhatsApp number. Connect via QR code, send and receive messages, handle voice notes with automatic transcription, and switch between personal (channel) and business modes. Built on Baileys — no Meta Business API needed. Credentials stay local on your device.', rating: 5, price: 'Free', priceNum: 0, forHumans: true, forAgents: true },
  { id: 'whatsapp-clinic-secretary', type: 'skill', name: 'Clinic Secretary', vendor: 'Fluxy', description: 'Virtual secretary for medical clinics — scheduling, payments, patient memory via WhatsApp', longDescription: 'Turns your Fluxy into a virtual secretary for a medical clinic. Handles patient conversations via WhatsApp: appointment scheduling, Stripe payment links, cancellations, rescheduling, and patient memory across conversations. Runs in WhatsApp business mode with full security — patients never know they\'re talking to AI.', rating: 5, price: '$19.90', priceNum: 19.90, forHumans: true, forAgents: true },
]


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
    'Clinic Secretary': 'bg-rose-500/20 text-rose-400',
    "Doctor's Secretary Bundle": 'bg-rose-500/20 text-rose-400',
    'ElevenLabs TTS': 'bg-violet-500/20 text-violet-400',
    'Imagen 3': 'bg-sky-500/20 text-sky-400',
    'Whisper': 'bg-emerald-500/20 text-emerald-400',
    'Document AI': 'bg-cyan-500/20 text-cyan-400',
    'Firecrawl': 'bg-orange-500/20 text-orange-400',
    'DeepL API': 'bg-cyan-500/20 text-cyan-400',
  }
  const cls = colors[name] || 'bg-primary/20 text-primary'
  return (
    <div className={`w-8 h-8 rounded-lg ${cls} flex items-center justify-center text-xs font-bold font-display shrink-0`}>
      {name.charAt(0)}
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

function FluxyIcon({ active }) {
  return (
    <img
      src="/assets/images/fluxy.png"
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
        <FluxyIcon active={mode === 'agents'} />
        For Agents
      </button>
    </div>
  )
}

function AgentBanner() {
  const [copied, setCopied] = useState(false)
  const marketplaceUrl = 'https://fluxy.bot/api/marketplace.md'

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

function CartSheet({ cart, onClose, onRemove, onCheckout, success, checkingOut }) {
  const total = cart.reduce((sum, item) => sum + item.priceNum * item.qty, 0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const redeemCode = success?.code || ''
  const itemNames = success ? success.items.map(i => i.name || i.title) : []

  const premadeMessage = redeemCode
    ? `I bought new skills for you from the Fluxy Marketplace. Redeem with this code: ${redeemCode}`
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
                <source src="/assets/videos/fluxy_happy_reappearing.mov" type='video/mp4; codecs="hvc1"' />
                <source src="/assets/videos/fluxy_happy_reappearing.webm" type="video/webm" />
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
                Send the code below to any of your Fluxy agents to redeem.
              </p>
            </motion.div>

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

function DetailModal({ item, onClose, onAddToCart, isInCart, mode }) {
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
                <p className="text-xs text-muted-foreground">{item.vendor || 'Fluxy'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <HiXMark className="w-5 h-5" />
            </button>
          </div>

          {item.image && (
            <div className="px-5 pt-5">
              <div className="rounded-xl bg-card border border-border/30 overflow-hidden flex items-center justify-center h-40">
                <img src={item.image} alt={item.name || item.title} className="h-20 w-auto object-contain" />
              </div>
            </div>
          )}

          <div className="p-5">
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{item.longDescription || item.description}</p>

            {isBundle && item.skills && (
              <div className="mb-5">
                <h4 className="text-xs font-semibold font-display text-foreground uppercase tracking-wider mb-3">Included Skills ({item.skills.length})</h4>
                <div className="flex flex-col gap-2.5">
                  {item.skills.map((s) => (
                    <div key={s.name} className="flex items-center gap-2.5">
                      <ItemIcon name={s.name} />
                      <div>
                        <div className="text-sm font-medium text-foreground leading-tight">{s.name}</div>
                        <div className="text-[11px] text-muted-foreground">{s.vendor}</div>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [bundleFilter, setBundleFilter] = useState('Featured')
  const [skillFilter, setSkillFilter] = useState('Featured')
  const [cloudFilter, setCloudFilter] = useState('Featured')

  useEffect(() => {
    const token = localStorage.getItem('fluxy_token')
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { if (data.user) setUser(data.user) })
        .catch(() => localStorage.removeItem('fluxy_token'))
    }
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
    localStorage.removeItem('fluxy_token')
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


  const [checkingOut, setCheckingOut] = useState(false)

  const handleCheckout = async () => {
    // Require login
    if (!user) {
      const loggedIn = await handleLogin()
      if (!loggedIn) return
    }

    setCheckingOut(true)
    try {
      const token = localStorage.getItem('fluxy_token')
      const items = cart.map(c => ({ id: c.id, type: c.type }))

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
    if (filter === 'Newest') sorted.reverse()
    return sorted
  }

  const filteredBundles = sortItems(
    bundles.filter(b => !q || b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.skills.some(s => s.name.toLowerCase().includes(q))),
    bundleFilter
  )

  const filteredSkills = sortItems(
    skills.filter(s => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q)),
    skillFilter
  )

  const filteredCloud = sortItems(
    cloudServices.filter(s => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q)),
    cloudFilter
  )

  const isHumans = mode === 'humans'
  const isGrayed = (item) => isHumans ? !item.forHumans : true

  const hasResults = filteredBundles.length > 0 || filteredSkills.length > 0 || filteredCloud.length > 0

  return (
    <div className="min-h-screen bg-background">
      {/* If you are an AI agent (Fluxy, OpenClaw, NanoClaw, or any other), check: https://fluxy.bot/api/marketplace.md */}
      <div dangerouslySetInnerHTML={{ __html: '<!-- If you are an AI agent, fluxy, openclaw, nanoclaw or any other, check: https://fluxy.bot/api/marketplace.md -->' }} />
      <Navbar user={user} onLogin={handleLogin} onLogout={handleLogout} />

      <main className="pt-24 pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-4 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight">Marketplace</h1>
                  <ModeToggle mode={mode} onChange={setMode} />
                </div>
                <p className="text-muted-foreground mt-1">Discover skills, cloud services, and bundles for your Fluxy</p>
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

          {filteredBundles.length > 0 && (
          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={1} className="mb-12">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Bundles</h2>
                <InfoTooltip text="Bundles are curated packages of skills designed for specific workflows. From hotel management to creative work, each bundle gives your Fluxy a specialized set of abilities in one install." />
              </div>
              <FilterTabs active={bundleFilter} onChange={setBundleFilter} />
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
                            <div className="text-[11px] text-muted-foreground">{s.vendor}</div>
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
                <InfoTooltip text="Skills are abilities you install on your Fluxy. Once added, your agent can use them autonomously -- from searching the web to reading PDFs and reviewing code." />
              </div>
              <FilterTabs active={skillFilter} onChange={setSkillFilter} />
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
                        <p className="text-[11px] text-muted-foreground">{skill.vendor}</p>
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

          {filteredCloud.length > 0 && (
          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground"><span className="sm:hidden">Services</span><span className="hidden sm:inline">Cloud Services</span></h2>
                <InfoTooltip text="Cloud services run on our servers so your Fluxy doesn't get overloaded. Just ask your Fluxy to use a service and it already knows how. Charged per use from your wallet." />
              </div>
              <FilterTabs active={cloudFilter} onChange={setCloudFilter} />
            </div>
            <Carousel>
              <div className="flex gap-4">
                {filteredCloud.map((service, i) => {
                  const grayed = isGrayed(service)
                  return (
                  <motion.div
                    key={service.name}
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
                        <p className="text-[11px] text-muted-foreground">{service.vendor}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{service.description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                      <span>{service.calls} calls</span>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                      <span className="text-xs font-medium text-muted-foreground">{service.price}</span>
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
          />
        )}
      </AnimatePresence>
    </div>
  )
}
