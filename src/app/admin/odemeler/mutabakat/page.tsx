import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'
import { getPeriod, getTreasuryRange, PERIODS } from '@/lib/periods'
import { PeriodSelector } from '@/components/shared/period-selector'
import { reconcile, type Issue, type IssueKind, type RIncome, type RPayment } from '@/lib/reconcile'
import { LinkedFix, NoIncomeFix, OrphanIncomeFix } from '@/components/admin/recon-actions'

export const dynamic = 'force-dynamic'

const KIND_INFO: Record<IssueKind, { title: string; help: string }> = {
  amount_mismatch: {
    title: 'Tutar farklı',
    help: 'Aidat kaydı ile bağlı gelir kaydının tutarı farklı. Çoğunlukla gelir, Gelirler sayfasında sonradan düzenlenmiştir.',
  },
  no_income: {
    title: 'Gelir kaydı yok',
    help: "Aidat tablosunda ödeme var ama Gelirler'de karşılığı yok (genellikle CSV/toplu aktarımdan gelen ödemeler). Önce eşleştirme önerisine bakın; aynı ödeme Gelirler'e başka bir kayıtla girilmişse yeni gelir oluşturmak çift sayım yapar.",
  },
  orphan_income: {
    title: 'Ödemesi olmayan aidat geliri',
    help: "Gelirler'de \"Aidat\" kategorisinde kayıt var ama aidat tablosunda karşılığı yok. Bir ödemeye bağlayın, yeni aidat ödemesi oluşturun ya da aidat değilse kategorisini değiştirin.",
  },
  apt_mismatch: {
    title: 'Daire farklı',
    help: 'Gelir kaydındaki daire numarası, bağlı olduğu aidat ödemesinin dairesinden farklı.',
  },
  category_changed: {
    title: 'Kategori değiştirilmiş',
    help: 'Gelir bir aidat ödemesine bağlı ama kategorisi artık "Aidat" değil; aidat gelirleri raporlarda eksik görünür.',
  },
  date_mismatch: {
    title: 'Tarih farklı',
    help: 'Ödeme tarihi ile gelir tarihi farklı. Dönem/ay raporlarında kayma yaratabilir.',
  },
}
const KIND_ORDER: IssueKind[] = ['amount_mismatch', 'no_income', 'orphan_income', 'apt_mismatch', 'category_changed', 'date_mismatch']

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; apt?: string }>
}) {
  const { period: periodParam, apt: aptFilter } = await searchParams
  const period = getPeriod(periodParam)
  const { start, end } = getTreasuryRange(period)
  const periodOptions = PERIODS.map(p => ({ id: p.id, label: `${p.label} — ${p.active ? 'Aktif' : 'Arşiv'}` }))
  const supabase = await createClient()

  const [paysRes, incRes, settRes] = await Promise.all([
    fetchAll<RPayment>((f, t) => supabase.from('payments')
      .select('id, apartment_no, resident_name, month, year, amount_paid, payment_date, income_id')
      .eq('period_id', period.id).order('apartment_no').order('id').range(f, t)),
    fetchAll<RIncome>((f, t) => supabase.from('income')
      .select('id, date, title, description, category, amount, apartment_no')
      .order('date').order('id').range(f, t)),
    supabase.from('apartment_settings').select('apartment_no').eq('period_id', period.id),
  ])

  if (paysRes.error || incRes.error) {
    return <p className="text-sm text-red-600">Veri okunamadı: {paysRes.error?.message ?? incRes.error?.message}</p>
  }

  const knownApartments = [...new Set([
    ...(settRes.data ?? []).map(s => s.apartment_no as string),
    ...paysRes.data.map(p => p.apartment_no),
  ])].sort()

  const { issues, byApartment } = reconcile(paysRes.data, incRes.data, {
    knownApartments,
    // Bağlantısız aidat gelirleri yalnızca bu dönemin tarih aralığındaysa dikkate alınır
    incomeInScope: i => i.date >= start && i.date < end,
  })

  const shown = aptFilter ? issues.filter(i => i.apartment_no === aptFilter) : issues
  const diffApts = byApartment
    .filter(a => Math.abs(a.diff) > 0.009 || a.issues.length > 0)
    .sort((a, b) => a.apartment_no.localeCompare(b.apartment_no, 'tr', { numeric: true }))

  const aidatTotal = paysRes.data.reduce((s, p) => s + Number(p.amount_paid), 0)
  const incomeAidatInPeriod = incRes.data
    .filter(i => (i.category ?? '').toLocaleLowerCase('tr') === 'aidat' && i.date >= start && i.date < end)
    .reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <Link href={`/admin/odemeler?period=${period.id}`} className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Aidat / Ödeme Takibi
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
            <Scale className="h-6 w-6 text-indigo-500" /> Aidat ↔ Gelirler Mutabakatı
            <span className="text-base font-normal text-gray-400">{period.label}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Aidat tablosundaki her ödeme, Gelirler&apos;de aynı tutarlı bir &quot;Aidat&quot; kaydıyla eşleşmelidir. Uyuşmayanlar aşağıda.
          </p>
        </div>
        <PeriodSelector options={periodOptions} value={period.id} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat title="Aidat tablosu toplamı" value={formatCurrency(aidatTotal)} />
        <Stat title="Gelirler · Aidat kategorisi (dönem)" value={formatCurrency(incomeAidatInPeriod)} />
        <Stat title="Fark" value={formatCurrency(aidatTotal - incomeAidatInPeriod)}
          cls={Math.abs(aidatTotal - incomeAidatInPeriod) > 0.009 ? 'text-red-600' : 'text-green-600'} />
        <Stat title="Sorunlu kayıt" value={String(issues.length)} cls={issues.length ? 'text-red-600' : 'text-green-600'}
          note={`${diffApts.length} daire`} />
      </div>
      <p className="text-xs text-gray-400 -mt-3">
        Not: Gelir toplamı tarih aralığına göre, aidat toplamı dönem etiketine göre hesaplanır; dönem sınırına yakın tarihli ödemelerde küçük fark normal olabilir.
      </p>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-green-700 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-8 w-8" />
            Bu dönemde aidat tablosu ile Gelirler tamamen uyumlu.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Daire bazlı özet */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daire bazlı fark</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-y border-gray-200 text-xs text-gray-500">
                    <th className="text-left px-3 py-2 font-medium">Daire</th>
                    <th className="text-right px-3 py-2 font-medium">Aidat tablosu</th>
                    <th className="text-right px-3 py-2 font-medium">Gelirler</th>
                    <th className="text-right px-3 py-2 font-medium">Fark</th>
                    <th className="text-left px-3 py-2 font-medium">Sorunlar</th>
                  </tr>
                </thead>
                <tbody>
                  {diffApts.map(a => (
                    <tr key={a.apartment_no} className={`border-b border-gray-100 ${aptFilter === a.apartment_no ? 'bg-indigo-50/50' : ''}`}>
                      <td className="px-3 py-2">
                        <Link href={`?period=${period.id}&apt=${a.apartment_no}`} className="font-mono font-semibold text-indigo-700 hover:underline">{a.apartment_no}</Link>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(a.aidatTotal)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(a.incomeTotal)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${Math.abs(a.diff) > 0.009 ? 'text-red-600' : 'text-gray-300'}`}>
                        {Math.abs(a.diff) > 0.009 ? `${a.diff > 0 ? '+' : ''}${formatCurrency(a.diff)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {[...new Set(a.issues.map(i => KIND_INFO[i.kind].title))].join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {aptFilter && (
            <div className="text-sm text-indigo-700">
              {aptFilter} dairesinin sorunları gösteriliyor · <Link href={`?period=${period.id}`} className="underline">tümünü göster</Link>
            </div>
          )}

          {KIND_ORDER.map(kind => {
            const list = shown.filter(i => i.kind === kind)
            if (!list.length) return null
            return (
              <Card key={kind}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{KIND_INFO[kind].title} <span className="text-gray-400 font-normal">({list.length})</span></CardTitle>
                  <p className="text-xs text-gray-500">{KIND_INFO[kind].help}</p>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-200 text-xs text-gray-500">
                        <th className="text-left px-3 py-2 font-medium">Daire</th>
                        <th className="text-left px-3 py-2 font-medium">Aidat kaydı</th>
                        <th className="text-left px-3 py-2 font-medium">Gelir kaydı</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((is, idx) => (
                        <tr key={`${kind}-${is.payment?.id ?? ''}-${is.income?.id ?? ''}-${idx}`} className="border-b border-gray-100 align-top">
                          <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">{is.apartment_no ?? <span className="text-gray-400">?</span>}</td>
                          <td className="px-3 py-2 text-xs"><PaymentCell is={is} /></td>
                          <td className="px-3 py-2 text-xs"><IncomeCell is={is} /></td>
                          <td className="px-3 py-2">
                            {(kind === 'no_income') && <NoIncomeFix paymentId={is.payment!.id} suggestedIncomeId={is.suggestion?.incomeId} />}
                            {(kind === 'orphan_income') && (
                              <OrphanIncomeFix incomeId={is.income!.id} suggestedPaymentId={is.suggestion?.paymentId}
                                suggestedApt={is.suggestion?.apartment_no ?? null} apartments={knownApartments} />
                            )}
                            {(kind !== 'no_income' && kind !== 'orphan_income') && <LinkedFix paymentId={is.payment!.id} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

function PaymentCell({ is }: { is: Issue }) {
  const p = is.payment
  if (!p) return <span className="text-gray-300">—</span>
  return (
    <div>
      <div className="font-mono font-semibold text-gray-800">{formatCurrency(Number(p.amount_paid))}</div>
      <div className="text-gray-500">{MONTHS[p.month]} {p.year}{p.payment_date ? ` · ${formatDate(p.payment_date)}` : ''}</div>
      {p.resident_name && <div className="text-gray-400">{p.resident_name}</div>}
    </div>
  )
}

function IncomeCell({ is }: { is: Issue }) {
  const i = is.income
  if (!i) return <span className="text-gray-300">—</span>
  return (
    <div className="max-w-[320px]">
      <div className="font-mono font-semibold text-gray-800">{formatCurrency(Number(i.amount))}</div>
      <div className="text-gray-500">{formatDate(i.date)} · {i.category ?? 'kategorisiz'}{i.apartment_no ? ` · ${i.apartment_no}` : ''}</div>
      <div className="text-gray-400 truncate" title={`${i.title} ${i.description ?? ''}`}>{i.title}</div>
    </div>
  )
}

function Stat({ title, value, note, cls = 'text-gray-800' }: { title: string; value: string; note?: string; cls?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-3 px-3">
        <p className={`text-lg font-bold font-mono ${cls}`}>{value}</p>
        {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
      </CardContent>
    </Card>
  )
}
