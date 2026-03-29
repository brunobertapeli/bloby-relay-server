import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  HiMagnifyingGlass, HiArrowLeft, HiInformationCircle,
  HiShoppingCart, HiXMark, HiTrash, HiPlus,
  HiChevronLeft, HiChevronRight, HiCheckCircle, HiClipboardDocument
} from 'react-icons/hi2'

const filterOptions = ['Featured', 'Popular', 'Newest', 'Price: Low to High']

const bundles = [
  {
    id: 'bundle-1',
    type: 'bundle',
    title: 'Fluxy for Lawyers',
    description: 'Practice management, contract workflows, and client billing in one bundle',
    longDescription: 'Everything a legal AI agent needs to manage a practice. Automates document preparation, client communication, calendar management, and time-based billing. Your Fluxy can draft engagement letters, track statute of limitations deadlines, manage client intake forms, send documents for e-signature, and generate invoices from logged hours.',
    image: '/assets/images/icons/wallet.png',
    skills: [
      { name: 'Clio Legal', vendor: 'Clio' },
      { name: 'DocuSign', vendor: 'DocuSign' },
      { name: 'Google Calendar', vendor: 'Google' },
      { name: 'Gmail', vendor: 'Google' },
      { name: 'Google Drive', vendor: 'Google' },
      { name: 'PDF Reader', vendor: 'Fluxy' },
    ],
    price: '$24.00',
    priceNum: 24.00,
  },
  {
    id: 'bundle-2',
    type: 'bundle',
    title: 'Fluxy for Hotels',
    description: 'Centralize reservations, guest comms, and channel management',
    longDescription: 'Centralizes property management across booking channels. Your Fluxy monitors reservations from Booking.com and direct channels via Cloudbeds, adjusts rates based on occupancy, sends pre-arrival instructions over WhatsApp, handles guest inquiries in any language, and coordinates housekeeping schedules through shared calendars.',
    skills: [
      { name: 'Cloudbeds', vendor: 'Cloudbeds' },
      { name: 'Booking.com', vendor: 'Booking.com' },
      { name: 'WhatsApp Business', vendor: 'Meta' },
      { name: 'Gmail', vendor: 'Google' },
      { name: 'Google Calendar', vendor: 'Google' },
      { name: 'Google Sheets', vendor: 'Google' },
      { name: 'DeepL Translate', vendor: 'DeepL' },
    ],
    price: '$29.00',
    priceNum: 29.00,
  },
  {
    id: 'bundle-3',
    type: 'bundle',
    title: 'Fluxy for Real Estate',
    description: 'Lead management, property matching, and transaction documents',
    longDescription: 'Turns your Fluxy into a real estate assistant that qualifies inbound leads, matches buyers to MLS listings, schedules property showings, prepares offer documents, and routes contracts for e-signature. Automatically follows up with cold leads and keeps your pipeline moving toward closing.',
    image: '/assets/images/icons/wallet.png',
    skills: [
      { name: 'Follow Up Boss', vendor: 'Follow Up Boss' },
      { name: 'Zillow MLS', vendor: 'Zillow' },
      { name: 'DocuSign', vendor: 'DocuSign' },
      { name: 'Google Calendar', vendor: 'Google' },
      { name: 'Calendly', vendor: 'Calendly' },
      { name: 'Gmail', vendor: 'Google' },
      { name: 'WhatsApp Business', vendor: 'Meta' },
    ],
    price: '$22.00',
    priceNum: 22.00,
  },
  {
    id: 'bundle-4',
    type: 'bundle',
    title: 'Fluxy for E-Commerce',
    description: 'Manage products, orders, ads, and customer support across channels',
    longDescription: 'A complete e-commerce operations center. Your Fluxy manages Shopify product listings, processes orders, handles customer support emails, tracks inventory, runs ad campaigns on Meta and Google, and generates weekly sales reports. Works across multiple storefronts simultaneously.',
    skills: [
      { name: 'Shopify', vendor: 'Shopify' },
      { name: 'Stripe', vendor: 'Stripe' },
      { name: 'Gmail', vendor: 'Google' },
      { name: 'Mailchimp', vendor: 'Mailchimp' },
      { name: 'Meta Ads', vendor: 'Meta' },
      { name: 'Google Ads', vendor: 'Google' },
      { name: 'Google Sheets', vendor: 'Google' },
      { name: 'Slack', vendor: 'Slack' },
      { name: 'WhatsApp Business', vendor: 'Meta' },
    ],
    price: '$35.00',
    priceNum: 35.00,
  },
  {
    id: 'bundle-5',
    type: 'bundle',
    title: 'Fluxy for Restaurants',
    description: 'Reservations, social media, and guest communication for food businesses',
    longDescription: 'Manages the front-of-house and marketing side of restaurant operations. Your Fluxy handles OpenTable reservations, responds to guest inquiries on WhatsApp, schedules social media posts with food photography, sends promotional email campaigns, and maintains your menu across platforms.',
    skills: [
      { name: 'OpenTable', vendor: 'OpenTable' },
      { name: 'WhatsApp Business', vendor: 'Meta' },
      { name: 'Gmail', vendor: 'Google' },
      { name: 'Google Calendar', vendor: 'Google' },
      { name: 'Buffer Social', vendor: 'Buffer' },
      { name: 'Google Sheets', vendor: 'Google' },
    ],
    price: '$18.00',
    priceNum: 18.00,
  },
  {
    id: 'bundle-6',
    type: 'bundle',
    title: 'Fluxy for Marketing',
    description: 'Content creation, ad management, email campaigns, and analytics',
    longDescription: 'Your Fluxy becomes a full marketing operations assistant. It drafts content, schedules social posts across platforms, manages ad campaigns on Meta and Google, sends email campaigns through Mailchimp, tracks performance metrics in spreadsheets, and generates client reports. Handles multiple client accounts with separate credentials.',
    skills: [
      { name: 'Buffer Social', vendor: 'Buffer' },
      { name: 'Mailchimp', vendor: 'Mailchimp' },
      { name: 'Meta Ads', vendor: 'Meta' },
      { name: 'Google Ads', vendor: 'Google' },
      { name: 'HubSpot', vendor: 'HubSpot' },
      { name: 'Google Sheets', vendor: 'Google' },
      { name: 'Slack', vendor: 'Slack' },
      { name: 'Notion', vendor: 'Notion' },
      { name: 'Google Drive', vendor: 'Google' },
    ],
    price: '$32.00',
    priceNum: 32.00,
  },
]

