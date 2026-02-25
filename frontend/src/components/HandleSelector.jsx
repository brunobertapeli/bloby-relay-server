import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_URL } from '../api'

export default function HandleSelector() {
  const [name, setName] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [available, setAvailable] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef(null)
  const debounce = useRef(null)

  useEffect(() => {
    clearTimeout(debounce.current)
    setStatus(null)
    setError('')
    setAvailable(null)

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
          const premium = data.handles?.find(h => h.tier === 'premium')
          setAvailable(premium?.available ?? true)
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

  const isEmpty = name.length === 0
  const display = name || 'your-name'
  const taken = status === 'ready' && available === false

  return (
    <section id="handle" className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 border-t border-border/30 relative">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight mb-3 sm:mb-4">
            Claim your handle
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto px-2">
            Pick a name for your bot. Access it from anywhere, forever.
          </p>
        </div>

        <div
          className="relative mb-8 sm:mb-10 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <div
            className={`rounded-2xl p-px transition-shadow duration-300 ${
              inputFocused
                ? 'animated-border shadow-[0_0_24px_-6px_rgba(175,39,227,0.3)]'
                : 'bg-border'
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleInput}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              maxLength={30}
              placeholder="your-name"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full h-14 sm:h-16 px-5 sm:px-6 rounded-[calc(1rem-1px)] bg-card text-lg sm:text-xl font-mono text-foreground text-center placeholder:text-muted-foreground/40 focus:outline-none transition-all duration-200 relative z-[1]"
            />
          </div>

          <AnimatePresence mode="wait">
            {status && name.length > 0 && (
              <motion.div
                key={status}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
              >
                {status === 'checking' && (
                  <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-[#04D1FE] rounded-full animate-spin" />
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

        <AnimatePresence>
          {status === 'invalid' && error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-amber-400 text-sm text-center -mt-6 mb-6"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="text-center">
          <motion.div
            className="inline-flex items-baseline justify-center gap-0 font-display"
            layout
          >
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-muted-foreground/30">
              fluxy.bot/
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={display}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className={`text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight ${
                  isEmpty
                    ? 'text-muted-foreground/30'
                    : taken
                      ? 'text-red-400/80'
                      : 'text-gradient'
                }`}
              >
                {display}
              </motion.span>
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {status === 'ready' && !isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4"
              >
                {taken ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-red-400 font-medium font-display">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Already taken
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium font-display">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Available
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[11px] sm:text-xs text-muted-foreground/50 mt-8 sm:mt-10 text-center">
          Handles are claimed during <code className="text-foreground/50">fluxy init</code>
        </p>
      </div>
    </section>
  )
}