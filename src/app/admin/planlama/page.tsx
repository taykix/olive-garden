import { createClient } from '@/lib/supabase/server'
import { Plan, PlanItem } from '@/types'
import { PlanningTable } from './planning-table'
import { AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlanlamaPage() {
  const supabase = await createClient()

  const { data: plans, error } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false })

  // Tablolar henüz oluşturulmadıysa (migration çalıştırılmadıysa) uyar
  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Planlama</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Planlama tabloları henüz oluşturulmamış.</p>
            <p className="mt-1">
              Bu özelliği kullanmadan önce <code className="bg-amber-100 px-1 rounded">supabase/planning.sql</code>{' '}
              dosyasını Supabase SQL editöründe bir kez çalıştırın.
            </p>
            <p className="mt-1 text-xs text-amber-600">Hata: {error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  const plan = ((plans ?? [])[0] as Plan | undefined) ?? null
  let items: PlanItem[] = []
  if (plan) {
    const { data } = await supabase
      .from('plan_items')
      .select('*')
      .eq('plan_id', plan.id)
      .order('sort_order', { ascending: true })
    items = (data ?? []) as PlanItem[]
  }

  return <PlanningTable plan={plan} items={items} />
}