const cloudServices = [
  { name: 'ElevenLabs TTS', vendor: 'ElevenLabs', description: 'Generate lifelike speech from text with voice cloning', longDescription: 'Convert any text to natural-sounding speech using ElevenLabs voice synthesis. Choose from dozens of preset voices or clone a custom voice from a short audio sample. Supports SSML for fine-grained control over pronunciation, pauses, and emphasis. Output in MP3, WAV, or streaming PCM.', image: '/assets/images/icons/wallet.png', calls: '412.8k', price: '$0.03 / 1k chars' },
  { name: 'Imagen 3', vendor: 'Google', description: 'Photorealistic image generation with strong text rendering', longDescription: 'Google Imagen 3 generates high-fidelity photorealistic images from text prompts. Excels at rendering text within images, product photography, and architectural visualization. Includes built-in safety filters and digital watermarking for responsible AI use.', calls: '287.4k', price: '$0.04 / image' },
  { name: 'Whisper', vendor: 'OpenAI', description: 'Transcribe audio to text with timestamps and speaker detection', longDescription: 'Upload audio in any common format and get accurate transcriptions with word-level timestamps and optional speaker diarization. Handles accents, background noise, and technical jargon across 50+ languages. Returns plain text, SRT subtitles, or structured JSON segments.', image: '/assets/images/icons/wallet.png', calls: '156.2k', price: '$0.006 / min' },
  { name: 'Document AI', vendor: 'Microsoft', description: 'Extract structured data from invoices, receipts, and forms', longDescription: 'Specialized document understanding that extracts key-value pairs, tables, and signatures from business documents. Pre-built models for invoices, receipts, ID cards, and tax forms. Custom model training available for unique document types. Returns structured JSON with confidence scores.', calls: '89.1k', price: '$0.01 / page' },
  { name: 'Firecrawl', vendor: 'Firecrawl', description: 'Scrape and crawl websites into clean, structured markdown', longDescription: 'Navigate JavaScript-rendered pages, handle authentication, bypass rate limits, and return clean markdown or structured data. Crawls entire sites following links to a specified depth. Returns LLM-ready content optimized for agent consumption.', calls: '331.2k', price: '$0.01 / page' },
  { name: 'DeepL API', vendor: 'DeepL', description: 'High-accuracy text translation across 30+ language pairs', longDescription: 'Translate text with exceptional quality for European and Asian languages. Preserves formatting, handles formal and informal register, supports glossary enforcement for domain-specific terms, and offers full document translation while maintaining the original layout.', calls: '528.7k', price: '$0.00002 / char' },
]

