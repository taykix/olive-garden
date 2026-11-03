'use client'

import { useEffect, useRef, useState } from 'react'

// Ana sayfa arka plan videosu: sessiz, döngülü, otomatik oynar.
// Altındaki fotoğraf yedek olarak kalır: video yüklenemezse, kullanıcı "hareketi azalt"
// tercihini açtıysa veya veri tasarrufu modundaysa fotoğraf görünür.
export function HeroVideo({ poster }: { poster: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (reduce || saveData) return
    // React SSR 'muted' özniteliğini HTML'e yazmaz; iOS otomatik oynatma için elle ayarlanır.
    v.muted = true
    v.play().then(() => setShow(true)).catch(() => {})
  }, [])

  return (
    <video
      ref={ref}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${show ? 'opacity-100' : 'opacity-0'}`}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src="/videos/hero.mp4" type="video/mp4" />
    </video>
  )
}
