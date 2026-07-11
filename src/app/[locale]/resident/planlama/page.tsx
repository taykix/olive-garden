import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Plan, PlanItem } from '@/types'
import { ResidentPlanView } from './resident-plan-view'
import { Card, CardContent } from '@/components/ui/card'

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

  return <ResidentPlanView plan={plan} items={items} locale={locale} />
}
