'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CalendarRange } from 'lucide-react'

interface Props {
  options: { id: string; label: string }[]
  value: string
}

// Dönem seçici — ?period= parametresini değiştirerek aktif/arşiv dönem arasında geçiş yapar.
// Etiketler (Aktif/Arşiv, i18n) sunucu tarafında üretilip options olarak geçilir.
export function PeriodSelector({ options, value }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  if (options.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5">
      <CalendarRange className="h-4 w-4 text-gray-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/30"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