const skills = [
  { id: 'skill-1', type: 'skill', name: 'Gmail', vendor: 'Google', description: 'Read, draft, send, and organize Gmail messages and threads', longDescription: 'Gives your Fluxy full access to a Gmail inbox. It can read incoming messages, compose and send replies, apply labels, archive threads, and search across years of email history. Supports attachments, inline images, and template-based bulk sending. OAuth2-based so your credentials never leave your device.', image: '/assets/images/icons/wallet.png', rating: 5, price: 'Free', priceNum: 0 },
  { id: 'skill-2', type: 'skill', name: 'WhatsApp Business', vendor: 'Meta', description: 'Send and receive WhatsApp messages through the Business API', longDescription: 'Connects your Fluxy to the WhatsApp Business API for automated customer conversations. Supports text, images, documents, location sharing, and interactive button messages. Your agent can handle inbound inquiries, send order updates, and manage template-based broadcast campaigns.', rating: 4.5, price: '$5.00', priceNum: 5.00 },
  { id: 'skill-3', type: 'skill', name: 'Google Calendar', vendor: 'Google', description: 'Create, read, update, and manage calendar events and availability', longDescription: 'Full control over Google Calendar. Your Fluxy can create events with guests, check availability across multiple calendars, set up recurring meetings, handle RSVPs, and send custom reminders. Supports multiple time zones and free/busy lookups for scheduling across teams.', rating: 5, price: 'Free', priceNum: 0 },
  { id: 'skill-4', type: 'skill', name: 'Notion', vendor: 'Notion', description: 'Read, write, and manage Notion pages, databases, and blocks', longDescription: 'Gives your Fluxy full access to Notion workspaces. Create pages, update database entries, query filtered views, manage properties, and build structured knowledge bases. Your agent can use Notion as its long-term memory, maintaining project wikis, meeting notes, and task boards autonomously.', image: '/assets/images/icons/wallet.png', rating: 4.5, price: '$3.00', priceNum: 3.00 },
  { id: 'skill-5', type: 'skill', name: 'Slack', vendor: 'Slack', description: 'Post messages, read channels, and manage Slack workflows', longDescription: 'Your Fluxy can post to channels, read conversation history, respond to mentions, create threads, and trigger Slack workflows. Supports rich formatting with Block Kit, file uploads, and emoji reactions. Ideal for team notifications, standup reports, and automated channel management.', rating: 4.5, price: 'Free', priceNum: 0 },
  { id: 'skill-6', type: 'skill', name: 'Shopify', vendor: 'Shopify', description: 'Manage products, orders, inventory, and customers on Shopify', longDescription: 'Full Shopify Admin API access. Your Fluxy can create and update products, process orders, manage inventory levels, handle customer inquiries, and modify store settings. Supports draft orders, discount codes, fulfillment tracking, and webhook-driven automations.', image: '/assets/images/icons/wallet.png', rating: 4, price: '$8.00', priceNum: 8.00 },
  { id: 'skill-7', type: 'skill', name: 'HubSpot', vendor: 'HubSpot', description: 'Manage contacts, deals, and sales pipelines in HubSpot CRM', longDescription: 'Full CRM access including contact creation, deal pipeline management, email tracking, and activity logging. Your Fluxy can qualify leads from form submissions, update deal stages based on email conversations, and generate pipeline reports. Includes marketing hub access for email campaigns.', rating: 4.5, price: '$6.00', priceNum: 6.00 },
  { id: 'skill-8', type: 'skill', name: 'Stripe', vendor: 'Stripe', description: 'Process payments, manage subscriptions, and handle refunds', longDescription: 'Create payment intents, manage customer subscriptions, process refunds, and pull revenue analytics. Your Fluxy can handle billing inquiries, retry failed payments, generate financial reports, and manage coupon codes and promotional pricing.', rating: 5, price: '$4.00', priceNum: 4.00 },
  { id: 'skill-9', type: 'skill', name: 'DocuSign', vendor: 'DocuSign', description: 'Send, track, and manage electronic signatures on documents', longDescription: 'Create signature requests, track envelope status, download signed documents, and manage templates. Your Fluxy can automate contract workflows, send reminders for pending signatures, route documents through multi-party signing, and archive completed agreements.', image: '/assets/images/icons/wallet.png', rating: 4, price: '$5.00', priceNum: 5.00 },
  { id: 'skill-10', type: 'skill', name: 'Google Sheets', vendor: 'Google', description: 'Read and write data in Google Sheets spreadsheets', longDescription: 'Read cell ranges, write data, create new sheets, apply formatting, and manage named ranges. Your Fluxy can use Sheets as a lightweight database, generate reports, track metrics, and process form submissions collected via Google Forms.', rating: 4.5, price: 'Free', priceNum: 0 },
  { id: 'skill-11', type: 'skill', name: 'Calendly', vendor: 'Calendly', description: 'Manage scheduling links, event types, and bookings', longDescription: 'Your Fluxy can create and configure scheduling links, monitor new bookings, reschedule or cancel events, and pull availability data. Useful for sales teams and consultants who need automated scheduling without back-and-forth emails.', rating: 4, price: '$3.00', priceNum: 3.00 },
  { id: 'skill-12', type: 'skill', name: 'Mailchimp', vendor: 'Mailchimp', description: 'Create and send email campaigns with audience management', longDescription: 'Design email campaigns, manage subscriber lists, create segments, and track open and click metrics. Your Fluxy can automate drip campaigns, A/B test subject lines, clean bounced addresses, and generate performance reports.', image: '/assets/images/icons/wallet.png', rating: 4.5, price: '$4.00', priceNum: 4.00 },
]

