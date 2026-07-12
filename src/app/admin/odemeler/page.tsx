import { AlertCircle, CheckCircle2, FileSpreadsheet, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, MONTHS, getMonthName } from '@/lib/utils'
import { PaymentForm } from '@/components/admin/payment-form'
import { PrintButton } from '@/app/admin/raporlar/print-button'
import { Payment, ApartmentSettings } from '@/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

// ─── Period definition (Oct 2025 – Aug 2026) ─────────────────────────────────

const PERIOD_MONTHS = [
  { month: 10, year: 2025 }, { month: 11, year: 2025 }, { month: 12, year: 2025 },
  { month: 1,  year: 2026 }, { month: 2,  year: 2026 }, { month: 3,  year: 2026 },
  { month: 4,  year: 2026 }, { month: 5,  year: 2026 }, { month: 6,  year: 2026 },
  { month: 7,  year: 2026 }, { month: 8,  year: 2026 },
]

// ─── Data helpers ─────────────────────────────────────────────────────────────

interface AptRow {
  apartment_no: string
  resident_name: string
  annual_due: number
  previous_balance: number
  monthPaid: Record<string, number>  // "2025-10" → amount
  total_paid: number
  remaining: number  // annual_due + previous_balance - total_paid
}

function buildTable(
  settings: ApartmentSettings[],
  payments: Pick<Payment, 'apartment_no' | 'resident_name' | 'month' | 'year' | 'amount_due' | 'amount_paid'>[]
): AptRow[] {
  // Index settings by apartment_no
  const settMap = new Map(settings.map(s => [s.apartment_no, s]))

  // Index payments by apartment_no
  const payMap = new Map<string, { resident_name: string; amount_due: number; monthPaid: Record<string, number>; total_paid: number }>()
  for (const p of payments) {
    const key = p.apartment_no
    if (!payMap.has(key)) {
      payMap.set(key, { resident_name: p.resident_name ?? '', amount_due: Number(p.amount_due), monthPaid: {}, total_paid: 0 })
    }
    const entry = payMap.get(key)!
    const monthKey = `${p.year}-${p.month}`
    entry.monthPaid[monthKey] = (entry.monthPaid[monthKey] ?? 0) + Number(p.amount_paid)
    entry.total_paid += Number(p.amount_paid)
    entry.amount_due = Math.max(entry.amount_due, Number(p.amount_due))
  }

  // Merge all known apartments (union of settings + payments)
  const allApts = new Set([...settMap.keys(), ...payMap.keys()])
  const rows: AptRow[] = []

  for (const apt of allApts) {
    const sett    = settMap.get(apt)
    const pay     = payMap.get(apt)
    const annual_due       = sett?.annual_due ?? pay?.amount_due ?? 40000
    const previous_balance = sett?.previous_balance ?? 0
    const total_paid       = pay?.total_paid ?? 0
    const remaining        = annual_due + previous_balance - total_paid

    rows.push({
      apartment_no:     apt,
      resident_name:    sett ? '' : (pay?.resident_name ?? ''),
      annual_due,
      previous_balance,
      monthPaid:        pay?.monthPaid ?? {},
      total_paid,
      remaining,
    })
  }

  return rows.sort((a, b) => a.apartment_no.localeCompare(b.apartment_no))
}

