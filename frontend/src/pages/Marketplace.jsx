import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  HiMagnifyingGlass, HiArrowLeft, HiInformationCircle,
  HiShoppingCart, HiXMark, HiTrash, HiPlus, HiMinus, HiWallet,
  HiChevronLeft, HiChevronRight, HiCpuChip
} from 'react-icons/hi2'

const filterOptions = ['Featured', 'Popular', 'Newest', 'Price: Low to High']

const bundles = [
  {
    id: 'bundle-1',
    type: 'bundle',
    title: 'Productivity Pack',
    description: 'Essential skills to supercharge your daily workflow and task management',
    skills: [
      { name: 'Web Search', vendor: 'Fluxy' },
      { name: 'File Manager', vendor: 'Fluxy' },
      { name: 'Scheduler', vendor: 'Fluxy' },
    ],
    price: 'Free',
    priceNum: 0,
  },
  {
    id: 'bundle-2',
    type: 'bundle',
    title: 'AI / ML',
    description: 'Advanced AI and machine learning skills for data-driven projects',
    skills: [
      { name: 'Code Generator', vendor: 'Fluxy' },
      { name: 'Data Analyst', vendor: 'Fluxy' },
      { name: 'Model Trainer', vendor: 'Fluxy' },
    ],
    price: '$15.60',
    priceNum: 15.60,
  },
  {
    id: 'bundle-3',
    type: 'bundle',
    title: 'Developer Tools',
    description: 'Full-stack development skills for building and shipping faster',
    skills: [
      { name: 'Git Manager', vendor: 'Fluxy' },
      { name: 'API Builder', vendor: 'Fluxy' },
      { name: 'Debugger', vendor: 'Fluxy' },
    ],
    price: '$13.40',
    priceNum: 13.40,
    extra: '+ 4 More...',
  },
  {
    id: 'bundle-4',
    type: 'bundle',
    title: 'Content Creator',
    description: 'Everything you need to write, design, and publish content',
    skills: [
      { name: 'Copywriter', vendor: 'Fluxy' },
      { name: 'Image Gen', vendor: 'Fluxy' },
      { name: 'Social Media', vendor: 'Fluxy' },
    ],
    price: '$19.00',
    priceNum: 19.00,
    extra: '+ 6 More...',
  },
  {
    id: 'bundle-5',
    type: 'bundle',
    title: 'Support Agent',
    description: 'Turn your Fluxy into a customer support specialist with ticketing and chat',
    skills: [
      { name: 'Translator', vendor: 'Fluxy' },
      { name: 'Web Search', vendor: 'Fluxy' },
      { name: 'Scheduler', vendor: 'Fluxy' },
    ],
    price: '$11.00',
    priceNum: 11.00,
    extra: '+ 3 More...',
  },
]

const cloudServices = [
  { name: 'Nano Image Gen', vendor: 'Fluxy Cloud', description: 'Generate images from text prompts without loading models locally', calls: '142.3k', price: '$0.02 / call' },
  { name: 'Code Review', vendor: 'Fluxy Cloud', description: 'Deep code analysis, security audit, and best-practice checks via API', calls: '89.1k', price: '$0.05 / call' },
  { name: 'PDF Convert', vendor: 'Fluxy Cloud', description: 'Convert, merge, split, and OCR PDF documents on the cloud', calls: '214.7k', price: '$0.01 / page' },
  { name: 'Speech to Text', vendor: 'Fluxy Cloud', description: 'Transcribe audio files to text with speaker detection', calls: '56.4k', price: '$0.03 / min' },
  { name: 'Web Scraper', vendor: 'Fluxy Cloud', description: 'Extract structured data from any website without getting blocked', calls: '331.2k', price: '$0.01 / page' },
]

