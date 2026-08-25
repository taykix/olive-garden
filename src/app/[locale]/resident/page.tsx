import { getTranslations, setRequestLocale } from 'next-intl/server'
import { TrendingUp, TrendingDown, Wallet, Megaphone, Home } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, getMonthName } from '@/lib/utils'
import { Payment, ApartmentSettings } from '@/types'
import { ExpandableAnnouncement } from '@/components/shared/expandable-announcement'
import { ACTIVE_PERIOD, duesStatus, getTreasuryRange } from '@/lib/periods'

export const dynamic = 'force-dynamic'

// Sakin panosu güncel (aktif) dönemi özetler; arşiv için Ödemeler sayfasındaki dönem seçici kullanılır.
const PERIOD_MONTHS = ACTIVE_PERIOD.months

function fmt(n: number): string {
  if (n === 0) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

export default async function ResidentPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('resident')

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [incomeRes, expenseRes, announcementsRes, profileRes] = await Promise.all([
    supabase.from('income').select('amount, date'),
    supabase.from('expenses').select('amount, date'),
    supabase
      .from('announcements')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(10),
    user
      ? supabase.from('profiles').select('apartment_no, full_name').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Finansal özet aktif döneme göre: devir (dönem başından önceki net) + dönem geliri − dönem gideri
  const { start: pStart, end: pEnd } = getTreasuryRange(ACTIVE_PERIOD)
  const allInc = (incomeRes.data ?? []) as { amount: number; date: string }[]
  const allExp = (expenseRes.data ?? []) as { amount: number; date: string }[]
  const inPeriod = (d: string) => d >= pStart && d < pEnd
  const periodIncome   = allInc.filter(r => inPeriod(r.date)).reduce((s, r) => s + Number(r.amount), 0)
  const periodExpense  = allExp.filter(r => inPeriod(r.date)).reduce((s, r) => s + Number(r.amount), 0)
  const carriedBalance = allInc.filter(r => r.date < pStart).reduce((s, r) => s + Number(r.amount), 0)
                       - allExp.filter(r => r.date < pStart).reduce((s, r) => s + Number(r.amount), 0)
  const balance        = carriedBalance + periodIncome - periodExpense
  const announcements = announcementsRes.data ?? []
  const apartmentNo   = profileRes.data?.apartment_no ?? null

  // Fetch payment data for the resident's apartment
  let settings: ApartmentSettings | null = null
  let payments: Payment[] = []
  if (apartmentNo) {
    const [settRes, payRes] = await Promise.all([
      supabase.from('apartment_settings').select('*').eq('apartment_no', apartmentNo)
        .eq('period_id', ACTIVE_PERIOD.id).maybeSingle(),
      supabase.from('payments').select('*').eq('apartment_no', apartmentNo)
        .order('year', { ascending: true }).order('month', { ascending: true }),
    ])
    settings = settRes.data as ApartmentSettings | null
    // Yalnızca aktif döneme ait ödemeler (açık period_id ile)
    payments = ((payRes.data ?? []) as Payment[]).filter(p => p.period_id === ACTIVE_PERIOD.id)
  }

  const annual_due       = settings?.annual_due ?? 40000
  const previous_balance = settings?.previous_balance ?? 0
  const total_paid       = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const st               = duesStatus(annual_due, previous_balance, total_paid, ACTIVE_PERIOD)

  const monthData: Record<string, { amount: number; notes: string[] }> = {}
  for (const p of payments) {
    const key = `${p.year}-${p.month}`
    if (!monthData[key]) monthData[key] = { amount: 0, notes: [] }
    monthData[key].amount += Number(p.amount_paid)
    if (p.note) monthData[key].notes.push(p.note)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('greeting')}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Aidat section */}
      {!apartmentNo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('no_apt')}
        </div>
      )}
      {apartmentNo && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Home className="h-5 w-5 text-green-600" />
            {t('apt_dues_title')} {apartmentNo} <span className="text-sm font-normal text-gray-400">· {ACTIVE_PERIOD.label}</span>
          </h2>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
            <Card>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-gray-500">{t('annual_due')}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {annual_due === 0
                  ? <p className="text-sm font-semibold text-gray-400">{t('exempt')}</p>
                  : <p className="text-sm font-bold text-gray-800 font-mono">{formatCurrency(annual_due)}</p>
                }
              </CardContent>
            </Card>

            {previous_balance !== 0 && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium text-gray-500">{t('prev_year')}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-3">
                  <p className={`text-sm font-bold font-mono ${previous_balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {previous_balance > 0 ? '+' : ''}{formatCurrency(previous_balance)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{previous_balance > 0 ? t('debt') : t('credit')}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-gray-500">{t('paid_card')}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <p className="text-sm font-bold text-green-700 font-mono">{formatCurrency(total_paid)}</p>
              </CardContent>
            </Card>

            <Card className={`${st.behind ? 'border-red-200' : 'border-green-200'}`}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-gray-500">{t('installment_remaining')}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <p className={`text-sm font-bold font-mono ${st.behind ? 'text-red-600' : 'text-green-600'}`}>
                  {st.behind ? fmt(st.overdue) : t('current_ok')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{t('current_installment_note')}</p>
              </CardContent>
            </Card>

            <Card className={`${st.yearRemaining < -0.01 ? 'border-blue-200' : st.yearRemaining < 0.01 ? 'border-green-200' : 'border-gray-200'}`}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-gray-500">{t('year_remaining')}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <p className={`text-sm font-bold font-mono ${
                  st.yearRemaining < -0.01 ? 'text-blue-600'
                  : st.yearRemaining < 0.01 ? 'text-green-600'
                  : 'text-gray-800'
                }`}>
                  {st.yearRemaining < -0.01 ? `+${fmt(-st.yearRemaining)} ${t('receivable')}`
                    : st.yearRemaining < 0.01 ? t('full_paid')
                    : fmt(st.yearRemaining)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Period payment table */}
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-36">{t('month_col')}</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 w-36">{t('amount_col')}</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t('note_col')}</th>
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
                          {getMonthName(pm.month, locale)} {pm.year}
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
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-600">{t('total')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">{fmt(total_paid)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Financial summary — aktif döneme göre */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          {t('financial_title')} <span className="text-sm font-normal text-gray-400">· {ACTIVE_PERIOD.label}</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">{t('carried_balance')}</CardTitle>
              <Wallet className={`h-4 w-4 ${carriedBalance >= 0 ? 'text-teal-500' : 'text-orange-500'}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${carriedBalance >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>{formatCurrency(carriedBalance)}</p>
              <p className="text-xs text-gray-400 mt-1">{t('carried_note')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">{t('period_income')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-green-600">{formatCurrency(periodIncome)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">{t('period_expense')}</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-red-600">{formatCurrency(periodExpense)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">{t('balance')}</CardTitle>
              <Wallet className={`h-4 w-4 ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatCurrency(balance)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{t('incl_carry')}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Announcements */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-green-600" /> {t('announcements_title')}
        </h2>
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              {t('announcements_empty')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <ExpandableAnnouncement key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
