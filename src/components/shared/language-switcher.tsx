'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useTransition, useState, useRef, useEffect } from 'react'
import { Globe, Check, ChevronDown } from 'lucide-react'

const LOCALES = [
  { code: 'tr', flag: '🇹🇷' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'de', flag: '🇩🇪' },
  { code: 'fr', flag: '🇫🇷' },
  { code: 'ru', flag: '🇷🇺' },
] as const

export function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const locale = useLocale()
  const t = useTranslations('lang')
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LOCALES.find(l => l.code === locale) ?? LOCALES[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function switchLocale(next: string) {
    setOpen(false)
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  const triggerBase = light
    ? 'border-white/20 text-white hover:bg-white/10 bg-white/10'
    : 'border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={isPending}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${triggerBase} ${isPending ? 'opacity-50' : ''}`}
      >
        <Globe className="h-3.5 w-3.5 opacity-70" />
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{t(locale as 'tr' | 'en' | 'de' | 'fr' | 'ru')}</span>
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute right-0 mt-1.5 w-44 rounded-xl border shadow-lg overflow-hidden z-50 ${light ? 'bg-gray-900/95 border-white/10' : 'bg-white border-gray-200'}`}>
          {LOCALES.map(({ code, flag }) => {
            const isActive = code === locale
            return (
              <button
                key={code}
                onClick={() => switchLocale(code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? light ? 'bg-white/10 text-white' : 'bg-green-50 text-green-700'
                    : light ? 'text-white/80 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-base leading-none">{flag}</span>
                <span className="flex-1 text-left font-medium">{t(code as 'tr' | 'en' | 'de' | 'fr' | 'ru')}</span>
                {isActive && <Check className="h-3.5 w-3.5 opacity-70" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
