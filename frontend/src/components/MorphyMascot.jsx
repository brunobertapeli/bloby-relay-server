import { useEffect, useRef } from 'react'

// MorphyMascot — config-driven sprite mascot that sits in the navbar at rest
// and teleports to the user's mouse when the page is scrolled past the header.
//
// The mascot is rendered to a fixed full-viewport canvas (pointer-events:none)
// so it can fly between the navbar anchor and the mouse without disturbing
// layout. The navbar reserves space with an empty placeholder div that has
// `data-morphy-anchor` — we resolve its center via getBoundingClientRect each
// frame so the anchor follows reflows naturally.
//
// State machine (driven by clips in /morphy/teleporting.json):
//   header-idle      → held at clips.idle.from, drawn at anchor
//   travel-to-mouse  → clips.enter forward → clips.active pingpong while
//                      position interpolates from anchor → mouse → clips.exit
//                      forward → settles into follow-mouse
//   follow-mouse     → held at clips.idle.from, drawn at mouse position
//   travel-to-header → same enter/active/exit sequence, reversed endpoints
//
// To swap the animation later, drop a new {png,json} pair into /public/morphy/
// and point CONFIG_URL at it. No other changes needed.

const CONFIG_URL = '/morphy/teleporting.json'
const ASSETS_DIR = '/morphy/'

