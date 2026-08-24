'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { seedPeriodSettings } from '@/lib/supabase/actions'

interface Props {
  periodId: string
  periodLabel: string
}

// "Yeni Dönemi Başlat" — hedef dönem için daire aidat ayarlarını oluşturur ve
// bir önceki dönemin borç/alacak bakiyesini devreder. Idempotenttir: mevcut
// satırlar korunur, yalnızca eksik daireler eklenir.
export function SeedPeriodButton({ periodId, periodLabel }: Props) {
  const [loading, setLoading] = useState(false)

  async function run() {
    const ok = window.confirm(
      `${periodLabel} dönemi için daire aidat ayarları oluşturulacak ve önceki dönemin ` +
        `borç/alacak bakiyeleri devredilecek.\n\nMevcut satırlar korunur (yalnızca eksik daireler eklenir). Devam edilsin mi?`
    )
    if (!ok) return
    setLoading(true)
    const res = await seedPeriodSettings(periodId)
    setLoading(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`${res.created ?? 0} daire oluşturuldu · ${res.skipped ?? 0} mevcut kayıt korundu.`)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={run}
      disabled={loading}
      className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{loading ? 'Oluşturuluyor…' : 'Yeni Dönemi Başlat'}</span>
    </Button>
  )
}
