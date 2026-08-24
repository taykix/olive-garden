import { BarChart3, PieChart, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { Income, Expense, BudgetItem } from '@/types'
import { BudgetPlan } from '@/app/admin/raporlar/budget-plan'
import { ExpensePieChart, MonthlyBarChart } from '@/app/admin/raporlar/charts'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPeriod, getTreasuryRange, PERIODS, ACTIVE_PERIOD } from '@/lib/periods'
import { PeriodSelector } from '@/components/shared/period-selector'
import { getActivePlanPlannedMap } from '@/lib/reports-data'

export const dynamic = 'force-dynamic'

function buildMonthlyReport(incomeList: Income[], expenseList: Expense[]) {
  const map = new Map<string, { year: number; month: number; income: number; expense: number; balance: number }>()
  for (const i of incomeList) {
    const d = new Date(i.date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const row = map.get(key) ?? { year: d.getFullYear(), month: d.getMonth() + 1, income: 0, expense: 0, balance: 0 }
    row.income += Number(i.amount)
    map.set(key, row)
  }
  for (const e of expenseList) {
    const d = new Date(e.date)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    const row = map.get(key) ?? { year: d.getFullYear(), month: d.getMonth() + 1, income: 0, expense: 0, balance: 0 }
    row.expense += Number(e.amount)
    map.set(key, row)
  }
  return [...map.values()]
    .map(r => ({ ...r, balance: r.income - r.expense }))
    .sort((a, b) => b.year - a.year || b.month - a.month)
}

export default async function ResidentRaporlarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { locale } = await params
  const { period: periodParam } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('raporlar')

  const period = getPeriod(periodParam)
  const isActivePeriod = period.id === ACTIVE_PERIOD.id
  const periodOptions = PERIODS.map(p => ({ id: p.id, label: `${p.label} — ${p.active ? t('period_active') : t('period_archive')}` }))
  const { start: periodStart, end: periodEnd } = getTreasuryRange(period)

  const supabase = await createClient()
  const [incomeRes, expenseRes, budgetRes, plan2026] = await Promise.all([
    supabase.from('income').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('budget_items').select('*').order('sort_order'),
    getActivePlanPlannedMap(supabase),
  ])

  const allIncome: Income[]    = incomeRes.data ?? []
  const allExpense: Expense[]  = expenseRes.data ?? []
  const budgetItems: BudgetItem[] = budgetRes.data ?? []

  const inPeriod = (d: string) => d >= periodStart && d < periodEnd
  const incomeList  = allIncome.filter(r => inPeriod(r.date))
  const expenseList = allExpense.filter(r => inPeriod(r.date))
  const monthlyReport = buildMonthlyReport(incomeList, expenseList)

  const expenseCategoryMap = expenseList.reduce<Record<string, number>>((acc, e) => {
    const cat = e.category ?? t('other_category')
    acc[cat] = (acc[cat] ?? 0) + Number(e.amount)
    return acc
  }, {})
  const pieData = Object.entries(expenseCategoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const barData = [...monthlyReport].slice(0, 12).reverse().map(r => ({
    month: `${getMonthName(r.month, locale, true)} ${r.year}`,
    Gelir: r.income,
    Gider: r.expense,
  }))

  const periodIncome   = incomeList.reduce((s, r) => s + Number(r.amount), 0)
  const periodExpense  = expenseList.reduce((s, r) => s + Number(r.amount), 0)
  const carriedBalance = allIncome.filter(r => r.date < periodStart).reduce((s, r) => s + Number(r.amount), 0)
                       - allExpense.filter(r => r.date < periodStart).reduce((s, r) => s + Number(r.amount), 0)
  const balance = carriedBalance + periodIncome - periodExpense
  const totalIncome   = periodIncome   // aylık tablo başlık/totalleri için
  const totalExpenses = periodExpense

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')}
            <span className="ml-2 text-base font-normal text-gray-400">{period.label}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
        </div>
        <PeriodSelector options={periodOptions} value={period.id} />
      </div>

      {!isActivePeriod && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {t('archive_notice', { period: period.label })}
        </div>
      )}

      <BudgetPlan items={budgetItems} expenses={allExpense} plan2026={plan2026} readOnly />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{t('carried_balance')}</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${carriedBalance >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>{formatCurrency(carriedBalance)}</p><p className="text-xs text-gray-400 mt-1">{t('carried_note')}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{t('period_income')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(periodIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{t('period_expense')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(periodExpense)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{t('current_balance')}</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(balance)}</p>
            <p className="text-xs text-gray-400 mt-1">{t('incl_carry')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieChart className="h-4 w-4 text-green-600" /> {t('pie_title')}</CardTitle></CardHeader>
          <CardContent>{pieData.length > 0 ? <ExpensePieChart data={pieData} /> : <p className="text-center text-gray-400 py-8 text-sm">{t('no_expense_data')}</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" /> {t('bar_title')}</CardTitle></CardHeader>
          <CardContent>{barData.length > 0 ? <MonthlyBarChart data={barData} /> : <p className="text-center text-gray-400 py-8 text-sm">{t('no_data')}</p>}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-500" /> {t('monthly_title')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col_year')}</TableHead>
                  <TableHead>{t('col_month')}</TableHead>
                  <TableHead className="text-right">{t('col_income')}</TableHead>
                  <TableHead className="text-right">{t('col_expense')}</TableHead>
                  <TableHead className="text-right">{t('col_balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyReport.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">{t('no_data')}</TableCell></TableRow>
                ) : (
                  <>
                    {monthlyReport.map(row => (
                      <TableRow key={`${row.year}-${row.month}`}>
                        <TableCell>{row.year}</TableCell>
                        <TableCell>{getMonthName(row.month, locale)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(row.income)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(row.expense)}</TableCell>
                        <TableCell className={`text-right font-semibold ${row.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(row.balance)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <TableCell colSpan={2} className="text-gray-700">{t('total')}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(totalIncome)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(totalExpenses)}</TableCell>
                      <TableCell className={`text-right ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(totalIncome - totalExpenses)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
