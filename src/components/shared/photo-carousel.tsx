'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Slide = { src: string; alt: string }

export function PhotoCarousel({
  slides,
  caption,
  interval = 5000,
}: {
  slides: Slide[]
  caption?: string
  /** Otomatik geçiş süresi (ms). 0 = kapalı. */
  interval?: number
}) {
  const [index, setIndex] = useState(0)
  const count = slides.length

  const go = (dir: number) => setIndex((i) => (i + dir + count) % count)

  // Otomatik geçiş — her el değişiminden sonra sayaç sıfırlanır
  useEffect(() => {
    if (interval <= 0 || count <= 1) return
    const id = setTimeout(() => setIndex((i) => (i + 1) % count), interval)
    return () => clearTimeout(id)
  }, [index, interval, count])

  return (
    <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl select-none bg-black">
      {/* Slaytlar (crossfade) */}
      {slides.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          sizes="(min-width: 1024px) 460px, 100vw"
          priority={i === 0}
          className={`object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

      {caption && (
        <div className="absolute bottom-4 left-4 z-10">
          <span className="text-white text-sm bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full">
            {caption}
          </span>
        </div>
      )}

      {count > 1 && (
        <>
          {/* Sol / Sağ oklar */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Önceki fotoğraf"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Sonraki fotoğraf"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md backdrop-blur-sm transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Noktalar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}. fotoğrafa git`}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
