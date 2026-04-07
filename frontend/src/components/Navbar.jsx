import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './ui/button'
import { FaDiscord } from 'react-icons/fa'
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
    { href: '/marketplace', label: 'Marketplace' },
    { href: isHome ? '#square' : '/square', label: 'Square' },
    { href: '/docs', label: 'Docs' },
  ]

  const isActive = (href) => location.pathname === href

  const linkClass = (href) =>
    `text-sm transition-colors duration-200 ${
      isActive(href)
        ? 'text-foreground font-medium'
        : 'text-muted-foreground hover:text-foreground'
    }`

  const mobileLinkClass = (href) =>
    `py-3 px-3 rounded-xl text-base transition-colors duration-200 ${
      isActive(href)
        ? 'text-foreground font-medium bg-white/5'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
    }`

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || !isHome ? 'backdrop-blur-xl bg-background/80 border-b border-border/50' : 'bg-transparent'
        }`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="group">
            <motion.img
              src="/assets/images/bloby_mascot.png"
              alt="Bloby"
              className="h-[50px] w-auto"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300 }}
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              link.href.includes('#') ? (
                <a key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} to={link.href} className={linkClass(link.href)}>
                  {link.label}
                </Link>
              )
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a href="https://discord.gg/QERDj3CBFj" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200">
              <FaDiscord className="w-[18px] h-[18px]" />
            </a>
            {user ? (
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-sm text-foreground/80 font-display">
                  Hey, <span className="font-semibold text-foreground">{user.name?.split(' ')[0]}</span>
                </span>
                <Link
                  to="/dashboard"
                  className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display px-5 h-9 text-sm flex items-center transition-all duration-200"
                >
                  Dashboard
                </Link>
                <button
                  onClick={onLogout}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 underline underline-offset-2"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Button
                onClick={onLogin}
                className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display px-5 h-9 text-sm hidden sm:flex"
              >
                Login
              </Button>
            )}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground md:hidden transition-colors duration-200"
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-[280px] bg-background border-l border-border/50 p-6 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <img src="/assets/images/bloby_mascot.png" alt="Bloby" className="h-[44px] w-auto" />
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  <HiXMark className="w-5 h-5" />
                </button>
              </div>

              {user ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-white/[0.03] border border-border/50">
                    <span className="text-sm text-foreground/80 font-display">
                      Hey, <span className="font-semibold text-foreground">{user.name?.split(' ')[0]}</span>
                    </span>
                    <button
                      onClick={() => { onLogout(); setMobileOpen(false) }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 underline underline-offset-2"
                    >
                      Sair
                    </button>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="mt-3 rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display h-11 text-sm w-full flex items-center justify-center transition-all duration-200"
                  >
                    Dashboard
                  </Link>
                </div>
              ) : (
                <div className="mb-4 mt-2">
                  <Button
                    onClick={() => { onLogin(); setMobileOpen(false) }}
                    className="rounded-full bg-gradient-brand hover:opacity-90 text-white font-medium font-display h-11 text-sm w-full"
                  >
                    Login
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-1">
                {navLinks.map(link => (
                  link.href.includes('#') ? (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="py-3 px-3 rounded-xl text-base text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors duration-200"
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
                <a href="https://discord.gg/QERDj3CBFj" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 h-10 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-all duration-200">
                  <FaDiscord className="w-4 h-4" /> Discord
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
