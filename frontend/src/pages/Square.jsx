import { useRef, useEffect, useCallback } from 'react'

export default function BlobyWorld() {
  const containerRef = useRef(null)
  const drag = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })

  // Center the map on load + recenter on resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const img = el.querySelector('img')

    const centerMap = () => {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2
    }

    if (img.complete) {
      centerMap()
    } else {
      img.addEventListener('load', centerMap, { once: true })
    }

    window.addEventListener('resize', centerMap)
    return () => window.removeEventListener('resize', centerMap)
  }, [])

  // Mouse-only drag (desktop) — touch uses native scroll
  const onMouseDown = useCallback((e) => {
    const el = containerRef.current
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    }
    el.style.cursor = 'grabbing'
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!drag.current.active) return
    e.preventDefault()
    const el = containerRef.current
    el.scrollLeft = drag.current.scrollLeft - (e.clientX - drag.current.startX)
    el.scrollTop = drag.current.scrollTop - (e.clientY - drag.current.startY)
  }, [])

  const onMouseUp = useCallback(() => {
    drag.current.active = false
    const el = containerRef.current
    if (el) el.style.cursor = 'grab'
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  return (
    <div
      ref={containerRef}
      className="bloby-world"
      onMouseDown={onMouseDown}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'auto',
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'touch',
        cursor: 'grab',
        backgroundColor: '#0a2a2a',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        .bloby-world::-webkit-scrollbar { display: none; }
      `}</style>
      <img
        src="/assets/images/map.png"
        alt="Bloby World"
        draggable={false}
        style={{
          display: 'block',
          /* Always larger than viewport so there's room to pan */
          width: 'max(100vw, 177vh)',
          height: 'max(100vh, 56.25vw)',
          objectFit: 'cover',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