// Display size of the mascot (matches the old navbar logo height).
const DISPLAY_H = 35
// Pixels per millisecond — keeps travel duration roughly constant regardless
// of how far the mouse is from the anchor.
const TRAVEL_PX_PER_MS = 0.9
const TRAVEL_MIN_MS = 380
const TRAVEL_MAX_MS = 900
// Scroll threshold (px). Above this we sit in the header; below we travel.
const SCROLL_THRESHOLD = 20
// Mascot sits down-and-right of the cursor (like a Mac cursor companion).
// These offset the sprite's top-left from the cursor tip in pixels.
const MOUSE_OFFSET_X = 12
const MOUSE_OFFSET_Y = 12

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export default function MorphyMascot() {
  const canvasRef = useRef(null)

  useEffect(() => {
    // Skip on touch-only devices — no mouse means no follow target, and the
    // navbar already shows the static placeholder.
    const isTouchOnly = window.matchMedia('(hover: none)').matches
    if (isTouchOnly) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    let W = window.innerWidth
    let H = window.innerHeight

    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    // ── Animation config (filled in after fetch) ──
    let cfg = null
    let sprite = null
    let displayW = DISPLAY_H // updated once we know the aspect ratio

    // ── Mascot state ──
    // phase: 'header-idle' | 'enter-out' | 'travel' | 'exit-in' | 'follow-mouse'
    let phase = 'header-idle'
    let currentFrame = 19
    let pingPong = 1
    let lastFrameTime = 0

    // Position interpolation
    let posX = 0
    let posY = 0
    let travelFromX = 0
    let travelFromY = 0
    let travelToX = 0
    let travelToY = 0
    let travelStart = 0
    let travelDuration = 0

    // Mouse + scroll state
    const mouse = { x: W / 2, y: H / 2, has: false }
    const onMouseMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.has = true
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    // ── Anchor lookup (navbar placeholder) ──
    const anchorPos = () => {
      const el = document.querySelector('[data-morphy-anchor]')
      if (!el) return { x: 24, y: 32 } // safe fallback
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }

    // Sprite *center* position so its top-left lands down-right of the cursor.
    const mouseTarget = () => ({
      x: mouse.x + MOUSE_OFFSET_X + displayW / 2,
      y: mouse.y + MOUSE_OFFSET_Y + DISPLAY_H / 2,
    })

    // ── Trip endpoints ──
    // Each teleport is a trip with a tripFrom (where we're leaving from) and a
    // tripTo (where we're heading). Both are looked up *live* each frame via
    // positionFor, so all three phases (melt, travel, reform) chase the cursor
    // when relevant — not just the travel phase.
    let tripFrom = 'header' // 'header' | 'mouse'
    let tripTo = 'header'
    let pendingFinal = 'header-idle'

    const positionFor = (where) => {
      if (where === 'mouse' && mouse.has) return mouseTarget()
      return anchorPos()
    }

    const startTrip = (toWhere) => {
      // Snapshot the current settled location as the leaving point. Mid-trip
      // re-entries are guarded out below, so we only hit this from a static
      // phase in practice.
      if (phase === 'header-idle') tripFrom = 'header'
      else if (phase === 'follow-mouse') tripFrom = 'mouse'
      tripTo = toWhere
      pendingFinal = toWhere === 'mouse' ? 'follow-mouse' : 'header-idle'
      phase = 'enter-out'
      currentFrame = cfg.clips.enter.from
      lastFrameTime = performance.now()
    }

    const triggerTeleportToMouse = () => {
      if (!cfg) return
      if (phase === 'follow-mouse') return
      if (pendingFinal === 'follow-mouse') return // already heading there
      startTrip('mouse')
    }

    const triggerTeleportToHeader = () => {
      if (!cfg) return
      if (phase === 'header-idle') return
      if (pendingFinal === 'header-idle') return
      startTrip('header')
    }

    const onScroll = () => {
      if (!cfg) return
      const scrolled = window.scrollY > SCROLL_THRESHOLD
      if (scrolled) triggerTeleportToMouse()
      else triggerTeleportToHeader()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // ── Loop ──
    let raf = 0
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (!cfg || !sprite) return

      // Frame timing — uses per-clip fps if present, else cfg.fps
      const clipFps = (() => {
        if (phase === 'enter-out') return cfg.clips.enter.fps ?? cfg.fps
        if (phase === 'travel') return cfg.clips.active.fps ?? cfg.fps
        if (phase === 'exit-in') return cfg.clips.exit.fps ?? cfg.fps
        return cfg.fps
      })()
      const frameInterval = 1000 / clipFps
      const advance = now - lastFrameTime >= frameInterval
      if (advance) lastFrameTime = now - ((now - lastFrameTime) % frameInterval)

      // ── Position (live-tracked in every phase) ─────────────────────
      // melt: sits at leaving endpoint
      // travel: lerp from snapshot-of-melt-end to live destination
      // reform: sits at arriving endpoint
      // settled phases: track their respective endpoint
      if (phase === 'enter-out') {
        const p = positionFor(tripFrom)
        posX = p.x
        posY = p.y
      } else if (phase === 'travel') {
        // Destination chases live; from-point was snapshotted at travel start.
        const tgt = positionFor(tripTo)
        travelToX = tgt.x
        travelToY = tgt.y
        const t = Math.min(1, (now - travelStart) / travelDuration)
        const e = easeInOutCubic(t)
        posX = travelFromX + (travelToX - travelFromX) * e
        posY = travelFromY + (travelToY - travelFromY) * e
      } else if (phase === 'exit-in') {
        const p = positionFor(tripTo)
        posX = p.x
        posY = p.y
      } else if (phase === 'header-idle') {
        const a = anchorPos()
        posX = a.x
        posY = a.y
      } else if (phase === 'follow-mouse') {
        if (mouse.has) {
          const tgt = mouseTarget()
          posX = tgt.x
          posY = tgt.y
        }
      }

      // ── Frame advancement + phase transitions ──────────────────────
      if (phase === 'enter-out' && advance) {
        currentFrame++
        if (currentFrame > cfg.clips.enter.to) {
          // Snapshot the final melt position as the travel's starting point so
          // the lerp begins from where the mascot visibly is, even if the
          // leaving endpoint (e.g. mouse) drifted during melt.
          travelFromX = posX
          travelFromY = posY
          const tgt = positionFor(tripTo)
          travelToX = tgt.x
          travelToY = tgt.y
          const dx = travelToX - travelFromX
          const dy = travelToY - travelFromY
          const dist = Math.sqrt(dx * dx + dy * dy)
          travelDuration = Math.min(
            TRAVEL_MAX_MS,
            Math.max(TRAVEL_MIN_MS, dist / TRAVEL_PX_PER_MS),
          )
          travelStart = now
          phase = 'travel'
          currentFrame = cfg.clips.active.from
          pingPong = 1
        }
      } else if (phase === 'travel') {
        if (advance) {
          currentFrame += pingPong
          if (currentFrame >= cfg.clips.active.to) {
            currentFrame = cfg.clips.active.to
            pingPong = -1
          } else if (currentFrame <= cfg.clips.active.from) {
            currentFrame = cfg.clips.active.from
            pingPong = 1
          }
        }
        const t = Math.min(1, (now - travelStart) / travelDuration)
        if (t >= 1) {
          phase = 'exit-in'
          currentFrame = cfg.clips.exit.from
        }
      } else if (phase === 'exit-in' && advance) {
        currentFrame++
        if (currentFrame > cfg.clips.exit.to) {
          phase = pendingFinal
          currentFrame = cfg.clips.idle.from
        }
      }

      // Draw
      ctx.clearRect(0, 0, W, H)
      const col = currentFrame % cfg.grid.cols
      const row = Math.floor(currentFrame / cfg.grid.cols)
      const fw = cfg.frame.w
      const fh = cfg.frame.h
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(
        sprite,
        col * fw, row * fh, fw, fh,
        Math.round(posX - displayW / 2),
        Math.round(posY - DISPLAY_H / 2),
        displayW,
        DISPLAY_H,
      )
    }

    // ── Boot: load config + sprite, then start loop ──
    fetch(CONFIG_URL)
      .then((r) => {
        if (!r.ok) throw new Error('morphy config ' + r.status)
        return r.json()
      })
      .then((c) => {
        cfg = c
        displayW = Math.round(DISPLAY_H * (cfg.frame.w / cfg.frame.h))
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => { sprite = img; resolve() }
          img.onerror = reject
          img.src = ASSETS_DIR + cfg.spritesheet
        })
      })
      .then(() => {
        currentFrame = cfg.clips.idle.from
        const a = anchorPos()
        posX = a.x
        posY = a.y
        phase = window.scrollY > SCROLL_THRESHOLD ? 'follow-mouse' : 'header-idle'
        lastFrameTime = performance.now()
        raf = requestAnimationFrame(loop)
      })
      .catch((err) => {
        console.error('[MorphyMascot] failed to load:', err)
      })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 60, // above navbar (z-50) so the mascot draws over its anchor
      }}
    />
  )
}