const walletPresets = [5, 10, 25]

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
    'Gmail': 'bg-red-500/20 text-red-400',
    'WhatsApp Business': 'bg-emerald-500/20 text-emerald-400',
    'Google Calendar': 'bg-sky-500/20 text-sky-400',
    'Notion': 'bg-neutral-500/20 text-neutral-300',
    'Slack': 'bg-violet-500/20 text-violet-400',
    'Shopify': 'bg-lime-500/20 text-lime-400',
    'HubSpot': 'bg-orange-500/20 text-orange-400',
    'Stripe': 'bg-indigo-500/20 text-indigo-400',
    'DocuSign': 'bg-amber-500/20 text-amber-400',
    'Google Sheets': 'bg-emerald-500/20 text-emerald-400',
    'Calendly': 'bg-sky-500/20 text-sky-400',
    'Mailchimp': 'bg-amber-500/20 text-amber-400',
    'Google Drive': 'bg-yellow-500/20 text-yellow-400',
    'Clio Legal': 'bg-sky-500/20 text-sky-400',
    'Cloudbeds': 'bg-teal-500/20 text-teal-400',
    'Booking.com': 'bg-blue-500/20 text-blue-400',
    'DeepL Translate': 'bg-cyan-500/20 text-cyan-400',
    'Follow Up Boss': 'bg-orange-500/20 text-orange-400',
    'Zillow MLS': 'bg-sky-500/20 text-sky-400',
    'OpenTable': 'bg-red-500/20 text-red-400',
    'Buffer Social': 'bg-violet-500/20 text-violet-400',
    'Meta Ads': 'bg-sky-500/20 text-sky-400',
    'Google Ads': 'bg-yellow-500/20 text-yellow-400',
    'PDF Reader': 'bg-rose-500/20 text-rose-400',
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
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-200"
      >
        <HiInformationCircle className="w-5 h-5" />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 rounded-xl bg-foreground text-background text-xs leading-relaxed shadow-lg z-50 pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
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

