import { useRef, useEffect, useCallback, useState } from 'react'
import ZoneEditor from '../components/ZoneEditor'
import { WORLD_CONFIG } from '../config/world'

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
    pointer-events: none;
    transform: translate(-50%, -50%);
  }
`

// Pick random points inside painted zone cells
function generateBlobies(zoneData, count) {
  const allCells = []
  for (const [zoneName, zone] of Object.entries(zoneData.zones)) {
    for (let i = 0; i < zone.cells.length; i++) {
      if (zone.cells[i]) allCells.push({ zoneName, idx: i })
    }
  }
  if (allCells.length === 0) return []

  const blobies = []
  for (let i = 0; i < count; i++) {
    const cell = allCells[Math.floor(Math.random() * allCells.length)]
    const row = Math.floor(cell.idx / zoneData.gridCols)
    const col = cell.idx % zoneData.gridCols
    blobies.push({
      id: i,
      zone: cell.zoneName,
      // Normalized 0-1 with jitter within cell
      x: (col + Math.random()) / zoneData.gridCols,
      y: (row + Math.random()) / zoneData.gridRows,
    })
  }
  return blobies
}

export default function BlobyWorld() {
  const containerRef = useRef(null)
  const wrapperRef = useRef(null)
  const imgRef = useRef(null)
  const cam = useRef({ x: 0, y: 0, dragging: false, lastX: 0, lastY: 0, imgW: 0, imgH: 0, vw: 0, vh: 0 })
  const [editorMode, setEditorMode] = useState(false)
  const editorModeRef = useRef(false)
  const [blobies, setBlobies] = useState([])

  // Load zones and generate blobies
  useEffect(() => {
    fetch('/assets/zones.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setBlobies(generateBlobies(data, 30))
      })
      .catch(() => {})
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

  // Load + resize
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
          {blobies.map(b => (
            <div
              key={b.id}
              className="bloby-dot"
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
              }}
            />
          ))}
          {editorMode && <ZoneEditor cam={cam} />}
        </div>
      </div>
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
