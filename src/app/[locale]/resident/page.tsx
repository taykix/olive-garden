import { getTranslations, setRequestLocale } from 'next-intl/server'
import { TrendingUp, TrendingDown, Wallet, Megaphone, Home } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'
import { Payment, ApartmentSettings } from '@/types'

export const dynamic = 'force-dynamic'

const PERIOD_MONTHS = [
  { month: 10, year: 2025 }, { month: 11, year: 2025 }, { month: 12, year: 2025 },
  { month: 1,  year: 2026 }, { month: 2,  year: 2026 }, { month: 3,  year: 2026 },
  { month: 4,  year: 2026 }, { month: 5,  year: 2026 }, { month: 6,  year: 2026 },
  { month: 7,  year: 2026 }, { month: 8,  year: 2026 },
]

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
    supabase.from('income').select('amount'),
    supabase.from('expenses').select('amount'),
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

  const totalIncome   = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const balance       = totalIncome - totalExpenses
  const announcements = announcementsRes.data ?? []
  const apartmentNo   = profileRes.data?.apartment_no ?? null

  // Fetch payment data for the resident's apartment
  let settings: ApartmentSettings | null = null
  let payments: Payment[] = []
  if (apartmentNo) {
    const [settRes, payRes] = await Promise.all([
      supabase.from('apartment_settings').select('*').eq('apartment_no', apartmentNo).maybeSingle(),
      supabase.from('payments').select('*').eq('apartment_no', apartmentNo)
        .order('year', { ascending: true }).order('month', { ascending: true }),
    ])
    settings = settRes.data as ApartmentSettings | null
    payments = (payRes.data ?? []) as Payment[]
  }

  const annual_due       = settings?.annual_due ?? 40000
  const previous_balance = settings?.previous_balance ?? 0
  const total_paid       = payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const remaining        = annual_due + previous_balance - total_paid

  const monthData: Record<string, { amount: number; notes: string[] }> = {}
  for (const p of payments) {
    const key = `${p.year}-${p.month}`
    if (!monthData[key]) monthData[key] = { amount: 0, notes: [] }
    monthData[key].amount += Number(p.amount_paid)
    if (p.note) monthData[key].notes.push(p.note)
  }

  const remainingColor = remaining > 0.01
    ? 'text-red-600'
    : remaining < -0.01 ? 'text-blue-600'
    : 'text-green-600'

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
          Profilinizde daire numarası kayıtlı değil. Aidat durumunuzu görmek için yöneticiyle iletişime geçin.
        </div>
      )}
      {apartmentNo && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Home className="h-5 w-5 text-green-600" />
            Aidat Durumum — Daire {apartmentNo}
          </h2>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Card>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-gray-500">Yıllık Aidat</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {annual_due === 0
                  ? <p className="text-sm font-semibold text-gray-400">Muaf</p>
                  : <p className="text-sm font-bold text-gray-800 font-mono">{formatCurrency(annual_due)}</p>
                }
              </CardContent>
            </Card>

            {previous_balance !== 0 && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium text-gray-500">Geçen Yıl</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-3">
                  <p className={`text-sm font-bold font-mono ${previous_balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {previous_balance > 0 ? '+' : ''}{formatCurrency(previous_balance)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{previous_balance > 0 ? 'borç' : 'alacak'}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-gray-500">Ödenen</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <p className="text-sm font-bold text-green-700 font-mono">{formatCurrency(total_paid)}</p>
              </CardContent>
            </Card>

            <Card className={`${remaining > 0.01 ? 'border-red-200' : remaining < -0.01 ? 'border-blue-200' : 'border-green-200'}`}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-gray-500">Kalan</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <p className={`text-sm font-bold font-mono ${remainingColor}`}>
                  {remaining < -0.01
                    ? `+${fmt(Math.abs(remaining))} alacak`
                    : remaining < 0.01 ? '✓ Tam'
                    : fmt(remaining)}
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
        </section>
      )}

      {/* Financial summary */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('financial_title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">{t('income')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">{t('expenses')}</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
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
              <Card key={a.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{a.content}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {formatDate(a.created_at)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
