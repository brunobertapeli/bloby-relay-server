import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FaTelegramPlane } from 'react-icons/fa'
import { HiBars3, HiXMark } from 'react-icons/hi2'

export default function Navbar({ user, onLogin, onLogout }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const navLinks = [
    { href: isHome ? '#features' : '/#features', label: 'Features' },
    { href: isHome ? '#how-it-works' : '/#how-it-works', label: 'How it works' },
    { href: isHome ? '#install' : '/#install', label: 'Pricing' },
    { href: '/marketplace', label: 'Marketplace' },
    // { href: '/world', label: 'Morphy World' },
    { href: '/docs', label: 'Docs' },
  ]

  const isActive = (href) => location.pathname === href

  const linkClass = (href) =>
    `text-[15px] font-medium transition-colors duration-200 ${
      isActive(href)
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    }`

  const mobileLinkClass = (href) =>
    `py-3 px-4 rounded-2xl text-base font-medium transition-colors duration-200 ${
      isActive(href)
        ? 'text-foreground bg-foreground/[0.06]'
        : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]'
    }`

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 border-b ${
          scrolled || !isHome
            ? 'backdrop-blur-xl bg-background/75 border-foreground/[0.06]'
            : 'bg-transparent border-transparent'
        }`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-2">
            {/* Anchor for the MorphyMascot canvas. The mascot is rendered to a
                viewport-fixed canvas; this empty box reserves layout space and
                acts as the position target (resolved via getBoundingClientRect
                + data-morphy-anchor selector). Sized to match the old logo. */}
            <span
              data-morphy-anchor
              aria-hidden="true"
              className="block"
              style={{ width: 40, height: 35 }}
            />
            <span className="font-display font-bold text-[1.35rem] tracking-tight text-foreground">
              Morphy
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(link => (
              link.href.includes('#') ? (
                <a key={link.href} href={link.href} className="text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} to={link.href} className={linkClass(link.href)}>
                  {link.label}
                </Link>
              )
            ))}
            <a href="https://t.me/+qEdyaOT6CfswNmY5" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="text-muted-foreground hover:text-sky transition-colors duration-200">
              <FaTelegramPlane className="w-[18px] h-[18px]" />
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Hey, <span className="font-semibold text-foreground">{user.name?.split(' ')[0]}</span>
                </span>
                <Link
                  to="/dashboard"
                  className="btn-morphy h-9 px-5 text-sm"
                >
                  Dashboard
                </Link>
                <button
                  onClick={onLogout}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 underline underline-offset-4 decoration-foreground/20"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="btn-morphy h-9 px-5 text-sm hidden sm:inline-flex"
              >
                Login
              </button>
            )}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] md:hidden transition-colors duration-200"
            >
              <HiBars3 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-[290px] bg-surface-1 border-l border-border/60 rounded-l-[2rem] p-6 flex flex-col shadow-lift-lg"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <img src="/assets/images/morphy_mascot.png" alt="Morphy" className="h-[31px] w-auto" />
                  <span className="font-display font-bold text-lg text-foreground">Morphy</span>
                </div>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              {user ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-background/50 border border-border/60">
                    <span className="text-sm text-muted-foreground">
                      Hey, <span className="font-semibold text-foreground">{user.name?.split(' ')[0]}</span>
                    </span>
                    <button
                      onClick={() => { onLogout(); setMobileOpen(false) }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 underline underline-offset-4"
                    >
                      Log out
                    </button>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="btn-morphy mt-3 h-11 text-sm w-full"
                  >
                    Dashboard
                  </Link>
                </div>
              ) : (
                <div className="mb-4 mt-2">
                  <button
                    onClick={() => { onLogin(); setMobileOpen(false) }}
                    className="btn-morphy h-11 text-sm w-full"
                  >
                    Login
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-1">
                {navLinks.map(link => (
                  link.href.includes('#') ? (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="py-3 px-4 rounded-2xl text-base font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={mobileLinkClass(link.href)}
                    >
                      {link.label}
                    </Link>
                  )
                ))}
              </div>

              <div className="mt-auto">
                <a href="https://t.me/+qEdyaOT6CfswNmY5" target="_blank" rel="noopener noreferrer" className="btn-ghost h-11 w-full text-sm gap-2">
                  <FaTelegramPlane className="w-4 h-4" /> Telegram
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
