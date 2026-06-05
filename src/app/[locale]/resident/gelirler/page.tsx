import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Income } from '@/types'
import { IncomeTable } from '@/app/admin/gelirler/income-table'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export default async function ResidentGelirlerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('gelirler')

  const supabase = await createClient()
  const { data } = await supabase.from('income').select('*').order('date', { ascending: false })
  const incomeList: Income[] = data ?? []
  const total = incomeList.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('total_prefix')} {formatCurrency(total)}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            {t('records_title')} ({incomeList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {incomeList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">{t('empty')}</p>
          ) : (
            <IncomeTable data={incomeList} readOnly />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
