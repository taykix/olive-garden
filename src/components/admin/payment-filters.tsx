'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MONTHS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

export function PaymentFilters() {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const p = new URLSearchParams(params.toString())
    if (value && value !== 'all') {
      p.set(key, value)
    } else {
      p.delete(key)
    }
    router.push(`?${p.toString()}`)
  }

  function clearAll() {
    router.push('?')
  }

  const hasFilters = params.toString().length > 0

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Input
        placeholder="Daire no ara..."
        defaultValue={params.get('apartment') ?? ''}
        onChange={(e) => update('apartment', e.target.value)}
        className="w-36"
      />

      <Select
        value={params.get('month') ?? 'all'}
        onValueChange={(v) => update('month', v ?? '')}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Ay" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Aylar</SelectItem>
          {Object.entries(MONTHS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get('year') ?? 'all'}
        onValueChange={(v) => update('year', v ?? '')}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="Yıl" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Yıllar</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get('status') ?? 'all'}
        onValueChange={(v) => update('status', v ?? '')}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Durum" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm Durumlar</SelectItem>
          <SelectItem value="paid">Ödendi</SelectItem>
          <SelectItem value="unpaid">Ödenmedi</SelectItem>
          <SelectItem value="partial">Kısmi</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-gray-500">
          <X className="h-4 w-4" /> Temizle
        </Button>
      )}
    </div>
  )
}
