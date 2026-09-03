import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_URL } from '../api'

export default function HandleSelector({ user, onLogin, onReserve }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [available, setAvailable] = useState(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [reserving, setReserving] = useState(false)
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

  const handleReserve = async () => {
    if (!user) {
      setReserving(true)
      const success = await onLogin()
      setReserving(false)
      if (!success) return
    }
    if (onReserve) {
      setReserving(true)
      await onReserve(name.trim())
      setReserving(false)
    }
  }

  const isEmpty = name.length === 0
  const display = name || 'your-name'
  const taken = status === 'ready' && available === false
  const isAvailable = status === 'ready' && available === true && !isEmpty

  return (
    <section id="reserve" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 relative">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <span className="eyebrow mb-4">Your address</span>
          <h2 className="text-3xl sm:text-4xl md:text-[2.75rem] leading-[1.08] font-bold font-display text-foreground tracking-tight mb-4 text-balance">
            Claim your corner of the internet
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto px-2">
            Your Morphy, and everything it builds for you, will live at an address
            that is yours. Forever.
          </p>
        </div>

        <div
          className="relative mb-8 sm:mb-10 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <div
            className={`rounded-full transition-[box-shadow,border-color] duration-300 border ${
              inputFocused
                ? 'border-sky/60 shadow-[0_0_0_5px_hsl(var(--sky)/0.14),0_20px_40px_-20px_hsl(var(--primary)/0.5)]'
                : taken
                  ? 'border-destructive/50'
                  : isAvailable
                    ? 'border-emerald-400/50'
                    : 'border-border/80 shadow-lift'
            } bg-surface-1`}
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
              className="w-full h-16 sm:h-[4.5rem] px-6 rounded-full bg-transparent text-xl sm:text-2xl font-mono text-foreground text-center placeholder:text-muted-foreground/40 focus:outline-none relative z-[1]"
            />
          </div>

          <AnimatePresence mode="wait">
            {status && name.length > 0 && (
              <motion.div
                key={status}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="absolute right-5 top-1/2 -translate-y-1/2 z-10"
              >
                {status === 'checking' && (
                  <div className="w-5 h-5 border-2 border-muted-foreground/25 border-t-sky rounded-full animate-spin" />
                )}
                {status === 'invalid' && (
                  <div className="w-7 h-7 rounded-full bg-amber-400/15 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01" />
                    </svg>
                  </div>
                )}
                {status === 'ready' && !taken && (
                  <div className="w-7 h-7 rounded-full bg-emerald-400/15 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {status === 'ready' && taken && (
                  <div className="w-7 h-7 rounded-full bg-destructive/15 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-muted-foreground/35">
              morphyagent.com/
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
                    ? 'text-muted-foreground/35'
                    : taken
                      ? 'text-destructive/80'
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
                className="mt-5"
              >
                {taken ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-destructive font-medium font-display">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Already taken
                  </span>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium font-display">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Available
                    </span>
                    <button
                      onClick={handleReserve}
                      disabled={reserving}
                      className="btn-morphy group h-11 px-7 text-sm gap-2 disabled:opacity-60"
                    >
                      {reserving ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Reserve <span className="text-white/75 font-normal font-sans">$5 one-time</span>
                          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </>
                      )}
                    </button>
                    {!user && (
                      <p className="text-xs text-muted-foreground/60">
                        You'll need to sign in with Google to reserve
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground/60 mt-8 sm:mt-10 text-center">
          You'll be able to use your reserved handle when you set up your Morphy
        </p>
      </div>
    </section>
  )
}
