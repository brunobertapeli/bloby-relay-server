import { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

const GRID_COLS = 131
const GRID_ROWS = 82

const ZONES = [
  { id: 'casino', label: 'Casino', color: '#FFD700' },
  { id: 'town_square', label: 'Town Square', color: '#4CAF50' },
  { id: 'marketplace', label: 'Marketplace', color: '#2196F3' },
  { id: 'arena', label: 'Arena', color: '#F44336' },
]

function createEmptyData() {
  const cells = () => new Array(GRID_COLS * GRID_ROWS).fill(0)
  return {
    version: 1,
    gridCols: GRID_COLS,
    gridRows: GRID_ROWS,
    naturalWidth: 2612,
    naturalHeight: 1632,
    zones: Object.fromEntries(
      ZONES.map(z => [z.id, { color: z.color, cells: cells() }])
    ),
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('bloby_zones')
    if (raw) {
      const data = JSON.parse(raw)
      if (data.version === 1 && data.gridCols === GRID_COLS) return data
    }
  } catch {}
  return createEmptyData()
}

export default function ZoneEditor({ cam }) {
  const canvasRef = useRef(null)
  const zoneDataRef = useRef(loadFromStorage())
  const paintingRef = useRef(false)
  const saveTimerRef = useRef(null)

  const [activeZone, setActiveZone] = useState('casino')
  const [brushSize, setBrushSize] = useState(1)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !cam.current.imgW) return

    const w = cam.current.imgW
    const h = cam.current.imgH
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)

    const cellW = w / GRID_COLS
    const cellH = h / GRID_ROWS
    const data = zoneDataRef.current

    for (const [, zone] of Object.entries(data.zones)) {
      ctx.fillStyle = zone.color + '66' // 40% alpha
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (zone.cells[r * GRID_COLS + c]) {
            ctx.fillRect(c * cellW, r * cellH, cellW, cellH)
          }
        }
      }
    }
  }, [cam])

  // Initial draw + resize
  useEffect(() => {
    redraw()
    const onResize = () => requestAnimationFrame(redraw)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [redraw])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem('bloby_zones', JSON.stringify(zoneDataRef.current))
    }, 500)
  }, [])

  const paintAt = useCallback((clientX, clientY) => {
    const c = cam.current
    if (!c.imgW) return

    // Screen coords -> image-local coords
    const imgX = clientX - c.x
    const imgY = clientY - c.y

    // Normalized 0-1
    const normX = imgX / c.imgW
    const normY = imgY / c.imgH

    // Grid coords
    const col = Math.floor(normX * GRID_COLS)
    const row = Math.floor(normY * GRID_ROWS)

    const data = zoneDataRef.current
    const r = brushSize - 1

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const gc = col + dx
        const gr = row + dy
        if (gc < 0 || gc >= GRID_COLS || gr < 0 || gr >= GRID_ROWS) continue
        const idx = gr * GRID_COLS + gc

        if (activeZone) {
          // Clear from other zones, set in active
          for (const z of Object.values(data.zones)) {
            z.cells[idx] = 0
          }
          data.zones[activeZone].cells[idx] = 1
        } else {
          // Eraser
          for (const z of Object.values(data.zones)) {
            z.cells[idx] = 0
          }
        }
      }
    }

    redraw()
    scheduleSave()
  }, [cam, activeZone, brushSize, redraw, scheduleSave])

  // Mouse drawing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onDown = (e) => {
      e.stopPropagation()
      paintingRef.current = true
      paintAt(e.clientX, e.clientY)
    }
    const onMove = (e) => {
      if (!paintingRef.current) return
      paintAt(e.clientX, e.clientY)
    }
    const onUp = () => { paintingRef.current = false }

    canvas.addEventListener('mousedown', onDown)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [paintAt])

  // Touch drawing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onStart = (e) => {
      e.preventDefault()
      e.stopPropagation()
      paintingRef.current = true
      paintAt(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onMove = (e) => {
      if (!paintingRef.current) return
      e.preventDefault()
      paintAt(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onEnd = (e) => {
      e.preventDefault()
      paintingRef.current = false
    }

    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd, { passive: false })
    canvas.addEventListener('touchcancel', onEnd, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
      canvas.removeEventListener('touchcancel', onEnd)
    }
  }, [paintAt])

  const saveToFile = () => {
    const json = JSON.stringify(zoneDataRef.current, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zones.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadFromFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (data.version === 1 && data.gridCols === GRID_COLS) {
          zoneDataRef.current = data
          localStorage.setItem('bloby_zones', JSON.stringify(data))
          redraw()
        }
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const clearAll = () => {
    zoneDataRef.current = createEmptyData()
    localStorage.removeItem('bloby_zones')
    redraw()
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
        }}
      />

      {/* Toolbar — portal to body so CSS transform doesn't break fixed positioning */}
      {createPortal(<div style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(10,10,10,0.95)',
        padding: '8px 16px',
        borderRadius: 12,
        border: '1px solid #333',
        backdropFilter: 'blur(8px)',
      }}>
        {ZONES.map(z => (
          <button
            key={z.id}
            onClick={() => setActiveZone(z.id)}
            title={z.label}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: z.color,
              border: activeZone === z.id ? '3px solid #fff' : '2px solid #555',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        ))}

        <div style={{ width: 1, height: 24, background: '#333', flexShrink: 0 }} />

        <button
          onClick={() => setActiveZone(null)}
          title="Eraser"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: activeZone === null ? '#666' : '#333',
            border: activeZone === null ? '3px solid #fff' : '2px solid #555',
            cursor: 'pointer',
            color: '#fff',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          x
        </button>

        <div style={{ width: 1, height: 24, background: '#333', flexShrink: 0 }} />

        <label style={{ color: '#999', fontSize: 11, whiteSpace: 'nowrap' }}>
          Brush
          <input
            type="range"
            min={1}
            max={8}
            value={brushSize}
            onChange={e => setBrushSize(+e.target.value)}
            style={{ width: 60, marginLeft: 4, verticalAlign: 'middle' }}
          />
        </label>

        <div style={{ width: 1, height: 24, background: '#333', flexShrink: 0 }} />

        <button onClick={saveToFile} style={btnStyle}>Save</button>

        <label style={{ ...btnStyle, cursor: 'pointer' }}>
          Load
          <input type="file" accept=".json" onChange={loadFromFile} hidden />
        </label>

        <button onClick={clearAll} style={{ ...btnStyle, color: '#F44336' }}>Clear</button>
      </div>, document.body)}
    </>
  )
}

const btnStyle = {
  background: 'none',
  border: '1px solid #555',
  color: '#ccc',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
