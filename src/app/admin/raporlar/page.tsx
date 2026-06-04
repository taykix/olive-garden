import { BarChart3, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, MONTHS, PAYMENT_STATUS_LABELS } from '@/lib/utils'
import { CSVExportButton } from '@/components/admin/csv-export-button'
import { Income, Expense, Payment } from '@/types'

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

export default async function RaporlarPage() {
  const supabase = await createClient()

  const [incomeRes, expenseRes, paymentsRes] = await Promise.all([
    supabase.from('income').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('date', { ascending: false }),
    supabase.from('payments').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
  ])

  const incomeList: Income[] = incomeRes.data ?? []
  const expenseList: Expense[] = expenseRes.data ?? []
  const paymentList: Payment[] = paymentsRes.data ?? []

  const monthlyReport = buildMonthlyReport(incomeList, expenseList)
  const unpaidPayments = paymentList.filter((p) => p.payment_status !== 'paid')

  const totalIncome = incomeList.reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = expenseList.reduce((s, r) => s + Number(r.amount), 0)

  // CSV data prep
  const monthlyCSV = monthlyReport.map((r) => ({
    'Yıl': r.year,
    'Ay': MONTHS[r.month],
    'Gelir (₺)': r.income.toFixed(2),
    'Gider (₺)': r.expense.toFixed(2),
    'Bakiye (₺)': r.balance.toFixed(2),
  }))

  const unpaidCSV = unpaidPayments.map((p) => ({
    'Daire No': p.apartment_no,
    'Sakin': p.resident_name ?? '',
    'Ay': MONTHS[p.month],
    'Yıl': p.year,
    'Borç (₺)': Number(p.amount_due).toFixed(2),
    'Ödenen (₺)': Number(p.amount_paid).toFixed(2),
    'Durum': PAYMENT_STATUS_LABELS[p.payment_status],
  }))

  const incomeCSV = incomeList.map((i) => ({
    'Tarih': i.date,
    'Başlık': i.title,
    'Kategori': i.category ?? '',
    'Açıklama': i.description ?? '',
    'Tutar (₺)': Number(i.amount).toFixed(2),
  }))

  const expenseCSV = expenseList.map((e) => ({
    'Tarih': e.date,
    'Başlık': e.title,
    'Kategori': e.category ?? '',
    'Açıklama': e.description ?? '',
    'Tutar (₺)': Number(e.amount).toFixed(2),
    'Belge': e.document_url ?? '',
  }))

  return (
    <div className="space-y-8 print:space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raporlar</h1>
          <p className="text-gray-500 text-sm mt-1">Finansal özet ve detay raporları</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md text-gray-600 hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" /> Yazdır
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Toplam Gelir</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Toplam Gider</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Net Bakiye</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(totalIncome - totalExpenses)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
      <Card>
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
                  monthlyReport.map((row) => (
                    <TableRow key={`${row.year}-${row.month}`}>
                      <TableCell>{row.year}</TableCell>
                      <TableCell>{MONTHS[row.month]}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(row.income)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(row.expense)}</TableCell>
                      <TableCell className={`text-right font-semibold ${row.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {formatCurrency(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Unpaid payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ödenmemiş / Eksik Ödemeler ({unpaidPayments.length})</CardTitle>
          <CSVExportButton data={unpaidCSV} filename="odenmemis-odemeler" label="CSV İndir" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Daire</TableHead>
                  <TableHead>Sakin</TableHead>
                  <TableHead>Dönem</TableHead>
                  <TableHead className="text-right">Borç</TableHead>
                  <TableHead className="text-right">Ödenen</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-8">Tüm ödemeler tamamlanmış.</TableCell>
                  </TableRow>
                ) : (
                  unpaidPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.apartment_no}</TableCell>
                      <TableCell className="text-sm text-gray-600">{p.resident_name || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{MONTHS[p.month]} {p.year}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(p.amount_due))}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-green-600">{formatCurrency(Number(p.amount_paid))}</TableCell>
                      <TableCell>
                        <Badge variant={p.payment_status === 'partial' ? 'secondary' : 'destructive'} className="text-xs">
                          {PAYMENT_STATUS_LABELS[p.payment_status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
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
