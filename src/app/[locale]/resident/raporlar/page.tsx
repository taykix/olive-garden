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
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('raporlar')

  const supabase = await createClient()
  const [incomeRes, expenseRes, budgetRes] = await Promise.all([
    supabase.from('income').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('budget_items').select('*').order('sort_order'),
  ])

  const incomeList: Income[]    = incomeRes.data ?? []
  const expenseList: Expense[]  = expenseRes.data ?? []
  const budgetItems: BudgetItem[] = budgetRes.data ?? []
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

  const totalIncome   = incomeList.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = expenseList.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
      </div>

      <BudgetPlan items={budgetItems} expenses={expenseList} readOnly />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{t('total_income')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{t('total_expenses')}</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">{t('net_balance')}</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(totalIncome - totalExpenses)}
            </p>
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