function fmt(n: number): string {
  if (n === 0) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OdemelerPage() {
  const supabase = await createClient()

  const [{ data: settingsData }, { data: paymentsData }] = await Promise.all([
    supabase.from('apartment_settings').select('*').order('apartment_no'),
    supabase.from('payments').select('apartment_no, resident_name, month, year, amount_due, amount_paid').order('apartment_no'),
  ])

  const table    = buildTable(settingsData ?? [], paymentsData ?? [])
  const unpaid   = table.filter(a => a.remaining > 0.01)
  const paid     = table.filter(a => a.remaining <= 0.01)
  const totalPaid      = table.reduce((s, a) => s + a.total_paid, 0)
  const totalRem       = table.reduce((s, a) => s + Math.max(0, a.remaining), 0)
  const totalOverpaid  = table.reduce((s, a) => s + Math.max(0, -a.remaining), 0)
  const totalAnnualDue = table.reduce((s, a) => s + a.annual_due, 0)
  const totalPrev      = table.reduce((s, a) => s + a.previous_balance, 0)
  const totalKalan     = table.reduce((s, a) => s + a.remaining, 0)
  const monthTotals    = Object.fromEntries(
    PERIOD_MONTHS.map(pm => {
      const key = `${pm.year}-${pm.month}`
      return [key, table.reduce((s, row) => s + (row.monthPaid[key] ?? 0), 0)]
    })
  )

  return (
    <div className="space-y-6 print:space-y-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aidat / Ödeme Takibi</h1>
          {table.length > 0 && (
            <p className="text-gray-500 text-sm mt-1">{table.length} daire</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {table.length > 0 && <PrintButton />}
          <Link href="/admin/odemeler/toplu">
            <Button variant="outline" size="sm" className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV'den Toplu Ekle</span>
            </Button>
          </Link>
          <PaymentForm />
        </div>
      </div>

      {/* Top stats */}
      {table.length > 0 && (
        <div className="grid grid-cols-3 gap-3 print:hidden">
          <Card className="border-red-100">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-gray-500">Alınacak (Kalan)</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <p className={`text-lg font-bold font-mono ${totalRem > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalRem > 0 ? formatCurrency(totalRem) : '✓ Tümü Ödendi'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-100">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-gray-500">Fazla Yapılan (Alacak)</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <p className={`text-lg font-bold font-mono ${totalOverpaid > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {totalOverpaid > 0 ? formatCurrency(totalOverpaid) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-green-100">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-gray-500">Bütçe (Toplam Ödenen)</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <p className="text-lg font-bold font-mono text-green-700">
                {formatCurrency(totalPaid)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary cards */}
      {table.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4 print:hidden">

          {/* Eksik ödemeler */}
          <Card className="border-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                Eksik / Kısmi Ödemeler ({unpaid.length} daire)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {unpaid.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-6 text-center">Tüm daireler tam ödeme yapmış.</p>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-red-50/60 border-b border-red-100">
                        <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Daire</th>
                        <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Sakin</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Ödenen</th>
                        <th className="text-right px-3 py-2 text-xs text-red-600 font-medium">Kalan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaid.map(a => (
                        <tr key={a.apartment_no} className="border-b border-gray-50 last:border-0 hover:bg-red-50/30 cursor-pointer">
                          <td className="px-3 py-2">
                            <Link href={`/admin/odemeler/${a.apartment_no}`} className="font-mono font-semibold text-green-700 hover:underline">
                              {a.apartment_no}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[140px]">{a.resident_name || '—'}</td>
                          <td className="px-3 py-2 text-right text-green-600 text-xs font-mono">{formatCurrency(a.total_paid)}</td>
                          <td className="px-3 py-2 text-right text-red-600 font-bold text-xs font-mono">{formatCurrency(a.remaining)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-red-100 bg-red-50/40">
                        <td colSpan={3} className="px-3 py-1.5 text-xs text-gray-500 font-medium">Toplam kalan</td>
                        <td className="px-3 py-1.5 text-right text-red-700 font-bold text-xs font-mono">
                          {formatCurrency(unpaid.reduce((s, a) => s + a.remaining, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tamamlayanlar */}
          <Card className="border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Tam Ödemeler ({paid.length} daire)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {paid.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-6 text-center">Henüz tam ödeme yapan daire yok.</p>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-green-50/60 border-b border-green-100">
                        <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Daire</th>
                        <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Sakin</th>
                        <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Ödenen</th>
                        <th className="text-right px-3 py-2 text-xs text-green-600 font-medium">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paid.map(a => (
                        <tr key={a.apartment_no} className="border-b border-gray-50 last:border-0 hover:bg-green-50/30">
                          <td className="px-3 py-2">
                            <Link href={`/admin/odemeler/${a.apartment_no}`} className="font-mono font-semibold text-green-700 hover:underline">
                              {a.apartment_no}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[140px]">{a.resident_name || '—'}</td>
                          <td className="px-3 py-2 text-right text-green-600 text-xs font-mono">{formatCurrency(a.total_paid)}</td>
                          <td className={`px-3 py-2 text-right text-xs font-medium ${a.remaining < -0.01 ? 'text-blue-600' : 'text-green-600'}`}>
                            {a.remaining < -0.01 ? `+${formatCurrency(Math.abs(a.remaining))} alacak` : '✓ Tam'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Wide table */}
      {table.length > 0 && (
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="pb-2 print:hidden">
            <CardTitle className="text-sm text-gray-700 print:text-[11px]">
              Tüm Daireler — Aylık Ödeme Tablosu
              <span className="font-normal text-gray-400"> / All Apartments — Monthly Payment Table</span>
              <span className="block text-xs font-normal text-gray-400 mt-0.5 print:hidden">(daire adına tıklayarak detay görüntüleyin / click an apartment name to view details)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <style>{'@media print{@page{size:A4 landscape;margin:4mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}#odeme-print{font-size:8px!important}#odeme-print td,#odeme-print th{padding-top:2px!important;padding-bottom:2px!important;padding-left:3px!important;padding-right:3px!important}}'}</style>
            <div className="overflow-x-auto print:overflow-visible">
              <table id="odeme-print" className="text-xs w-full min-w-max print:min-w-0">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 print:static bg-gray-50 z-10 text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap border-r border-gray-200">
                      Daire<span className="block text-[10px] font-normal text-gray-400">Apt.</span>
                    </th>
                    <th className="text-left px-2 py-2 font-medium text-gray-500 whitespace-nowrap print:hidden">
                      Sakin<span className="block text-[10px] font-normal text-gray-400">Resident</span>
                    </th>
                    <th className="text-right px-2 py-2 font-medium text-amber-600 whitespace-nowrap">
                      Geçen Yıl<span className="block text-[10px] font-normal text-amber-400">Last Year</span>
                    </th>
                    <th className="text-right px-2 py-2 font-medium text-gray-500 whitespace-nowrap">
                      Yıllık Aidat<span className="block text-[10px] font-normal text-gray-400">Annual Dues</span>
                    </th>
                    {PERIOD_MONTHS.map(pm => (
                      <th key={`${pm.year}-${pm.month}`} className="text-right px-2 py-2 font-medium text-gray-500 whitespace-nowrap">
                        {MONTHS[pm.month].slice(0, 3)}<span className="text-gray-300"> '{String(pm.year).slice(2)}</span>
                        <span className="block text-[10px] font-normal text-gray-400">{getMonthName(pm.month, 'en', true)}</span>
                      </th>
                    ))}
                    <th className="text-right px-2 py-2 font-medium text-green-600 whitespace-nowrap">
                      Toplam<span className="block text-[10px] font-normal text-green-500">Total</span>
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-red-500 whitespace-nowrap">
                      Kalan<span className="block text-[10px] font-normal text-red-400">Remaining</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row, i) => {
                    const isOdd = i % 2 === 1
                    const remainingColor = row.remaining > 0.01 ? 'text-red-600 font-bold'
                      : row.remaining < -0.01 ? 'text-blue-600 font-medium'
                      : 'text-green-600 font-medium'
                    const prevColor = row.previous_balance > 0 ? 'text-red-500'
                      : row.previous_balance < 0 ? 'text-blue-500'
                      : 'text-gray-300'
                    return (
                      <tr key={row.apartment_no} className={`border-b border-gray-100 ${isOdd ? 'bg-gray-50/40' : 'bg-white'} hover:bg-blue-50/30 transition-colors`}>
                        <td className={`sticky left-0 print:static z-10 border-r border-gray-100 px-3 py-1.5 ${isOdd ? 'bg-gray-50/80' : 'bg-white'}`}>
                          <Link href={`/admin/odemeler/${row.apartment_no}`} className="font-mono font-semibold text-green-700 hover:underline whitespace-nowrap">
                            {row.apartment_no}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap max-w-[160px] truncate print:hidden">{row.resident_name || '—'}</td>
                        <td className={`px-2 py-1.5 text-right font-mono whitespace-nowrap ${prevColor}`}>
                          {row.previous_balance === 0 ? '—' : `${row.previous_balance > 0 ? '+' : ''}${fmt(row.previous_balance)}`}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap text-gray-600">
                          {row.annual_due === 0 ? <span className="text-gray-300">muaf</span> : fmt(row.annual_due)}
                        </td>
                        {PERIOD_MONTHS.map(pm => {
                          const key = `${pm.year}-${pm.month}`
                          const amount = row.monthPaid[key] ?? 0
                          return (
                            <td key={key} className={`px-2 py-1.5 text-right font-mono whitespace-nowrap ${
                              amount > 0 ? 'text-green-700'
                              : amount < 0 ? 'text-red-800'
                              : 'text-gray-200'
                            }`}>
                              {amount !== 0 ? fmt(amount) : '—'}
                            </td>
                          )
                        })}
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap text-green-700 font-medium">
                          {fmt(row.total_paid)}
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${remainingColor}`}>
                          {row.remaining < -0.01
                            ? `+${fmt(Math.abs(row.remaining))}`
                            : row.remaining < 0.01 ? '✓'
                            : fmt(row.remaining)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                    <td className="sticky left-0 print:static bg-gray-100 z-10 border-r border-gray-200 px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                      TOPLAM<span className="block text-[10px] font-normal text-gray-400">Total</span>
                    </td>
                    <td className="px-2 py-2 print:hidden" />
                    <td className={`px-2 py-2 text-right font-mono text-xs whitespace-nowrap ${
                      totalPrev > 0 ? 'text-red-600'
                      : totalPrev < 0 ? 'text-blue-600'
                      : 'text-gray-300'
                    }`}>
                      {totalPrev === 0 ? '—' : `${totalPrev > 0 ? '+' : ''}${fmt(totalPrev)}`}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-gray-700 whitespace-nowrap">
                      {fmt(totalAnnualDue)}
                    </td>
                    {PERIOD_MONTHS.map(pm => {
                      const key = `${pm.year}-${pm.month}`
                      const total = monthTotals[key] ?? 0
                      return (
                        <td key={key} className={`px-2 py-2 text-right font-mono text-xs whitespace-nowrap ${
                          total > 0 ? 'text-green-700' : 'text-gray-300'
                        }`}>
                          {total !== 0 ? fmt(total) : '—'}
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-right font-mono text-xs text-green-700 whitespace-nowrap">
                      {fmt(totalPaid)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs font-bold whitespace-nowrap ${
                      totalKalan > 0.01 ? 'text-red-600'
                      : totalKalan < -0.01 ? 'text-blue-600'
                      : 'text-green-600'
                    }`}>
                      {totalKalan < -0.01
                        ? `+${fmt(Math.abs(totalKalan))}`
                        : fmt(totalKalan)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {table.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center text-gray-400">
            <FileSpreadsheet className="h-10 w-10 opacity-30" />
            <div>
              <p className="font-medium">Henüz ödeme kaydı yok</p>
              <p className="text-sm mt-1">CSV'den toplu ekle veya manuel kayıt oluştur.</p>
            </div>
            <div className="flex gap-2 mt-2">
              <Link href="/admin/odemeler/toplu">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV'den Toplu Ekle
                </Button>
              </Link>
              <PaymentForm />
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
