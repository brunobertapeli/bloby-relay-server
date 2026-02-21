import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_URL } from '../api'

const HANDLES = [
  { tier: 'premium', prefix: '', suffix: '.fluxy.bot', paid: true, price: '$5' },
  { tier: 'at',      prefix: '', suffix: '.at.fluxy.bot', paid: false },
]

export default function HandleSelector() {
  const [name, setName] = useState('')
  const [status, setStatus] = useState(null) // null | 'checking' | 'ready' | 'invalid'
  const [error, setError] = useState('')
  const [tierAvailability, setTierAvailability] = useState({}) // { premium: true, at: false }
  const debounce = useRef(null)

  useEffect(() => {
    clearTimeout(debounce.current)
    setStatus(null)
    setError('')
    setTierAvailability({})

    const trimmed = name.trim()
    if (trimmed.length === 0) return
    if (trimmed.length < 3) {
      setStatus('invalid')
      setError('At least 3 characters')
      return
    }

    setStatus('checking')

    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/availability/${encodeURIComponent(trimmed)}`)
        const data = await res.json()

        if (!data.valid) {
          setStatus('invalid')
          setError(data.error)
        } else {
          const avail = {}
          for (const h of data.handles) {
            avail[h.tier] = h.available
          }
          setTierAvailability(avail)
          setStatus('ready')
        }
      } catch {
        setStatus(null)
      }
    }, 400)

    return () => clearTimeout(debounce.current)
  }, [name])

  const handleInput = (e) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setName(raw)
  }

  const placeholder = 'your-bot-name'
  const display = name || placeholder
  const isEmpty = name.length === 0

  return (
    <section id="handle" className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 border-t border-border/30 relative">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4">
            Claim your handle
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto px-2">
            Pick a name for your bot. Access it from anywhere, forever.
          </p>
        </div>

        {/* Input */}
        <div className="relative mb-6 sm:mb-8">
          <input
            type="text"
            value={name}
            onChange={handleInput}
            maxLength={30}
            placeholder="your-bot-name"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full h-14 sm:h-16 px-5 sm:px-6 rounded-2xl border border-border bg-card text-lg sm:text-xl font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all duration-200"
          />

          {/* Status indicator */}
          <AnimatePresence mode="wait">
            {status && name.length > 0 && (
              <motion.div
                key={status}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {status === 'checking' && (
                  <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                )}
                {status === 'invalid' && (
                  <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01" />
                    </svg>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {status === 'invalid' && error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-amber-400 text-sm text-center -mt-4 mb-6"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Handle options — always visible, per-tier availability */}
        <div className="space-y-2.5 sm:space-y-3">
          {HANDLES.map((h, i) => {
            const isFirst = i === 0
            const available = status === 'ready' ? tierAvailability[h.tier] : null
            const taken = available === false

            return (
              <motion.div
                key={h.tier}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={`
                  relative flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl border transition-all duration-300
                  ${taken
                    ? 'border-border/50 bg-card/30 opacity-60'
                    : isFirst
                      ? 'border-primary/30 bg-primary/[0.04] hover:border-primary/50 hover:bg-primary/[0.06]'
                      : 'border-border bg-card hover:border-border hover:bg-card/80'
                  }
                `}
              >
                {/* Premium glow */}
                {isFirst && !taken && (
                  <div className="absolute inset-0 rounded-xl bg-primary/[0.03] pointer-events-none" />
                )}

                <div className="relative flex items-center min-w-0">
                  {h.prefix && (
                    <span className="font-mono text-sm sm:text-base text-muted-foreground/60 shrink-0">
                      {h.prefix}
                    </span>
                  )}
                  <span className={`font-mono text-sm sm:text-base truncate ${isEmpty ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                    {display}
                  </span>
                  {h.suffix && (
                    <span className="font-mono text-sm sm:text-base text-muted-foreground/60 shrink-0">
                      {h.suffix}
                    </span>
                  )}
                </div>

                <div className="relative flex items-center gap-2 sm:gap-3 shrink-0 ml-3">
                  {taken ? (
                    <span className="text-xs font-medium font-display px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      Taken
                    </span>
                  ) : h.paid ? (
                    <span className="text-xs font-medium font-display px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/20">
                      {h.price}
                    </span>
                  ) : (
                    <span className="text-xs font-medium font-display px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Free
                    </span>
                  )}

                  {available && !isEmpty && (
                    <motion.svg
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-4 h-4 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </motion.svg>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        <p className="text-[11px] sm:text-xs text-muted-foreground/50 mt-4 sm:mt-5 text-center">
          Handles are claimed during <code className="text-primary/60">fluxy init</code>. Premium handles support custom subdomains.
        </p>
      </div>
    </section>
  )
}