const skills = [
  { id: 'skill-1', type: 'skill', name: 'Web Search', vendor: 'Fluxy', description: 'Search the web in real-time and bring back structured results', rating: 5, price: 'Free', priceNum: 0 },
  { id: 'skill-2', type: 'skill', name: 'Code Review', vendor: 'Fluxy', description: 'Automated code review with best practices and security checks', rating: 4.5, price: '$4.00', priceNum: 4.00 },
  { id: 'skill-3', type: 'skill', name: 'Translator', vendor: 'Fluxy', description: 'Translate text between 50+ languages with context awareness', rating: 4, price: 'Free', priceNum: 0 },
  { id: 'skill-4', type: 'skill', name: 'PDF Reader', vendor: 'Fluxy', description: 'Extract, summarize, and query content from PDF documents', rating: 4, price: '$3.00', priceNum: 3.00 },
  { id: 'skill-5', type: 'skill', name: 'Scheduler', vendor: 'Fluxy', description: 'Schedule tasks, set reminders, and manage recurring workflows', rating: 4.5, price: 'Free', priceNum: 0 },
  { id: 'skill-6', type: 'skill', name: 'Image Gen', vendor: 'Fluxy', description: 'Create images, illustrations, and graphics from text descriptions', rating: 4, price: '$5.00', priceNum: 5.00 },
  { id: 'skill-7', type: 'skill', name: 'Data Analyst', vendor: 'Fluxy', description: 'Analyze datasets, generate reports, and surface actionable insights', rating: 4.5, price: '$6.00', priceNum: 6.00 },
  { id: 'skill-8', type: 'skill', name: 'File Manager', vendor: 'Fluxy', description: 'Organize, move, rename, and manage files across your system', rating: 5, price: 'Free', priceNum: 0 },
  { id: 'skill-9', type: 'skill', name: 'Copywriter', vendor: 'Fluxy', description: 'Draft emails, blog posts, landing pages, and marketing copy', rating: 4.5, price: '$4.50', priceNum: 4.50 },
  { id: 'skill-10', type: 'skill', name: 'Debugger', vendor: 'Fluxy', description: 'Identify bugs, trace errors, and suggest fixes across your codebase', rating: 4, price: '$5.00', priceNum: 5.00 },
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
    'Web Search': 'bg-cyan-500/20 text-cyan-400',
    'File Manager': 'bg-emerald-500/20 text-emerald-400',
    'Scheduler': 'bg-amber-500/20 text-amber-400',
    'Code Generator': 'bg-violet-500/20 text-violet-400',
    'Data Analyst': 'bg-rose-500/20 text-rose-400',
    'Model Trainer': 'bg-orange-500/20 text-orange-400',
    'Git Manager': 'bg-emerald-500/20 text-emerald-400',
    'API Builder': 'bg-cyan-500/20 text-cyan-400',
    'Debugger': 'bg-red-500/20 text-red-400',
    'Copywriter': 'bg-pink-500/20 text-pink-400',
    'Image Gen': 'bg-violet-500/20 text-violet-400',
    'Social Media': 'bg-sky-500/20 text-sky-400',
    'Nano Image Gen': 'bg-violet-500/20 text-violet-400',
    'Code Review': 'bg-orange-500/20 text-orange-400',
    'PDF Convert': 'bg-rose-500/20 text-rose-400',
    'Speech to Text': 'bg-teal-500/20 text-teal-400',
    'Translator': 'bg-sky-500/20 text-sky-400',
    'PDF Reader': 'bg-rose-500/20 text-rose-400',
    'Web Scraper': 'bg-emerald-500/20 text-emerald-400',
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
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <HiWallet className="w-5 h-5 text-primary" />
        </div>
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

function CartSheet({ cart, onClose, onRemove, onQuantityChange }) {
  const total = cart.reduce((sum, item) => sum + item.priceNum * item.qty, 0)

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
            <HiShoppingCart className="w-5 h-5 text-foreground" />
            <h2 className="text-lg font-bold font-display text-foreground">Your Cart</h2>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {cart.reduce((sum, item) => sum + item.qty, 0)} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

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
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <HiWallet className="w-4 h-4 text-primary" />
                    </div>
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
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-foreground">{item.price}</span>
                      {item.type !== 'wallet' && item.priceNum > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onQuantityChange(item.id, item.qty - 1)}
                            className="w-6 h-6 rounded-md border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors duration-200"
                          >
                            <HiMinus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-medium text-foreground w-6 text-center">{item.qty}</span>
                          <button
                            onClick={() => onQuantityChange(item.id, item.qty + 1)}
                            className="w-6 h-6 rounded-md border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors duration-200"
                          >
                            <HiPlus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
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
            <Button className="w-full rounded-xl bg-gradient-brand hover:opacity-90 text-white font-semibold font-display h-11 text-sm">
              Checkout
            </Button>
          </div>
        )}
      </motion.div>
    </>
  )
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
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

  const changeQuantity = (id, newQty) => {
    if (newQty < 1) {
      removeFromCart(id)
      return
    }
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: newQty } : c))
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
                  <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium font-display">
                    <HiCpuChip className="w-3.5 h-3.5" />
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
                    className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] shrink-0 snap-start"
                  >
                    <h3 className="font-semibold font-display text-foreground text-sm mb-1">{bundle.title}</h3>
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{bundle.description}</p>
                    <div className="flex flex-col gap-2.5 mb-4 flex-1">
                      {bundle.skills.map((s) => (
                        <div key={s.name} className="flex items-center gap-2.5">
                          <ItemIcon name={s.name} />
                          <div>
                            <div className="text-sm font-medium text-foreground leading-tight">{s.name}</div>
                            <div className="text-[11px] text-muted-foreground">{s.vendor}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {bundle.extra && (
                      <p className="text-xs text-primary mb-3 font-medium">{bundle.extra}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                      <span className="text-sm font-semibold font-display text-foreground">{bundle.price}</span>
                      {isInCart(bundle.id) ? (
                        <span className="text-xs text-emerald-400 font-medium px-4 h-8 flex items-center">Added</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToCart(bundle)}
                          className="rounded-full text-xs h-8 px-4 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60"
                        >
                          Add bundle
                        </Button>
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
                    className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] snap-start"
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
                        <span className="text-xs text-emerald-400 font-medium">Added</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToCart(skill)}
                          className="rounded-full text-xs h-8 px-4 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60"
                        >
                          Add
                        </Button>
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
                    className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col min-w-[260px] w-[260px] sm:min-w-[280px] sm:w-[280px] shrink-0 snap-start"
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
                      <button className="text-xs text-primary hover:text-primary/80 transition-colors duration-200 font-medium">
                        See Details
                      </button>
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
        {cartOpen && (
          <CartSheet
            cart={cart}
            onClose={() => setCartOpen(false)}
            onRemove={removeFromCart}
            onQuantityChange={changeQuantity}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
