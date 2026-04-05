import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import { useState, useEffect, useRef } from 'react'
import { API_URL } from '../api'

export default function Square() {
  const [user, setUser] = useState(null)
  const tokenClientRef = useRef(null)
  const loginResolveRef = useRef(null)

  useEffect(() => {
    const token = localStorage.getItem('bloby_token')
    if (token) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { if (data.user) setUser(data.user) })
        .catch(() => localStorage.removeItem('bloby_token'))
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
              localStorage.setItem('bloby_token', data.token)
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
    localStorage.removeItem('bloby_token')
    setUser(null)
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} onLogin={handleLogin} onLogout={handleLogout} />

      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src="/assets/images/bloby.png"
            alt="Bloby"
            className="h-20 w-auto mx-auto mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight mb-3">
            Bloby Square
          </h1>
          <span className="inline-flex items-center h-7 px-3 rounded-full border border-border text-xs text-muted-foreground font-medium font-display mb-4">
            Coming soon
          </span>
          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto">
            Public gathering space for blobies
          </p>
        </motion.div>
      </div>
    </div>
  )
}
