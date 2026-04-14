import { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import ZoneEditor from '../components/ZoneEditor'
import { WORLD_CONFIG } from '../config/world'
import { API_URL } from '../api'

const ZONE_LABELS = {
  casino: 'Casino',
  town_square: 'Town Square',
  marketplace: 'Marketplace',
  arena: 'Arena',
}

const POLL_INTERVAL = 30_000

const STYLES = `
  .bloby-world {
    position: fixed;
    inset: 0;
    overflow: hidden;
    cursor: grab;
    background-color: #0b3b36;
    touch-action: none;
  }
  .bloby-world.dragging { cursor: grabbing; }
  .bloby-world.editor-mode { cursor: crosshair; }
  .bloby-world.editor-mode.dragging { cursor: crosshair; }
  .bloby-world__wrapper {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }
  .bloby-world__map {
    display: block;
    user-select: none;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.4s ease;
    max-width: none;
    max-height: none;
  }
  .bloby-world__map.visible { opacity: 1; }

  .bloby-dot {
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #a855f7;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 12px rgba(168, 85, 247, 0.5);
    pointer-events: auto;
    transform: translate(-50%, -50%);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .bloby-dot:hover {
    transform: translate(-50%, -50%) scale(1.4);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6), 0 0 20px rgba(168, 85, 247, 0.7);
  }

  .bloby-dot__name {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 11px;
    font-weight: 600;
    font-family: 'Space Grotesk', sans-serif;
    color: #fff;
    background: rgba(0, 0, 0, 0.7);
    padding: 2px 8px;
    border-radius: 6px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .bloby-dot:hover .bloby-dot__name {
    opacity: 1;
  }

  .bloby-dot__count {
    position: absolute;
    top: -6px;
    right: -8px;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    background: #ef4444;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    font-family: 'Space Grotesk', sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    border: 1.5px solid #fff;
    pointer-events: none;
  }

  .bloby-card-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .bloby-card {
    position: relative;
    width: 280px;
    background: #fff;
    border-radius: 20px;
    padding: 28px 24px 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05);
    text-align: center;
    font-family: 'Space Grotesk', sans-serif;
    color: #1a1a1a;
    animation: bloby-card-in 0.25s ease;
  }
  @keyframes bloby-card-in {
    from { opacity: 0; transform: scale(0.9) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .bloby-card__close {
    position: absolute;
    top: 12px;
    right: 14px;
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
  }
  .bloby-card__close:hover { color: #333; }

  .bloby-card__avatar {
    height: 52px;
    width: auto;
    margin: 0 auto 16px;
    display: block;
  }

  .bloby-card__divider {
    height: 1px;
    background: #eee;
    margin: 16px 0;
  }

  .bloby-card__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
  }
  .bloby-card__label {
    color: #888;
    font-weight: 500;
  }
  .bloby-card__value {
    color: #1a1a1a;
    font-weight: 600;
  }

  .bloby-card__name {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 2px;
    letter-spacing: -0.3px;
  }

  .bloby-card__zone-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: #a855f7;
    background: #f3e8ff;
    padding: 3px 10px;
    border-radius: 20px;
    margin-top: 4px;
  }
  .bloby-card__zone-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #a855f7;
  }

  .bloby-card__items-btn {
    display: block;
    width: 100%;
    margin-top: 16px;
    padding: 10px 0;
    border: none;
    border-radius: 12px;
    background: #a855f7;
    color: #fff;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    letter-spacing: 0.2px;
    text-align: center;
    text-decoration: none;
  }
  .bloby-card__items-btn:hover {
    background: #9333ea;
  }

  .bloby-items {
    position: relative;
    width: 320px;
    max-height: 80vh;
    overflow-y: auto;
    background: #fff;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05);
    font-family: 'Space Grotesk', sans-serif;
    color: #1a1a1a;
    animation: bloby-card-in 0.25s ease;
  }
  .bloby-items__header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .bloby-items__back {
    background: none;
    border: 1px solid #eee;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #666;
    font-size: 16px;
    flex-shrink: 0;
  }
  .bloby-items__back:hover { border-color: #ccc; color: #333; }
  .bloby-items__title {
    font-size: 16px;
    font-weight: 700;
    margin: 0;
  }
  .bloby-items__close {
    position: absolute;
    top: 12px;
    right: 14px;
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
  }
  .bloby-items__close:hover { color: #333; }
  .bloby-items__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bloby-items__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid #f0f0f0;
    border-radius: 12px;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .bloby-items__item:hover {
    border-color: #e0d4fc;
    box-shadow: 0 2px 12px rgba(168, 85, 247, 0.08);
  }
  .bloby-items__item-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
    color: #a855f7;
    background: #f3e8ff;
  }
  .bloby-items__item-info {
    flex: 1;
    min-width: 0;
  }
  .bloby-items__item-name {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bloby-items__item-type {
    font-size: 11px;
    color: #999;
  }
  .bloby-items__item-price {
    font-size: 13px;
    font-weight: 600;
    color: #a855f7;
    flex-shrink: 0;
  }
  .bloby-items__empty {
    text-align: center;
    color: #999;
    font-size: 13px;
    padding: 30px 0;
  }
  .bloby-items__loading {
    text-align: center;
    color: #999;
    font-size: 13px;
    padding: 30px 0;
  }

  .bloby-stack-list {
    position: relative;
    width: 280px;
    max-height: 70vh;
    overflow-y: auto;
    background: #fff;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05);
    font-family: 'Space Grotesk', sans-serif;
    color: #1a1a1a;
    animation: bloby-card-in 0.25s ease;
  }
  .bloby-stack-list__title {
    font-size: 14px;
    font-weight: 700;
    margin: 0 0 12px;
    color: #1a1a1a;
  }
  .bloby-stack-list__close {
    position: absolute;
    top: 12px;
    right: 14px;
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
  }
  .bloby-stack-list__close:hover { color: #333; }
  .bloby-stack-list__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .bloby-stack-list__item:hover {
    background: #f9f5ff;
  }
  .bloby-stack-list__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #a855f7;
    border: 1.5px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    flex-shrink: 0;
  }
  .bloby-stack-list__name {
    font-size: 13px;
    font-weight: 600;
    flex: 1;
  }
  .bloby-stack-list__zone {
    font-size: 11px;
    color: #999;
    flex-shrink: 0;
  }
`

// ─── Assign positions from zone data ─────────────────────────────────────────

function assignPositions(blobies, zoneData) {
  if (!zoneData) return []

  // Build lookup: zone -> list of active cell indices
  const zoneCells = {}
  for (const [zoneName, zone] of Object.entries(zoneData.zones)) {
    const cells = []
    for (let i = 0; i < zone.cells.length; i++) {
      if (zone.cells[i]) cells.push(i)
    }
    zoneCells[zoneName] = cells
  }

  // Seed a deterministic-ish random per username so dots don't jump on polls
  const seededRandom = (seed) => {
    let h = 0
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h + seed.charCodeAt(i)) | 0
    }
    return () => {
      h = (h * 1664525 + 1013904223) | 0
      return (h >>> 0) / 4294967296
    }
  }

  return blobies
    .map(b => {
      const cells = zoneCells[b.zone]
      if (!cells || cells.length === 0) return null

      const rng = seededRandom(b.username + b.zone)
      const cellIdx = cells[Math.floor(rng() * cells.length)]
      const row = Math.floor(cellIdx / zoneData.gridCols)
      const col = cellIdx % zoneData.gridCols

      return {
        username: b.username,
        zone: b.zone,
        isOnline: b.isOnline,
        x: (col + rng()) / zoneData.gridCols,
        y: (row + rng()) / zoneData.gridRows,
      }
    })
    .filter(Boolean)
}

