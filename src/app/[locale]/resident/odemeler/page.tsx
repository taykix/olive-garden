import { createClient } from '@/lib/supabase/server'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { Payment, ApartmentSettings } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPeriod, PERIODS, ACTIVE_PERIOD, duesStatus, expectedDueToDate, currentInstallment } from '@/lib/periods'
import { PeriodSelector } from '@/components/shared/period-selector'

export const dynamic = 'force-dynamic'

function fmt(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

interface AptRow {
  apartment_no: string
  resident_name: string
  annual_due: number
  previous_balance: number
  monthPaid: Record<string, number>
  total_paid: number
  overdue: number
  yearRemaining: number
  behind: boolean
  credit: boolean
}

export default async function ResidentOdemelerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { locale } = await params
  const { period: periodParam } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('odemeler')

  const period = getPeriod(periodParam)
  const PERIOD_MONTHS = period.months
  const isActivePeriod = period.id === ACTIVE_PERIOD.id
  const periodOptions = PERIODS.map(p => ({
    id: p.id,
    label: `${p.label} — ${p.active ? t('period_active') : t('period_archive')}`,
  }))

  const supabase = await createClient()

  const [{ data: settingsData }, { data: paymentsData }] = await Promise.all([
    supabase.from('apartment_settings').select('*').eq('period_id', period.id).order('apartment_no'),
    supabase.from('payments').select('apartment_no, resident_name, month, year, amount_due, amount_paid').eq('period_id', period.id).order('apartment_no'),
  ])

  const settings: ApartmentSettings[] = settingsData ?? []
  const payments: Pick<Payment, 'apartment_no' | 'resident_name' | 'month' | 'year' | 'amount_due' | 'amount_paid'>[] = paymentsData ?? []

  const settMap = new Map(settings.map(s => [s.apartment_no, s]))
  const payMap = new Map<string, { resident_name: string; amount_due: number; monthPaid: Record<string, number>; total_paid: number }>()

  for (const p of payments) {
    if (!payMap.has(p.apartment_no)) {
      payMap.set(p.apartment_no, { resident_name: p.resident_name ?? '', amount_due: Number(p.amount_due), monthPaid: {}, total_paid: 0 })
    }
    const entry = payMap.get(p.apartment_no)!
    const key = `${p.year}-${p.month}`
    entry.monthPaid[key] = (entry.monthPaid[key] ?? 0) + Number(p.amount_paid)
    entry.total_paid += Number(p.amount_paid)
  }

  const allApts = new Set([...settMap.keys(), ...payMap.keys()])
  const table: AptRow[] = [...allApts].sort().map(apt => {
    const sett = settMap.get(apt)
    const pay  = payMap.get(apt)
    const annual_due = sett?.annual_due ?? pay?.amount_due ?? 40000
    const previous_balance = sett?.previous_balance ?? 0
    const total_paid = pay?.total_paid ?? 0
    const st = duesStatus(annual_due, previous_balance, total_paid, period)
    return {
      apartment_no: apt,
      resident_name: sett ? '' : (pay?.resident_name ?? ''),
      annual_due,
      previous_balance,
      monthPaid: pay?.monthPaid ?? {},
      total_paid,
      overdue: st.overdue,
      yearRemaining: st.yearRemaining,
      behind: st.behind,
      credit: st.credit,
    }
  })

  const totalAnnualDue = table.reduce((s, a) => s + a.annual_due, 0)
  const totalPaid      = table.reduce((s, a) => s + a.total_paid, 0)
  const totalPrev      = table.reduce((s, a) => s + a.previous_balance, 0)
  const totalOverdueNet = table.reduce((s, a) => s + a.overdue, 0)
  const totalYearRem    = table.reduce((s, a) => s + a.yearRemaining, 0)
  const MONTH_ABBR     = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  const fullDue        = table.length ? Math.max(...table.map(a => a.annual_due)) : 50000
  const scheduleLabel  = (period.installments ?? [])
    .map(it => `${MONTH_ABBR[it.month]} ${fmt(Math.round(it.fraction * fullDue))}`)
    .join(' · ')
  const expectedFull   = expectedDueToDate(fullDue, period)
  const curInst        = currentInstallment(period)
  const curInstLabel   = curInst ? getMonthName(curInst.month, locale) : ''
  const monthTotals    = Object.fromEntries(
    PERIOD_MONTHS.map(pm => {
      const key = `${pm.year}-${pm.month}`
      return [key, table.reduce((s, row) => s + (row.monthPaid[key] ?? 0), 0)]
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')}
            <span className="ml-2 text-base font-normal text-gray-400">{period.label}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">{table.length} {t('apartments_suffix')}</p>
        </div>
        <PeriodSelector options={periodOptions} value={period.id} />
      </div>

      {!isActivePeriod && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {t('archive_notice', { period: period.label })}
        </div>
      )}

      {scheduleLabel && (
        <div className="rounded-md border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-800">
          <strong>{t('installments')}:</strong> {scheduleLabel} · {t('expected_to_date')}: <strong>{fmt(expectedFull)} ₺</strong>
          {curInstLabel && <> · {t('current_installment')}: <strong>{curInstLabel}</strong></>}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-700">{t('table_title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="text-xs w-full min-w-max">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-50 z-10 text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap border-r border-gray-200">{t('col_apt')}</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500 whitespace-nowrap">{t('col_resident')}</th>
                  <th className="text-right px-2 py-2 font-medium text-amber-600 whitespace-nowrap">{t('col_prev')}</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-500 whitespace-nowrap">{t('col_annual')}</th>
                  {PERIOD_MONTHS.map(pm => (
                    <th key={`${pm.year}-${pm.month}`} className="text-right px-2 py-2 font-medium text-gray-500 whitespace-nowrap">
                      {getMonthName(pm.month, locale, true)}<span className="text-gray-300"> '{String(pm.year).slice(2)}</span>
                    </th>
                  ))}
                  <th className="text-right px-2 py-2 font-medium text-green-600 whitespace-nowrap">{t('col_total')}</th>
                  <th className="text-right px-2 py-2 font-medium text-red-500 whitespace-nowrap">{t('col_installment')}{curInstLabel ? ` · ${curInstLabel}` : ''}</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 whitespace-nowrap">{t('col_remaining')}</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => {
                  const isOdd = i % 2 === 1
                  const taksitColor = row.behind ? 'text-red-600 font-bold'
                    : row.credit ? 'text-blue-600 font-medium'
                    : 'text-green-600 font-medium'
                  const kalanColor = row.yearRemaining > 0.01 ? 'text-gray-700 font-medium'
                    : row.yearRemaining < -0.01 ? 'text-blue-600 font-medium'
                    : 'text-green-600 font-medium'
                  const prevColor = row.previous_balance > 0 ? 'text-red-500'
                    : row.previous_balance < 0 ? 'text-blue-500'
                    : 'text-gray-300'
                  return (
                    <tr key={row.apartment_no} className={`border-b border-gray-100 ${isOdd ? 'bg-gray-50/40' : 'bg-white'}`}>
                      <td className={`sticky left-0 z-10 border-r border-gray-100 px-3 py-1.5 font-mono font-semibold text-green-700 whitespace-nowrap ${isOdd ? 'bg-gray-50/80' : 'bg-white'}`}>
                        {row.apartment_no}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap max-w-[160px] truncate">{row.resident_name || '—'}</td>
                      <td className={`px-2 py-1.5 text-right font-mono whitespace-nowrap ${prevColor}`}>
                        {row.previous_balance === 0 ? '—' : `${row.previous_balance > 0 ? '+' : ''}${fmt(row.previous_balance)}`}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap text-gray-600">
                        {row.annual_due === 0 ? <span className="text-gray-300">{t('exempt')}</span> : fmt(row.annual_due)}
                      </td>
                      {PERIOD_MONTHS.map(pm => {
                        const key = `${pm.year}-${pm.month}`
                        const amount = row.monthPaid[key] ?? 0
                        return (
                          <td key={key} className={`px-2 py-1.5 text-right font-mono whitespace-nowrap ${
                            amount > 0 ? 'text-green-700' : amount < 0 ? 'text-red-800' : 'text-gray-200'
                          }`}>
                            {amount !== 0 ? fmt(amount) : '—'}
                          </td>
                        )
                      })}
                      <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap text-green-700 font-medium">
                        {fmt(row.total_paid)}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono whitespace-nowrap ${taksitColor}`}>
                        {row.behind ? fmt(row.overdue) : '✓'}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${kalanColor}`}>
                        {row.yearRemaining < -0.01 ? `+${fmt(-row.yearRemaining)}`
                          : row.yearRemaining < 0.01 ? '✓'
                          : fmt(row.yearRemaining)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                  <td className="sticky left-0 bg-gray-100 z-10 border-r border-gray-200 px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                    TOPLAM
                  </td>
                  <td className="px-2 py-2" />
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
                  <td className={`px-2 py-2 text-right font-mono text-xs font-bold whitespace-nowrap ${
                    totalOverdueNet > 0.01 ? 'text-red-600'
                    : totalOverdueNet < -0.01 ? 'text-blue-600'
                    : 'text-green-600'
                  }`}>
                    {totalOverdueNet < -0.01 ? `+${fmt(Math.abs(totalOverdueNet))}` : fmt(totalOverdueNet)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-xs font-bold whitespace-nowrap ${
                    totalYearRem > 0.01 ? 'text-gray-700'
                    : totalYearRem < -0.01 ? 'text-blue-600'
                    : 'text-green-600'
                  }`}>
                    {totalYearRem < -0.01 ? `+${fmt(Math.abs(totalYearRem))}` : fmt(totalYearRem)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
