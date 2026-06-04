'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { useTransition } from 'react'

const LOCALES = [
  { code: 'tr', label: 'TR' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
] as const

export function LanguageSwitcher({ light = false }: { light?: boolean }) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function switchLocale(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  const activeClass = light
    ? 'bg-white/20 text-white font-semibold'
    : 'bg-green-700 text-white font-semibold'
  const inactiveClass = light
    ? 'text-white/60 hover:text-white hover:bg-white/10'
    : 'text-gray-500 hover:text-green-700 hover:bg-green-50'

  return (
    <div className={`flex items-center rounded-lg p-0.5 gap-0.5 ${light ? 'bg-white/10' : 'bg-gray-100'} ${isPending ? 'opacity-60' : ''}`}>
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={isPending}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${locale === code ? activeClass : inactiveClass}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