// ─── Cluster nearby dots ─────────────────────────────────────────────────────

function clusterDots(dots, threshold = 0.012) {
  const clusters = []
  const used = new Set()

  for (let i = 0; i < dots.length; i++) {
    if (used.has(i)) continue
    const cluster = [dots[i]]
    used.add(i)

    for (let j = i + 1; j < dots.length; j++) {
      if (used.has(j)) continue
      const dx = dots[i].x - dots[j].x
      const dy = dots[i].y - dots[j].y
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        cluster.push(dots[j])
        used.add(j)
      }
    }

    // Average position for cluster center
    const cx = cluster.reduce((s, d) => s + d.x, 0) / cluster.length
    const cy = cluster.reduce((s, d) => s + d.y, 0) / cluster.length

    clusters.push({
      id: `${i}`,
      x: cx,
      y: cy,
      blobies: cluster,
      count: cluster.length,
    })
  }

  return clusters
}

// ─── Stack list (multiple blobies on same spot) ──────────────────────────────

function StackList({ cluster, onClose, onSelect }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="bloby-card-overlay" onClick={onClose}>
      <div className="bloby-stack-list" onClick={e => e.stopPropagation()}>
        <button className="bloby-stack-list__close" onClick={onClose}>&times;</button>
        <h3 className="bloby-stack-list__title">
          {cluster.count} blobies here
        </h3>
        {cluster.blobies.map((b, i) => (
          <div
            key={i}
            className="bloby-stack-list__item"
            onClick={() => onSelect(b)}
          >
            <span className="bloby-stack-list__dot" />
            <span className="bloby-stack-list__name">{b.username}</span>
            <span className="bloby-stack-list__zone">{ZONE_LABELS[b.zone] || b.zone}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}

// ─── Bloby card ──────────────────────────────────────────────────────────────

const TYPE_LABELS = { skill: 'Skill', bundle: 'Bundle', blueprint: 'Blueprint', service: 'Service' }

function BlobyCard({ bloby, onClose }) {
  const [showItems, setShowItems] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const openItems = useCallback(() => {
    setShowItems(true)
    if (items.length > 0) return
    setLoading(true)
    fetch(`${API_URL}/api/marketplace/products`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        const all = [
          ...(data.skills || []).map(s => ({ name: s.name, type: 'skill', price: s.price, bloby: s.bloby })),
          ...(data.bundles || []).map(b => ({ name: b.name, type: 'bundle', price: b.price, bloby: b.bloby })),
          ...(data.blueprints || []).map(b => ({ name: b.name, type: 'blueprint', price: b.price, bloby: b.bloby })),
          ...(data.services || []).map(s => ({ name: s.name, type: 'service', price: s.price, bloby: s.bloby })),
        ]
        const mine = all.filter(i => i.bloby?.toLowerCase() === bloby.username.toLowerCase())
        setItems(mine)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [bloby.username, items.length])

  return createPortal(
    <div className="bloby-card-overlay" onClick={onClose}>
      {!showItems ? (
        <div className="bloby-card" onClick={e => e.stopPropagation()}>
          <button className="bloby-card__close" onClick={onClose}>&times;</button>

          <img
            className="bloby-card__avatar"
            src="/assets/images/bloby.png"
            alt={bloby.username}
          />

          <h3 className="bloby-card__name">{bloby.username}</h3>

          <div className="bloby-card__zone-badge">
            <span className="bloby-card__zone-dot" />
            {ZONE_LABELS[bloby.zone] || bloby.zone}
          </div>

          <div className="bloby-card__divider" />

          <div className="bloby-card__row">
            <span className="bloby-card__label">Now visiting</span>
            <span className="bloby-card__value">{ZONE_LABELS[bloby.zone] || bloby.zone}</span>
          </div>
          <div className="bloby-card__row">
            <span className="bloby-card__label">Status</span>
            <span className="bloby-card__value" style={{ color: bloby.isOnline ? '#22c55e' : '#999' }}>
              {bloby.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <button className="bloby-card__items-btn" onClick={openItems}>
            View Items for Sale
          </button>
        </div>
      ) : (
        <div className="bloby-items" onClick={e => e.stopPropagation()}>
          <button className="bloby-items__close" onClick={onClose}>&times;</button>

          <div className="bloby-items__header">
            <button className="bloby-items__back" onClick={() => setShowItems(false)}>
              &larr;
            </button>
            <h3 className="bloby-items__title">{bloby.username}&apos;s Shop</h3>
          </div>

          {loading && <div className="bloby-items__loading">Loading...</div>}

          {!loading && items.length === 0 && (
            <div className="bloby-items__empty">No items for sale</div>
          )}

          {!loading && items.length > 0 && (
            <div className="bloby-items__list">
              {items.map((item, i) => (
                <a
                  key={i}
                  className="bloby-items__item"
                  href={`/marketplace?search=${encodeURIComponent(item.name)}`}
                >
                  <div className="bloby-items__item-icon">
                    {item.name.charAt(0)}
                  </div>
                  <div className="bloby-items__item-info">
                    <div className="bloby-items__item-name">{item.name}</div>
                    <div className="bloby-items__item-type">{TYPE_LABELS[item.type] || item.type}</div>
                  </div>
                  <div className="bloby-items__item-price">
                    {item.price === 0 ? 'Free' : `$${item.price}`}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BlobyWorld() {
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)
  const imgRef = useRef(null)
  const cam = useRef({ x: 0, y: 0, dragging: false, lastX: 0, lastY: 0, imgW: 0, imgH: 0, vw: 0, vh: 0 })
  const [editorMode, setEditorMode] = useState(false)
  const editorModeRef = useRef(false)
  const [clusters, setClusters] = useState([])
  const [selectedBloby, setSelectedBloby] = useState(null)
  const [selectedCluster, setSelectedCluster] = useState(null)
  const zoneDataRef = useRef(null)

  // Load zone data + presence, then poll
  useEffect(() => {
    let timer = null

    const fetchPresence = async () => {
      try {
        // Load zone data once
        if (!zoneDataRef.current) {
          const zRes = await fetch('/assets/zones.json')
          if (zRes.ok) zoneDataRef.current = await zRes.json()
        }

        const res = await fetch(`${API_URL}/api/world/presence`)
        if (!res.ok) return
        const { blobies } = await res.json()

        const dots = assignPositions(blobies, zoneDataRef.current)
        setClusters(clusterDots(dots))
      } catch {}
    }

    fetchPresence()
    timer = setInterval(fetchPresence, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  // Keep ref in sync with state
  useEffect(() => {
    editorModeRef.current = editorMode
    const el = containerRef.current
    if (editorMode) {
      el.classList.add('editor-mode')
    } else {
      el.classList.remove('editor-mode')
    }
  }, [editorMode])

  // Toggle editor with E key (only if enabled in config)
  useEffect(() => {
    if (!WORLD_CONFIG.zoneEditorEnabled) return
    const onKey = (e) => {
      if (e.key === 'e' || e.key === 'E') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
        setEditorMode(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const applyCamera = useCallback(() => {
    const c = cam.current
    c.x = Math.max(c.vw - c.imgW, Math.min(0, c.x))
    c.y = Math.max(c.vh - c.imgH, Math.min(0, c.y))
    wrapperRef.current.style.transform = `translate3d(${c.x}px,${c.y}px,0)`
  }, [])

  const layout = useCallback(() => {
    const img = imgRef.current
    if (!img?.naturalWidth) return

    const c = cam.current
    const imgRatio = img.naturalWidth / img.naturalHeight
    c.vw = window.innerWidth
    c.vh = window.innerHeight

    const isMobile = c.vw < 768
    const scale = isMobile ? 1.15 : 1.4
    let w, h
    if (c.vw / c.vh > imgRatio) {
      w = c.vw * scale
      h = w / imgRatio
    } else {
      h = c.vh * scale
      w = h * imgRatio
    }
    if (w < c.vw) { w = c.vw; h = w / imgRatio }
    if (h < c.vh) { h = c.vh; w = h * imgRatio }

    c.imgW = w
    c.imgH = h
    img.style.width = w + 'px'
    img.style.height = h + 'px'
    wrapperRef.current.style.width = w + 'px'
    wrapperRef.current.style.height = h + 'px'

    c.x = (c.vw - w) / 2
    c.y = (c.vh - h) / 2
    applyCamera()

    img.classList.add('visible')
  }, [applyCamera])

  useEffect(() => {
    const img = imgRef.current
    const onLoad = () => layout()
    if (img.naturalWidth > 0) layout()
    img.addEventListener('load', onLoad)
    window.addEventListener('resize', layout)
    return () => {
      img.removeEventListener('load', onLoad)
      window.removeEventListener('resize', layout)
    }
  }, [layout])

  // Touch drag — disabled in editor mode
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const c = cam.current

    const onStart = (e) => {
      if (editorModeRef.current) return
      e.preventDefault()
      c.dragging = true
      c.lastX = e.touches[0].clientX
      c.lastY = e.touches[0].clientY
      el.classList.add('dragging')
    }
    const onMove = (e) => {
      if (editorModeRef.current) return
      if (!c.dragging) return
      e.preventDefault()
      const t = e.touches[0]
      c.x += t.clientX - c.lastX
      c.y += t.clientY - c.lastY
      c.lastX = t.clientX
      c.lastY = t.clientY
      applyCamera()
    }
    const onEnd = () => {
      c.dragging = false
      el.classList.remove('dragging')
    }

    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [applyCamera])

  // Mouse drag — disabled in editor mode
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const c = cam.current

    const onDown = (e) => {
      if (editorModeRef.current) return
      c.dragging = true
      c.lastX = e.clientX
      c.lastY = e.clientY
      el.classList.add('dragging')

      const onMove = (ev) => {
        c.x += ev.clientX - c.lastX
        c.y += ev.clientY - c.lastY
        c.lastX = ev.clientX
        c.lastY = ev.clientY
        applyCamera()
      }
      const onUp = () => {
        c.dragging = false
        el.classList.remove('dragging')
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    el.addEventListener('mousedown', onDown)
    return () => el.removeEventListener('mousedown', onDown)
  }, [applyCamera])

  const handleDotClick = useCallback((e, cluster) => {
    e.stopPropagation()
    if (cluster.count === 1) {
      setSelectedBloby(cluster.blobies[0])
    } else {
      setSelectedCluster(cluster)
    }
  }, [])

  return (
    <>
      <style>{STYLES}</style>
      <div ref={containerRef} className="bloby-world">
        <div ref={wrapperRef} className="bloby-world__wrapper">
          <img
            ref={imgRef}
            className="bloby-world__map"
            src="/assets/images/map.png"
            alt="Bloby World"
            draggable={false}
          />
          {clusters.map(c => (
            <div
              key={c.id}
              className="bloby-dot"
              style={{
                left: `${c.x * 100}%`,
                top: `${c.y * 100}%`,
              }}
              onClick={(e) => handleDotClick(e, c)}
            >
              <span className="bloby-dot__name">
                {c.count === 1 ? c.blobies[0].username : `${c.count} blobies`}
              </span>
              {c.count > 1 && (
                <span className="bloby-dot__count">{c.count}</span>
              )}
            </div>
          ))}
          {editorMode && <ZoneEditor cam={cam} />}
        </div>
      </div>

      {selectedCluster && (
        <StackList
          cluster={selectedCluster}
          onClose={() => setSelectedCluster(null)}
          onSelect={(b) => { setSelectedCluster(null); setSelectedBloby(b) }}
        />
      )}

      {selectedBloby && (
        <BlobyCard bloby={selectedBloby} onClose={() => setSelectedBloby(null)} />
      )}

      {editorMode && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, color: '#fff', fontSize: 12, opacity: 0.6,
          background: '#000', padding: '4px 12px', borderRadius: 8,
        }}>
          EDITOR MODE — press E to exit
        </div>
      )}
    </>
  )
}
