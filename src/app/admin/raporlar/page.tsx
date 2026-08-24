import { BarChart3, PieChart, TrendingUp } from 'lucide-react'
import { ExpensePieChart, MonthlyBarChart } from './charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { CSVExportButton } from '@/components/admin/csv-export-button'
import { Income, Expense, BudgetItem } from '@/types'
import { BudgetPlan } from './budget-plan'
import { PrintButton } from './print-button'
import { getPeriod, getTreasuryRange, PERIODS, ACTIVE_PERIOD } from '@/lib/periods'
import { PeriodSelector } from '@/components/shared/period-selector'
import { getActivePlanPlannedMap } from '@/lib/reports-data'

export const dynamic = 'force-dynamic'

interface MonthlyRow {
  year: number
  month: number
  income: number
  expense: number
  balance: number
}

function buildMonthlyReport(incomeList: Income[], expenseList: Expense[]): MonthlyRow[] {
  const map = new Map<string, MonthlyRow>()

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
    .map((r) => ({ ...r, balance: r.income - r.expense }))
    .sort((a, b) => b.year - a.year || b.month - a.month)
}

export default async function RaporlarPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period = getPeriod(periodParam)
  const isActivePeriod = period.id === ACTIVE_PERIOD.id
  const periodOptions = PERIODS.map(p => ({ id: p.id, label: `${p.label} — ${p.active ? 'Aktif' : 'Arşiv'}` }))
  const { start: periodStart, end: periodEnd } = getTreasuryRange(period)

  const supabase = await createClient()

  const [incomeRes, expenseRes, budgetRes, plan2026] = await Promise.all([
    supabase.from('income').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('budget_items').select('*').order('sort_order'),
    getActivePlanPlannedMap(supabase),
  ])

  const allIncome: Income[] = incomeRes.data ?? []
  const allExpense: Expense[] = expenseRes.data ?? []
  const budgetItems: BudgetItem[] = budgetRes.data ?? []

  // Dönem aralığı [periodStart, periodEnd) — özet, aylık tablo ve grafikler bu döneme aittir
  const inPeriod = (d: string) => d >= periodStart && d < periodEnd
  const incomeList  = allIncome.filter(r => inPeriod(r.date))
  const expenseList = allExpense.filter(r => inPeriod(r.date))

  const monthlyReport = buildMonthlyReport(incomeList, expenseList)

  // Expense breakdown by category for pie chart
  const expenseCategoryMap = expenseList.reduce<Record<string, number>>((acc, e) => {
    const cat = e.category ?? 'Diğer'
    acc[cat] = (acc[cat] ?? 0) + Number(e.amount)
    return acc
  }, {})
  const pieData = Object.entries(expenseCategoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Last 12 months bar chart data
  const barData = [...monthlyReport]
    .slice(0, 12)
    .reverse()
    .map((r) => ({
      month: `${MONTHS[r.month]?.slice(0, 3)} ${r.year}`,
      Gelir: r.income,
      Gider: r.expense,
    }))
  const periodIncome  = incomeList.reduce((s, r) => s + Number(r.amount), 0)
  const periodExpense = expenseList.reduce((s, r) => s + Number(r.amount), 0)
  const carriedBalance = allIncome.filter(r => r.date < periodStart).reduce((s, r) => s + Number(r.amount), 0)
                       - allExpense.filter(r => r.date < periodStart).reduce((s, r) => s + Number(r.amount), 0)
  const balance = carriedBalance + periodIncome - periodExpense
  // Geriye dönük uyumluluk: aşağıdaki tablo/CSV başlıkları için
  const totalIncome = periodIncome
  const totalExpenses = periodExpense

  // CSV data prep
  const monthlyCSV = monthlyReport.map((r) => ({
    'Yıl': r.year,
    'Ay': MONTHS[r.month],
    'Gelir (₺)': r.income.toFixed(2),
    'Gider (₺)': r.expense.toFixed(2),
    'Bakiye (₺)': r.balance.toFixed(2),
  }))

  const incomeCSV = allIncome.map((i) => ({
    'Tarih': i.date,
    'Başlık': i.title,
    'Kategori': i.category ?? '',
    'Açıklama': i.description ?? '',
    'Tutar (₺)': Number(i.amount).toFixed(2),
  }))

  const expenseCSV = allExpense.map((e) => ({
    'Tarih': e.date,
    'Başlık': e.title,
    'Kategori': e.category ?? '',
    'Açıklama': e.description ?? '',
    'Tutar (₺)': Number(e.amount).toFixed(2),
    'Belge': e.document_url ?? '',
  }))

  return (
    <div className="space-y-8 print:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Raporlar
            <span className="ml-2 text-base font-normal text-gray-400">{period.label}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Finansal özet ve detay raporları</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector options={periodOptions} value={period.id} />
          <PrintButton />
        </div>
      </div>

      {!isActivePeriod && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 print:hidden">
          Arşiv dönemi görüntüleniyor ({period.label}). Finansal özet bu döneme aittir.
        </div>
      )}

      {/* Budget plan (İşletme Planı — tüm dönemler karşılaştırmalı) */}
      <BudgetPlan items={budgetItems} expenses={allExpense} plan2026={plan2026} />

      {/* Summary cards — seçili döneme ait */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Devreden Bakiye</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${carriedBalance >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>{formatCurrency(carriedBalance)}</p><p className="text-xs text-gray-400 mt-1">Geçen dönemden</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Dönem Geliri</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(periodIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Dönem Gideri</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(periodExpense)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Mevcut Bakiye</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(balance)}</p>
            <p className="text-xs text-gray-400 mt-1">Devir dahil</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ── */}
      <div className="grid lg:grid-cols-2 gap-6 print:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-green-600" /> Gider Kategorileri
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0
              ? <ExpensePieChart data={pieData} />
              : <p className="text-center text-gray-400 py-8 text-sm">Gider verisi yok</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" /> Aylık Gelir / Gider Trendi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0
              ? <MonthlyBarChart data={barData} />
              : <p className="text-center text-gray-400 py-8 text-sm">Veri yok</p>}
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
      <Card className="print:hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" /> Aylık Gelir / Gider Özeti
          </CardTitle>
          <CSVExportButton data={monthlyCSV} filename="aylik-rapor" label="Aylık CSV" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Yıl</TableHead>
                  <TableHead>Ay</TableHead>
                  <TableHead className="text-right">Gelir</TableHead>
                  <TableHead className="text-right">Gider</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 py-8">Veri yok</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {monthlyReport.map((row) => (
                      <TableRow key={`${row.year}-${row.month}`}>
                        <TableCell>{row.year}</TableCell>
                        <TableCell>{MONTHS[row.month]}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(row.income)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(row.expense)}</TableCell>
                        <TableCell className={`text-right font-semibold ${row.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {formatCurrency(row.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <TableCell colSpan={2} className="text-gray-700">Toplam</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(totalIncome)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(totalExpenses)}</TableCell>
                      <TableCell className={`text-right ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {formatCurrency(totalIncome - totalExpenses)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Export all */}
      <div className="flex flex-wrap gap-3 print:hidden">
        <p className="text-sm font-medium text-gray-600 self-center">Tüm Verileri İndir:</p>
        <CSVExportButton data={incomeCSV} filename="gelirler" label="Gelirler CSV" />
        <CSVExportButton data={expenseCSV} filename="giderler" label="Giderler CSV" />
      </div>
    </div>
  )
}
