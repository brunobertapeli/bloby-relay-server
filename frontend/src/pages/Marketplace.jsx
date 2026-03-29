import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import {
  HiMagnifyingGlass, HiChevronRight, HiArrowLeft, HiInformationCircle
} from 'react-icons/hi2'

const bundles = [
  {
    title: 'Productivity Pack',
    description: 'Essential skills to supercharge your daily workflow and task management',
    skills: [
      { name: 'Web Search', vendor: 'Fluxy' },
      { name: 'File Manager', vendor: 'Fluxy' },
      { name: 'Scheduler', vendor: 'Fluxy' },
    ],
    tags: ['Productivity', 'Automation', '+3'],
    price: 'Free',
  },
  {
    title: 'AI / ML',
    description: 'Advanced AI and machine learning skills for data-driven projects',
    skills: [
      { name: 'Code Generator', vendor: 'Fluxy' },
      { name: 'Data Analyst', vendor: 'Fluxy' },
      { name: 'Model Trainer', vendor: 'Fluxy' },
    ],
    tags: ['AI', 'Machine Learning', '+2'],
    price: '$156.00',
  },
  {
    title: 'Developer Tools',
    description: 'Full-stack development skills for building and shipping faster',
    skills: [
      { name: 'Git Manager', vendor: 'Fluxy' },
      { name: 'API Builder', vendor: 'Fluxy' },
      { name: 'Debugger', vendor: 'Fluxy' },
    ],
    tags: ['Development', 'DevOps', '+3'],
    price: '$134.00',
    extra: '+ 4 More...',
  },
  {
    title: 'Content Creator',
    description: 'Everything you need to write, design, and publish content',
    skills: [
      { name: 'Copywriter', vendor: 'Fluxy' },
      { name: 'Image Gen', vendor: 'Fluxy' },
      { name: 'Social Media', vendor: 'Fluxy' },
    ],
    tags: ['Content', 'Marketing', '+9'],
    price: '$190.00',
    extra: '+ 6 More...',
  },
]

const cloudServices = [
  { name: 'GPU Compute', vendor: 'Fluxy Cloud', description: 'High-performance GPU instances for heavy AI workloads', rating: 4, price: '$192.00' },
  { name: 'Vector Store', vendor: 'Fluxy Cloud', description: 'Managed vector database for embeddings and semantic search', rating: 3.5, price: '$124.00' },
  { name: 'Model Hosting', vendor: 'Fluxy Cloud', description: 'Deploy and serve ML models with auto-scaling infrastructure', rating: 5, price: '$150.00' },
  { name: 'Data Pipeline', vendor: 'Fluxy Cloud', description: 'Serverless ETL pipelines for real-time data processing', rating: 4.5, price: '$192.00' },
]

const trendingSkills = [
  { name: 'Web Search', vendor: 'Fluxy', description: 'Search the web in real-time and bring back structured results', rating: 5, price: 'Free' },
  { name: 'Code Review', vendor: 'Fluxy', description: 'Automated code review with best practices and security checks', rating: 4.5, price: '$12.00' },
  { name: 'Translator', vendor: 'Fluxy', description: 'Translate text between 50+ languages with context awareness', rating: 4, price: 'Free' },
  { name: 'PDF Reader', vendor: 'Fluxy', description: 'Extract, summarize, and query content from PDF documents', rating: 4, price: '$8.00' },
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
    'GPU Compute': 'bg-amber-500/20 text-amber-400',
    'Vector Store': 'bg-teal-500/20 text-teal-400',
    'Model Hosting': 'bg-indigo-500/20 text-indigo-400',
    'Data Pipeline': 'bg-emerald-500/20 text-emerald-400',
    'Code Review': 'bg-orange-500/20 text-orange-400',
    'Translator': 'bg-sky-500/20 text-sky-400',
    'PDF Reader': 'bg-rose-500/20 text-rose-400',
  }
  const cls = colors[name] || 'bg-primary/20 text-primary'
  return (
    <div className={`w-8 h-8 rounded-lg ${cls} flex items-center justify-center text-xs font-bold font-display shrink-0`}>
      {name.charAt(0)}
    </div>
  )
}

function InfoTooltip() {
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
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-foreground text-background text-xs leading-relaxed shadow-lg z-50 pointer-events-none">
          We offer services on the cloud so your Fluxy doesn't get overloaded with too many skills. Just ask your Fluxy to use the service and it already knows how to.
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
        </div>
      )}
    </div>
  )
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('')

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

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight">Marketplace</h1>
                <p className="text-muted-foreground mt-1">Discover skills, cloud services, and bundles for your Fluxy</p>
              </div>
              <div className="relative w-full sm:w-72">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search marketplace..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl bg-card border-border/50 h-10"
                />
              </div>
            </div>
          </motion.div>

          <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={1} className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Bundles</h2>
              <button className="text-sm text-primary hover:text-primary/80 transition-colors duration-200 flex items-center gap-1 font-medium">
                See all <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {bundles.map((bundle, i) => (
                <motion.div
                  key={bundle.title}
                  variants={fadeUp}
                  custom={i * 0.5}
                  className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col"
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
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {bundle.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] rounded-full px-2 py-0.5 border-border/50 text-muted-foreground">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                    <span className="text-sm font-semibold font-display text-foreground">{bundle.price}</span>
                    <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60">
                      Add bundle
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2} className="mb-12">
            <div className="flex items-center gap-2.5 mb-5">
              <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Cloud Services</h2>
              <InfoTooltip />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cloudServices.map((service, i) => (
                <motion.div
                  key={service.name}
                  variants={fadeUp}
                  custom={i * 0.5}
                  className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <ItemIcon name={service.name} />
                    <div>
                      <h3 className="font-semibold font-display text-foreground text-sm leading-tight">{service.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{service.vendor}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{service.description}</p>
                  <Stars rating={service.rating} />
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                    <span className="text-sm font-semibold font-display text-foreground">{service.price}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60">
                        Add
                      </Button>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200">
                        See Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground">Trending Skills</h2>
              <button className="text-sm text-primary hover:text-primary/80 transition-colors duration-200 flex items-center gap-1 font-medium">
                See all <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trendingSkills.map((skill, i) => (
                <motion.div
                  key={skill.name}
                  variants={fadeUp}
                  custom={i * 0.5}
                  className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col"
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60">
                        Add
                      </Button>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200">
                        See Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  )
}
