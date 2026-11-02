import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Plan, PlanItem } from '@/types'
import { ResidentPlanView } from './resident-plan-view'
import { Card, CardContent } from '@/components/ui/card'
import { ACTIVE_PERIOD, PERIODS } from '@/lib/periods'

export const dynamic = 'force-dynamic'

export default async function ResidentPlanlamaPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('plan')
  const supabase = await createClient()

  const { data: plans, error } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false })

  const plan = !error && (plans ?? []).length > 0 ? (plans![0] as Plan) : null

  let items: PlanItem[] = []
  if (plan) {
    const { data } = await supabase
      .from('plan_items')
      .select('*')
      .eq('plan_id', plan.id)
      .order('sort_order', { ascending: true })
    items = (data ?? []) as PlanItem[]
  }

  // Genel kurulda belirlenen aidat → gerçek aidat geliri (muaf/yarım aidatlı birimler dahil).
  // Planlanan giderlerden artan tutar havuz ve çatı tamirine ayrılır.
  let dues: { total: number; full: number; shares: number } | null = null
  if (plan) {
    const periodId = PERIODS.find(p => p.id === `p${plan.period}`)?.id ?? ACTIVE_PERIOD.id
    const { data: sett } = await supabase.from('apartment_settings').select('annual_due').eq('period_id', periodId)
    const amounts = (sett ?? []).map(s => Number(s.annual_due) || 0)
    const total = amounts.reduce((a, b) => a + b, 0)
    const full = amounts.length ? Math.max(...amounts) : 0
    if (total > 0 && full > 0) dues = { total, full, shares: total / full }
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <Card>
          <CardContent className="py-12 text-center text-gray-400">{t('empty')}</CardContent>
        </Card>
      </div>
    )
  }

  return <ResidentPlanView plan={plan} items={items} locale={locale} dues={dues} />
}
