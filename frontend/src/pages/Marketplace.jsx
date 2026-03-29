import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import {
  HiMagnifyingGlass, HiChevronRight, HiPlus, HiCheck,
  HiBars3, HiXMark, HiArrowLeft, HiInformationCircle
} from 'react-icons/hi2'
import { FaGithub, FaDiscord, FaStar, FaRocket } from 'react-icons/fa'

const bundles = [
  {
    title: 'Data Migration Bundle',
    description: 'Everything you need to migrate and transform your data pipelines',
    services: [
      { name: 'Google DataFlow', vendor: 'Google' },
      { name: 'Snowflake', vendor: 'Snowflake Inc.' },
      { name: 'Databricks', vendor: 'Databricks Inc.' },
    ],
    tags: ['Data Migration', 'Display Reporting', '+3'],
    price: 'Free',
  },
  {
    title: 'AI / ML',
    description: 'Build and deploy machine learning models at scale',
    services: [
      { name: 'Databricks', vendor: 'Snowflake Inc.' },
      { name: 'dbt', vendor: 'Snowflake Inc.' },
      { name: 'KubeFlow', vendor: 'Google' },
    ],
    tags: ['Data Migration', 'Display Reporting', '+2'],
    price: '$156.00',
  },
  {
    title: 'Data Analytics',
    description: 'Comprehensive analytics stack for data-driven decisions',
    services: [
      { name: 'Data Fusion', vendor: 'Google' },
      { name: 'Tableau', vendor: 'Snowflake Inc.' },
      { name: 'Databricks', vendor: 'Snowflake Inc.' },
    ],
    tags: ['Data Migration', 'Display Reporting', '+3'],
    price: '$134.00',
    extra: '+ 4 More...',
  },
  {
    title: 'Data Fusion Suite',
    description: 'Unified data integration and transformation platform',
    services: [
      { name: 'Data Fusion', vendor: 'Google' },
      { name: 'Tableau', vendor: 'Snowflake Inc.' },
      { name: 'Databricks', vendor: 'Snowflake Inc.' },
    ],
    tags: ['Data Migration', 'Display Reporting', '+9'],
    price: '$190.00',
    extra: '+ 6 More...',
  },
]

const featuredServices = [
  { name: 'dbt', vendor: 'dbt Inc.', description: 'Transform and model your data with SQL-based workflows', rating: 4, price: '$192.00' },
  { name: 'Google Cloud', vendor: 'Google Inc.', description: 'Enterprise cloud infrastructure and managed services', rating: 3.5, price: '$124.00' },
  { name: 'Tableau', vendor: 'Tableau Software LLC.', description: 'Interactive data visualization and business intelligence', rating: 5, price: '$150.00' },
  { name: 'SnapLogic', vendor: 'Google Inc.', description: 'Intelligent integration platform for modern enterprises', rating: 4.5, price: '$192.00' },
]

const trendingServices = [
  { name: 'Snowflake', vendor: 'Snow Inc.', description: "The world's leading analytics platform", status: 'added', price: null },
  { name: 'Databricks', vendor: 'Databricks Inc.', description: 'One of the most unique lakehouse platforms in the world', status: 'provisioning', progress: 30, price: null },
  { name: 'Tableau', vendor: 'Tableau Software Llc.', description: "The world's leading analytics platform", status: 'available', price: '$134.00' },
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

function ServiceIcon({ name }) {
  const colors = {
    'Google DataFlow': 'bg-blue-500/20 text-blue-400',
    'Snowflake': 'bg-cyan-500/20 text-cyan-400',
    'Databricks': 'bg-red-500/20 text-red-400',
    'dbt': 'bg-orange-500/20 text-orange-400',
    'KubeFlow': 'bg-blue-500/20 text-blue-400',
    'Data Fusion': 'bg-emerald-500/20 text-emerald-400',
    'Tableau': 'bg-indigo-500/20 text-indigo-400',
    'Google Cloud': 'bg-blue-500/20 text-blue-400',
    'SnapLogic': 'bg-violet-500/20 text-violet-400',
  }
  const cls = colors[name] || 'bg-primary/20 text-primary'
  return (
    <div className={`w-8 h-8 rounded-lg ${cls} flex items-center justify-center text-xs font-bold font-display shrink-0`}>
      {name.charAt(0)}
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
                <p className="text-muted-foreground mt-1">Discover services, bundles, and integrations for your stack</p>
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
                    {bundle.services.map((s) => (
                      <div key={s.name} className="flex items-center gap-2.5">
                        <ServiceIcon name={s.name} />
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
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-5">Featured Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredServices.map((service, i) => (
                <motion.div
                  key={service.name}
                  variants={fadeUp}
                  custom={i * 0.5}
                  className="group rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-all duration-300 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <ServiceIcon name={service.name} />
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
            <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground mb-5">Trending Services</h2>
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/30">
              {trendingServices.map((service) => (
                <div key={service.name} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors duration-200">
                  <div className="flex items-center gap-4">
                    <ServiceIcon name={service.name} />
                    <div>
                      <h3 className="font-semibold font-display text-foreground text-sm">{service.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{service.vendor}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    {service.status === 'added' && (
                      <>
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <HiCheck className="w-4 h-4" /> ADDED
                        </span>
                        <div className="flex items-center gap-2">
                          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-1">
                            <HiInformationCircle className="w-4 h-4" /> Info
                          </button>
                          <Button size="sm" className="rounded-full text-xs h-8 px-4 bg-gradient-brand hover:opacity-90 text-white font-medium">
                            <FaRocket className="w-3 h-3 mr-1.5" /> Launch
                          </Button>
                        </div>
                      </>
                    )}
                    {service.status === 'provisioning' && (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-border/30 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${service.progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{service.progress}% Done</span>
                        </div>
                        <button className="text-xs text-red-400 hover:text-red-300 transition-colors duration-200 font-medium">
                          Cancel
                        </button>
                      </>
                    )}
                    {service.status === 'available' && (
                      <>
                        <span className="text-sm font-semibold font-display text-foreground">{service.price}</span>
                        <Button variant="outline" size="sm" className="rounded-full text-xs h-8 px-4 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60">
                          Add
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  )
}
