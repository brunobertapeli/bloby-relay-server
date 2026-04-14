import { useRef, useEffect, useState } from 'react'

export default function BlobyWorld() {
  const containerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Center the map on load
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
  }, [])

  const handlePointerDown = (e) => {
    setIsDragging(true)
    const el = containerRef.current
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    }
    el.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    const el = containerRef.current
    el.scrollLeft = dragState.current.scrollLeft - dx
    el.scrollTop = dragState.current.scrollTop - dy
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  return (
    <div
      ref={containerRef}
      className="bloby-world"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: '#0a2a2a',
        touchAction: 'none',
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
          minWidth: '100vw',
          minHeight: '100vh',
          width: 'max(100vw, 177.8vh)',  /* maintain aspect ~16:9 */
          height: 'auto',
          objectFit: 'cover',
          userSelect: 'none',
        }}
      />
    </div>
  )
}
