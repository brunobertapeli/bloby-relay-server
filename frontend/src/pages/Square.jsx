import { useRef, useEffect, useCallback } from 'react'

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
  .bloby-world__map {
    display: block;
    user-select: none;
    pointer-events: none;
    will-change: transform;
    opacity: 0;
    transition: opacity 0.4s ease;
    max-width: none;
    max-height: none;
  }
  .bloby-world__map.visible { opacity: 1; }
`

export default function BlobyWorld() {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const cam = useRef({ x: 0, y: 0, dragging: false, lastX: 0, lastY: 0, imgW: 0, imgH: 0, vw: 0, vh: 0 })

  const applyCamera = useCallback(() => {
    const c = cam.current
    // Clamp so edges never show
    c.x = Math.max(c.vw - c.imgW, Math.min(0, c.x))
    c.y = Math.max(c.vh - c.imgH, Math.min(0, c.y))
    imgRef.current.style.transform = `translate3d(${c.x}px,${c.y}px,0)`
  }, [])

  const layout = useCallback(() => {
    const img = imgRef.current
    console.log('[world] layout called', {
      imgExists: !!img,
      naturalWidth: img?.naturalWidth,
      naturalHeight: img?.naturalHeight,
      complete: img?.complete,
    })
    if (!img?.naturalWidth) {
      console.log('[world] layout SKIPPED — naturalWidth is 0')
      return
    }

    const c = cam.current
    const imgRatio = img.naturalWidth / img.naturalHeight
    c.vw = window.innerWidth
    c.vh = window.innerHeight

    // Cover viewport + extra room to pan
    // Less extra on mobile so the map feels reachable
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
    // Safety: never smaller than viewport
    if (w < c.vw) { w = c.vw; h = w / imgRatio }
    if (h < c.vh) { h = c.vh; w = h * imgRatio }

    c.imgW = w
    c.imgH = h
    img.style.width = w + 'px'
    img.style.height = h + 'px'

    // Center camera
    c.x = (c.vw - w) / 2
    c.y = (c.vh - h) / 2
    applyCamera()

    img.classList.add('visible')
    console.log('[world] layout DONE', { w, h, x: c.x, y: c.y, vw: c.vw, vh: c.vh, imgRatio })
  }, [applyCamera])

  // Load + resize
  useEffect(() => {
    const img = imgRef.current
    console.log('[world] effect mount', {
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      src: img.src,
    })

    const onLoad = () => {
      console.log('[world] load event fired', { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
      layout()
    }

    // Try immediately (cached image)
    if (img.naturalWidth > 0) {
      console.log('[world] image already loaded, calling layout')
      layout()
    }
    // Also listen for load (not-yet-loaded or mobile timing)
    img.addEventListener('load', onLoad)
    window.addEventListener('resize', layout)
    return () => {
      console.log('[world] effect cleanup')
      img.removeEventListener('load', onLoad)
      window.removeEventListener('resize', layout)
    }
  }, [layout])

  // Touch drag (native listeners, passive: false)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const c = cam.current

    const onStart = (e) => {
      e.preventDefault()
      c.dragging = true
      c.lastX = e.touches[0].clientX
      c.lastY = e.touches[0].clientY
      el.classList.add('dragging')
    }
    const onMove = (e) => {
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

  // Mouse drag
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const c = cam.current

    const onDown = (e) => {
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
        <img
          ref={imgRef}
          className="bloby-world__map"
          src="/assets/images/map.png"
          alt="Bloby World"
          draggable={false}
        />
      </div>
    </>
  )
}
