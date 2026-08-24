import { ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { ApartmentDuesForm } from '@/components/admin/apartment-dues-form'
import { PaymentForm } from '@/components/admin/payment-form'
import { Payment, ApartmentSettings } from '@/types'
import { getPeriod, PERIODS, ACTIVE_PERIOD, duesStatus } from '@/lib/periods'
import { PeriodSelector } from '@/components/shared/period-selector'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  if (n === 0) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

export default async function ApartmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ apt: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { apt } = await params
  const { period: periodParam } = await searchParams
  const period = getPeriod(periodParam)
  const PERIOD_MONTHS = period.months
  const isActivePeriod = period.id === ACTIVE_PERIOD.id
  const periodOptions = PERIODS.map(p => ({
    id: p.id,
    label: `${p.label} — ${p.active ? 'Aktif' : 'Arşiv'}`,
  }))
  const apartment_no = decodeURIComponent(apt)
  const supabase = await createClient()

  const [{ data: settingsData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from('apartment_settings')
      .select('*')
      .eq('apartment_no', apartment_no)
      .eq('period_id', period.id)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('*')
      .eq('apartment_no', apartment_no)
      .order('year', { ascending: true })
      .order('month', { ascending: true }),
  ])

  const settings  = settingsData as ApartmentSettings | null
  const allPayments = (paymentsData ?? []) as Payment[]
  // Seçili döneme ait ödemeler (açık period_id ile)
  const payments = allPayments.filter(p => p.period_id === period.id)

  if (!settings && allPayments.length === 0) notFound()

  const annual_due        = settings?.annual_due ?? 40000
  const previous_balance  = settings?.previous_balance ?? 0
  const total_paid        = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const st                = duesStatus(annual_due, previous_balance, total_paid, period)
  const expectedToDate    = st.expected + previous_balance  // bugüne kadar tahakkuk eden toplam
  const remaining         = st.overdue                      // güncel kalan (taksite göre)
  const residentName      = allPayments.find(p => p.resident_name)?.resident_name ?? null

  // Aggregate payments by month for the period table
  const monthData: Record<string, { amount: number; notes: string[] }> = {}
  for (const p of payments) {
    const key = `${p.year}-${p.month}`
    if (!monthData[key]) monthData[key] = { amount: 0, notes: [] }
    monthData[key].amount += Number(p.amount_paid)
    if (p.note) monthData[key].notes.push(p.note)
  }

  const remainingColor = st.behind
    ? 'text-red-600'
    : st.credit ? 'text-blue-600'
    : 'text-green-600'

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/odemeler" className="flex items-center gap-1 hover:text-green-700 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Aidat Takibi
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-700">{apartment_no}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Home className="h-6 w-6 text-green-600" />
            Daire {apartment_no}
          </h1>
          {residentName && (
            <p className="text-gray-500 text-sm mt-1">{residentName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <PeriodSelector options={periodOptions} value={period.id} />
          <ApartmentDuesForm apartment_no={apartment_no} settings={settings} periodId={period.id} />
          <PaymentForm defaultApartmentNo={apartment_no} />
        </div>
      </div>

      {!isActivePeriod && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Arşiv dönemi görüntüleniyor ({period.label}).
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Yıllık Aidat</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {annual_due === 0
              ? <p className="text-sm font-semibold text-gray-400">Muaf</p>
              : <p className="text-sm font-bold text-gray-800 font-mono">{formatCurrency(annual_due)}</p>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Geçen Yıl</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {previous_balance === 0 ? (
              <p className="text-sm font-semibold text-gray-400">—</p>
            ) : (
              <p className={`text-sm font-bold font-mono ${previous_balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {previous_balance > 0 ? '+' : ''}{formatCurrency(previous_balance)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {previous_balance > 0 ? 'borç' : previous_balance < 0 ? 'alacak' : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Bugüne Kadar Beklenen</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-sm font-bold text-gray-800 font-mono">
              {formatCurrency(expectedToDate)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">taksit takvimine göre</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Ödenen</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-sm font-bold text-green-700 font-mono">{formatCurrency(total_paid)}</p>
          </CardContent>
        </Card>

        <Card className={`col-span-2 sm:col-span-1 ${st.behind ? 'border-red-200' : st.credit ? 'border-blue-200' : 'border-green-200'}`}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500">Güncel Kalan</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className={`text-sm font-bold font-mono ${remainingColor}`}>
              {st.behind
                ? fmt(st.overdue)
                : st.credit ? `+${fmt(-st.yearRemaining)} alacak`
                : st.yearRemaining > 0.01 ? '✓ Güncel' : '✓ Tam'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period payment table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-700">
            Dönem Ödemeleri
            <span className="text-xs font-normal text-gray-400 ml-2">{period.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-36">Ay</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-36">Ödenen (₺)</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Not</th>
              </tr>
            </thead>
            <tbody>
              {PERIOD_MONTHS.map((pm, i) => {
                const key   = `${pm.year}-${pm.month}`
                const entry = monthData[key]
                const isOdd = i % 2 === 1
                return (
                  <tr key={key} className={`border-b border-gray-100 last:border-0 ${isOdd ? 'bg-gray-50/40' : 'bg-white'}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                      {MONTHS[pm.month]} {pm.year}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${entry ? 'text-green-700 font-semibold' : 'text-gray-300'}`}>
                      {entry ? fmt(entry.amount) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {entry?.notes.join(' · ') ?? ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-600">Toplam</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">{fmt(total_paid)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Raw payment records — full history, for editing */}
      {allPayments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-700">Tüm Kayıtlar <span className="text-xs font-normal text-gray-400">(tüm dönemler)</span></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-max">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Ay / Yıl</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Ödenen</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Durum</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Tarih</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Not</th>
                    <th className="px-4 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p, i) => (
                    <tr key={p.id} className={`border-b border-gray-100 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'}`}>
                      <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap">
                        {MONTHS[p.month]} {p.year}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-green-700 whitespace-nowrap">
                        {formatCurrency(Number(p.amount_paid))}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          p.payment_status === 'paid'    ? 'bg-green-100 text-green-700' :
                          p.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {p.payment_status === 'paid' ? 'Ödendi' : p.payment_status === 'partial' ? 'Kısmi' : 'Ödenmedi'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                        {p.payment_date ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs max-w-[200px] truncate">
                        {p.note ?? ''}
                      </td>
                      <td className="px-4 py-2">
                        <PaymentForm payment={p} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