function WalletTopup({ onAdd }) {
  const [selected, setSelected] = useState(null)
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const handleAdd = () => {
    const amount = showCustom ? parseFloat(custom) : selected
    if (!amount || amount <= 0) return
    onAdd(amount)
    setSelected(null)
    setCustom('')
    setShowCustom(false)
  }

  const activeAmount = showCustom ? parseFloat(custom) : selected

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent p-5 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex items-center gap-3 shrink-0">
        <img src="/assets/images/icons/wallet.png" alt="Wallet" className="h-[40px] w-auto" />
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold font-display text-foreground">Fund your Fluxy Wallet</h3>
            <InfoTooltip text="Your Fluxy Wallet is used to pay for cloud services and premium skills. Add credits here and they'll be available instantly for your agent to use." />
          </div>
          <p className="text-xs text-muted-foreground">Credits for cloud services and premium skills</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
        {walletPresets.map((amount) => (
          <button
            key={amount}
            onClick={() => { setSelected(amount); setShowCustom(false) }}
            className={`h-9 px-4 rounded-xl text-sm font-medium font-display border transition-all duration-200 ${
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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="0"
              autoFocus
              className="h-9 w-24 pl-7 pr-3 rounded-xl text-sm font-medium font-display border border-primary bg-primary/10 text-foreground outline-none placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        ) : (
          <button
            onClick={() => { setShowCustom(true); setSelected(null) }}
            className="h-9 px-4 rounded-xl text-sm font-medium font-display border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200"
          >
            Other
          </button>
        )}
        <Button
          onClick={handleAdd}
          disabled={!activeAmount || activeAmount <= 0}
          size="sm"
          className="rounded-xl bg-gradient-brand hover:opacity-90 text-white font-medium font-display h-9 px-5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add to Cart
        </Button>
      </div>
    </motion.div>
  )
}

function generateRedeemCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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

function CartSheet({ cart, onClose, onRemove, onCheckout, success }) {
  const total = cart.reduce((sum, item) => sum + item.priceNum * item.qty, 0)
  const [copied, setCopied] = useState(false)
  const redeemCode = useState(() => generateRedeemCode())[0]

  const hasSkillsOrBundles = success && success.items.some(i => i.type !== 'wallet')
  const hasWallet = success && success.items.some(i => i.type === 'wallet')
  const walletTotal = success ? success.items.filter(i => i.type === 'wallet').reduce((s, i) => s + i.priceNum, 0) : 0
  const itemNames = success ? success.items.filter(i => i.type !== 'wallet').map(i => i.name || i.title) : []

  const premadeMessage = `Hey Jarvis, use the code ${redeemCode} on the Marketplace to redeem your new ${itemNames.length === 1 ? itemNames[0] : `${itemNames.length} items`}.`

  const handleCopy = () => {
    navigator.clipboard.writeText(premadeMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        className="fixed top-0 right-0 bottom-0 z-[80] w-full sm:w-[420px] bg-background border-l border-border/50 flex flex-col shadow-2xl"
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
                {hasSkillsOrBundles && hasWallet
                  ? <>Your Fluxy <span className="text-primary font-semibold">Jarvis</span> will be so happy with its new skills and its new balance.</>
                  : hasSkillsOrBundles
                    ? <>Your Fluxy <span className="text-primary font-semibold">Jarvis</span> will be so happy with its new skills.</>
                    : <>Your Fluxy <span className="text-primary font-semibold">Jarvis</span> wallet has been funded.</>}
              </p>
            </motion.div>

            {hasWallet && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 mb-5"
              >
                <div className="flex items-center gap-3">
                  <img src="/assets/images/icons/wallet.png" alt="Wallet" className="h-8 w-auto" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fluxy <span className="text-primary font-semibold">Jarvis</span> balance updated</p>
                    <p className="text-lg font-bold font-display text-emerald-400">${walletTotal.toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {hasSkillsOrBundles && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="rounded-xl border border-border/30 bg-card p-4 mb-5"
              >
                <p className="text-xs text-muted-foreground mb-3">
                  Ask Jarvis to redeem this code on the Marketplace:
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
                    {item.type === 'wallet' ? (
                      <img src="/assets/images/icons/wallet.png" alt="Wallet" className="h-[30px] w-auto shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                        <HiCheckCircle className="w-3 h-3 text-emerald-400" />
                      </div>
                    )}
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
                      {item.type === 'wallet' ? (
                        <img src="/assets/images/icons/wallet.png" alt="Wallet" className="h-[30px] w-auto shrink-0" />
                      ) : (
                        <ItemIcon name={item.name || item.title} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium font-display text-foreground leading-tight">{item.name || item.title}</p>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mt-0.5">{item.type === 'wallet' ? 'Wallet Top-up' : item.type}</p>
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
                  className="w-full rounded-xl bg-gradient-brand hover:opacity-90 text-white font-semibold font-display h-11 text-sm"
                >
                  Checkout
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

function DetailModal({ item, onClose, onAddToCart, isInCart }) {
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
              {!isCloud && (
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
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [bundleFilter, setBundleFilter] = useState('Featured')
  const [skillFilter, setSkillFilter] = useState('Featured')
  const [cloudFilter, setCloudFilter] = useState('Featured')

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id)
      if (exists) return prev
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const addWalletToCart = (amount) => {
    const walletId = `wallet-${Date.now()}`
    setCart(prev => [...prev, {
      id: walletId,
      type: 'wallet',
      name: 'Wallet Top-up',
      price: `$${amount.toFixed(2)}`,
      priceNum: amount,
      qty: 1,
    }])
  }

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(c => c.id !== id))
  }


  const handleCheckout = () => {
    setCheckoutSuccess({ items: [...cart] })
    setCart([])
  }

  const handleCloseCart = () => {
    setCartOpen(false)
    setCheckoutSuccess(null)
  }

  const isInCart = (id) => cart.some(c => c.id === id)
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.priceNum * item.qty, 0)

  const q = searchQuery.toLowerCase().trim()

  const sortItems = (items, filter, priceKey = 'priceNum') => {
    const sorted = [...items]
    if (filter === 'Price: Low to High') sorted.sort((a, b) => (a[priceKey] || 0) - (b[priceKey] || 0))
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
    cloudFilter,
    'priceNum'
  )

  const hasResults = filteredBundles.length > 0 || filteredSkills.length > 0 || filteredCloud.length > 0

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-1.5">
              <HiArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight">Marketplace</h1>
                  <span className="inline-flex items-center h-7 px-3 rounded-full border border-border text-xs text-muted-foreground font-medium font-display hover:text-foreground hover:border-[#AF27E3]/30 transition-all duration-200">
                    For Agents
                  </span>
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

          {!q && (
          <div className="mb-10">
            <WalletTopup onAdd={addWalletToCart} />
          </div>
          )}

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
                {filteredBundles.map((bundle, i) => (
                  <motion.div
                    key={bundle.id}
                    variants={fadeUp}
                    custom={i * 0.5}
                    onClick={() => setDetailItem(bundle)}
                    className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] shrink-0 snap-start cursor-pointer"
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
                        className="text-xs text-primary mb-3 font-medium hover:text-primary/80 transition-colors duration-200 text-left"
                      >
                        + {bundle.skills.length - 3} More...
                      </button>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                      <span className="text-sm font-semibold font-display text-foreground">{bundle.price}</span>
                      {isInCart(bundle.id) ? (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">Added</span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCart(bundle) }}
                          className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-primary transition-all duration-200 text-xs"
                        >
                          <span className="w-6 h-6 rounded-md border border-border/50 flex items-center justify-center hover:border-primary/40">
                            <HiPlus className="w-3 h-3" />
                          </span>
                          <span className="font-medium">Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Carousel>
          </motion.section>
          )}

          {filteredSkills.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2} className="mb-12">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Skills</h2>
                <InfoTooltip text="Skills are abilities you install on your Fluxy. Once added, your agent can use them autonomously -- from searching the web to reading PDFs and reviewing code." />
              </div>
              <FilterTabs active={skillFilter} onChange={setSkillFilter} />
            </div>
            <Carousel>
              <div className="grid grid-rows-2 grid-flow-col gap-4 w-max">
                {filteredSkills.map((skill, i) => (
                  <motion.div
                    key={skill.id}
                    variants={fadeUp}
                    custom={i * 0.3}
                    onClick={() => setDetailItem(skill)}
                    className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] snap-start cursor-pointer"
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
                      {isInCart(skill.id) ? (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">Added</span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCart(skill) }}
                          className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-primary transition-all duration-200 text-xs"
                        >
                          <span className="w-6 h-6 rounded-md border border-border/50 flex items-center justify-center hover:border-primary/40">
                            <HiPlus className="w-3 h-3" />
                          </span>
                          <span className="font-medium">Add to Cart</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Carousel>
          </motion.section>
          )}

          {filteredCloud.length > 0 && (
          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}>
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Cloud Services</h2>
                <InfoTooltip text="Cloud services run on our servers so your Fluxy doesn't get overloaded. Just ask your Fluxy to use a service and it already knows how. Charged per use from your wallet." />
              </div>
              <FilterTabs active={cloudFilter} onChange={setCloudFilter} />
            </div>
            <Carousel>
              <div className="flex gap-4">
                {filteredCloud.map((service, i) => (
                  <motion.div
                    key={service.name}
                    variants={fadeUp}
                    custom={i * 0.5}
                    onClick={() => setDetailItem(service)}
                    className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] shrink-0 snap-start cursor-pointer"
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
                      <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-all duration-200 font-medium">
                        See Details
                      </span>
                    </div>
                  </motion.div>
                ))}
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
        {cartCount > 0 && !cartOpen && (
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
          />
        )}
      </AnimatePresence>
    </div>
  )
}
