import { TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Expense, BudgetItem } from '@/types'
import { ExpenseTable } from '@/app/admin/giderler/expense-table'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export default async function ResidentGiderlerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('giderler')

  const supabase = await createClient()
  const [{ data }, { data: budgetData }] = await Promise.all([
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('budget_items').select('*').order('sort_order'),
  ])
  const expenseList: Expense[]    = data ?? []
  const budgetItems: BudgetItem[] = budgetData ?? []
  const total = expenseList.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('total_prefix')} {formatCurrency(total)}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            {t('records_title')} ({expenseList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenseList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">{t('empty')}</p>
          ) : (
            <ExpenseTable data={expenseList} budgetItems={budgetItems} readOnly />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
