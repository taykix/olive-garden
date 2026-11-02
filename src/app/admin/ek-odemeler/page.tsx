import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, Droplets, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { formatCurrency, formatDate } from '@/lib/utils'
import { chargeStatus, guessApartment, isShop, type ChargeStatus } from '@/lib/special-charges'
import type { Income, SpecialCharge, SpecialChargeItem, SpecialChargePayment } from '@/types'
import {
  LinkIncomeControl,
  SpecialChargeItemDialog,
  SpecialChargePaymentChip,
  SpecialChargePaymentDialog,
} from '@/components/admin/special-charge-forms'
import { PrintButton } from '@/app/admin/raporlar/print-button'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<ChargeStatus, { text: string; cls: string }> = {
  paid:    { text: 'Ödendi',    cls: 'bg-green-100 text-green-800' },
  partial: { text: 'Kısmi',     cls: 'bg-amber-100 text-amber-800' },
  overdue: { text: 'Gecikmiş',  cls: 'bg-red-100 text-red-700' },
  pending: { text: 'Bekliyor',  cls: 'bg-gray-100 text-gray-600' },
  exempt:  { text: 'Muaf',      cls: 'bg-gray-50 text-gray-400' },
  credit:  { text: 'Fazla',     cls: 'bg-blue-100 text-blue-700' },
}

// A-1, A-2 … A-10 doğal sıralama
function aptSort(a: string, b: string) {
  const [ba, na] = a.split('-'); const [bb, nb] = b.split('-')
  return ba === bb ? Number(na) - Number(nb) : ba.localeCompare(bb)
}

const WATER_TEXT = /ask[iİı]|\bsu\b|su bağlant|su sayac|sayaç|sayac/i

export default async function SpecialChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; all?: string; filter?: string }>
}) {
  const { c: chargeParam, all, filter } = await searchParams
  const supabase = await createClient()

  const { data: chargesData, error: chargesErr } = await supabase
    .from('special_charges').select('*').order('due_date', { ascending: false })

  if (chargesErr) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
        Ek ödeme tabloları bulunamadı. Lütfen <code className="font-mono">supabase/special-charges.sql</code> dosyasını
        Supabase → SQL Editor&apos;da bir kez çalıştırın.
        <div className="mt-1 text-xs text-amber-600">({chargesErr.message})</div>
      </div>
    )
  }

  const charges = (chargesData ?? []) as SpecialCharge[]
  const charge = charges.find(c => c.id === chargeParam) ?? charges[0]
  if (!charge) {
    return <p className="text-sm text-gray-500">Henüz tanımlı ek ödeme yok.</p>
  }

  const [itemsRes, paysRes, profilesRes, aidatLinksRes] = await Promise.all([
    supabase.from('special_charge_items').select('*').eq('charge_id', charge.id),
    supabase.from('special_charge_payments').select('*').eq('charge_id', charge.id).order('payment_date'),
    supabase.from('profiles').select('full_name, apartment_no').not('apartment_no', 'is', null),
    fetchAll<{ income_id: string }>((f, t) => supabase.from('payments').select('income_id').not('income_id', 'is', null).order('id').range(f, t)),
  ])

  const items = ((itemsRes.data ?? []) as SpecialChargeItem[]).sort((a, b) => aptSort(a.apartment_no, b.apartment_no))
  const payments = (paysRes.data ?? []) as SpecialChargePayment[]
  const nameByApt = new Map<string, string>()
  for (const p of profilesRes.data ?? []) if (p.apartment_no && p.full_name) nameByApt.set(p.apartment_no, p.full_name)

  const payByApt = new Map<string, SpecialChargePayment[]>()
  for (const p of payments) {
    if (!payByApt.has(p.apartment_no)) payByApt.set(p.apartment_no, [])
    payByApt.get(p.apartment_no)!.push(p)
  }

  const rows = items.map(it => {
    const pays = payByApt.get(it.apartment_no) ?? []
    const paid = pays.reduce((s, p) => s + Number(p.amount_paid), 0)
    const due = Number(it.amount_due)
    return { ...it, amount_due: due, pays, paid, remaining: due - paid, status: chargeStatus(due, paid, charge.due_date) }
  })
  // Tanımda olmayan bir birime ödeme bağlanmışsa onu da göster
  for (const [apt, pays] of payByApt) {
    if (!items.some(i => i.apartment_no === apt)) {
      const paid = pays.reduce((s, p) => s + Number(p.amount_paid), 0)
      rows.push({ charge_id: charge.id, apartment_no: apt, amount_due: 0, note: 'Tanımsız birim', pays, paid, remaining: -paid, status: 'credit' })
    }
  }

  const totalDue = rows.reduce((s, r) => s + r.amount_due, 0)
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
  const unpaidRows = rows.filter(r => r.remaining > 0.01)
  const overdueCount = rows.filter(r => r.status === 'overdue').length
  const paidCount = rows.filter(r => r.status === 'paid' || r.status === 'credit').length

  // Tarife özeti (birim türü + blok → tutar), ör. "A, B, C, D, E daire: 14.850 ₺"
  const tariffMap = new Map<string, { blocks: Set<string>; kind: string; amount: number }>()
  for (const it of items) {
    const amount = Number(it.amount_due)
    if (amount <= 0) continue
    const kind = isShop(it.apartment_no) ? 'Dükkan' : 'daire'
    const key = `${kind}|${amount}`
    if (!tariffMap.has(key)) tariffMap.set(key, { blocks: new Set(), kind, amount })
    tariffMap.get(key)!.blocks.add(it.apartment_no.split('-')[0])
  }
  const tariff = [...tariffMap.values()].map(t => ({
    label: t.kind === 'Dükkan' ? 'Dükkan' : `${[...t.blocks].sort().join(', ')} blok daire`,
    amount: t.amount,
  }))

  const visibleRows = filter === 'unpaid' ? unpaidRows : rows

  // ─── Eşleştirme adayları: henüz hiçbir ödemeye bağlı olmayan gelir kayıtları ──
  const linked = new Set<string>([
    ...((aidatLinksRes.data ?? []).map(r => r.income_id as string)),
    ...payments.map(p => p.income_id).filter(Boolean) as string[],
  ])
  const sinceDate = new Date(new Date(charge.due_date).getTime() - 365 * 86400000).toISOString().slice(0, 10)
  const { data: incomeData } = await fetchAll<Pick<Income, 'id' | 'date' | 'title' | 'description' | 'category' | 'amount' | 'apartment_no'>>((f, t) => supabase
    .from('income')
    .select('id, date, title, description, category, amount, apartment_no')
    .gte('date', sinceDate)
    .order('date', { ascending: false })
    .order('id')
    .range(f, t))

  const knownApts = items.map(i => i.apartment_no)
  const dueAmounts = new Set(items.map(i => Number(i.amount_due)).filter(a => a > 0))
  const candidates = ((incomeData ?? []) as Pick<Income, 'id' | 'date' | 'title' | 'description' | 'category' | 'amount' | 'apartment_no'>[])
    .filter(i => !linked.has(i.id) && i.category !== 'Aidat')
    .filter(i => {
      if (all === '1') return true
      const text = `${i.title} ${i.description ?? ''}`
      return dueAmounts.has(Number(i.amount)) || WATER_TEXT.test(text) || i.category === charge.income_category
    })
    .map(i => ({
      ...i,
      suggested: (i.apartment_no && knownApts.includes(i.apartment_no))
        ? i.apartment_no
        : guessApartment(`${i.title} ${i.description ?? ''}`, knownApts),
    }))

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { c: charge.id, all, filter, ...extra }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    return `?${p.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Droplets className="h-6 w-6 text-sky-500" /> Ek Ödemeler
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Aidat dışı, birim başına tahsil edilen ödemeler. Aidat bakiyelerini etkilemez.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {charges.length > 1 && charges.map(c => (
            <Link key={c.id} href={`?c=${c.id}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${c.id === charge.id ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {c.title}
            </Link>
          ))}
          <PrintButton />
        </div>
      </div>

      {/* Charge info */}
      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-800">{charge.title}</p>
            {charge.description && <p className="text-xs text-gray-500 mt-0.5">{charge.description}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {tariff.map(t => `${t.label}: ${formatCurrency(t.amount)}`).join(' · ')} — gelir kategorisi: <strong>{charge.income_category}</strong>
            </p>
          </div>
          <div className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${new Date().toISOString().slice(0, 10) > charge.due_date ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            Son ödeme: {formatDate(charge.due_date)}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat title="Beklenen Toplam" value={formatCurrency(totalDue)} note={`${rows.filter(r => r.amount_due > 0).length} birim`} />
        <Stat title="Tahsil Edilen" value={formatCurrency(totalPaid)} cls="text-green-700" note={`${paidCount} birim tamamladı`} icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} />
        <Stat title="Kalan" value={formatCurrency(Math.max(0, totalDue - totalPaid))} cls="text-red-600" note={`${unpaidRows.length} birim borçlu`} icon={<Clock className="h-4 w-4 text-amber-500" />} />
        <Stat title="Gecikmiş" value={String(overdueCount)} cls={overdueCount ? 'text-red-600' : 'text-gray-800'} note="son tarihi geçen" icon={<AlertCircle className="h-4 w-4 text-red-500" />} />
      </div>

      {/* Units table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Birimler</CardTitle>
          <div className="flex gap-1 text-xs print:hidden">
            <Link href={qs({ filter: undefined })} className={`rounded px-2 py-1 ${filter !== 'unpaid' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>Tümü ({rows.length})</Link>
            <Link href={qs({ filter: 'unpaid' })} className={`rounded px-2 py-1 ${filter === 'unpaid' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>Ödemeyenler ({unpaidRows.length})</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">
              Bu ödeme için birim tanımı yok. <code className="font-mono">special-charges.sql</code> tohum verisini çalıştırın.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200 text-xs text-gray-500">
                  <th className="text-left px-3 py-2 font-medium">Birim</th>
                  <th className="text-left px-3 py-2 font-medium">Tür</th>
                  <th className="text-left px-3 py-2 font-medium">Sakin</th>
                  <th className="text-right px-3 py-2 font-medium">Borç</th>
                  <th className="text-right px-3 py-2 font-medium">Ödenen</th>
                  <th className="text-right px-3 py-2 font-medium">Kalan</th>
                  <th className="text-left px-3 py-2 font-medium">Durum</th>
                  <th className="text-left px-3 py-2 font-medium">Ödemeler</th>
                  <th className="px-3 py-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => {
                  const st = STATUS_LABEL[r.status]
                  return (
                    <tr key={r.apartment_no} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/40' : 'bg-white'}`}>
                      <td className="px-3 py-2 font-mono font-semibold text-gray-800 whitespace-nowrap">{r.apartment_no}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{isShop(r.apartment_no) ? 'Dükkan' : 'Daire'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 max-w-[160px] truncate">{nameByApt.get(r.apartment_no) ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {r.amount_due === 0 ? <span className="text-gray-300">muaf</span> : formatCurrency(r.amount_due)}
                          <span className="print:hidden">
                            <SpecialChargeItemDialog chargeId={charge.id} apartmentNo={r.apartment_no} amountDue={r.amount_due} note={r.note} />
                          </span>
                        </span>
                        {r.note && <div className="text-[10px] text-gray-400 font-sans">{r.note}</div>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-green-700">{r.paid ? formatCurrency(r.paid) : '—'}</td>
                      <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${r.remaining > 0.01 ? 'text-red-600 font-semibold' : r.remaining < -0.01 ? 'text-blue-600' : 'text-gray-300'}`}>
                        {Math.abs(r.remaining) < 0.01 ? '—' : r.remaining > 0 ? formatCurrency(r.remaining) : `+${formatCurrency(-r.remaining)}`}
                      </td>
                      <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.text}</span></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.pays.map(p => (
                            <SpecialChargePaymentChip key={p.id} id={p.id} amount={Number(p.amount_paid)} date={p.payment_date} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right print:hidden">
                        {r.remaining > 0.01 && (
                          <SpecialChargePaymentDialog
                            chargeId={charge.id}
                            chargeTitle={charge.title}
                            apartmentNo={r.apartment_no}
                            defaultAmount={r.remaining}
                            residentName={nameByApt.get(r.apartment_no)}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Matching existing income records */}
      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-sky-600" /> Gelirlerdeki kayıtları eşleştir
          </CardTitle>
          <p className="text-xs text-gray-500">
            Gelirler&apos;e daha önce normal gelir olarak girilmiş ödemeleri birime bağlayın. Gelir tutarı ve tarihi değişmez;
            yalnızca kategorisi <strong>{charge.income_category}</strong> olur ve yukarıdaki tabloda ödendi görünür.
            {' '}{all === '1'
              ? <Link href={qs({ all: undefined })} className="text-sky-700 underline">Yalnızca olası ASKİ kayıtlarını göster</Link>
              : <>Listede yalnızca tutarı eşleşen veya açıklamasında ASKİ/su geçen kayıtlar var. <Link href={qs({ all: '1' })} className="text-sky-700 underline">Tüm bağlantısız gelirleri göster</Link></>}
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {candidates.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">Eşleştirilecek kayıt bulunamadı.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200 text-xs text-gray-500">
                  <th className="text-left px-3 py-2 font-medium">Tarih</th>
                  <th className="text-left px-3 py-2 font-medium">Başlık / Açıklama</th>
                  <th className="text-left px-3 py-2 font-medium">Kategori</th>
                  <th className="text-right px-3 py-2 font-medium">Tutar</th>
                  <th className="text-right px-3 py-2 font-medium">Birim</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(i => (
                  <tr key={i.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatDate(i.date)}</td>
                    <td className="px-3 py-2 max-w-[320px]">
                      <div className="font-medium text-gray-800 truncate" title={i.title}>{i.title}</div>
                      {i.description && <div className="text-xs text-gray-400 truncate" title={i.description}>{i.description}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{i.category ?? '—'}</td>
                    <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${dueAmounts.has(Number(i.amount)) ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>
                      {formatCurrency(Number(i.amount))}
                    </td>
                    <td className="px-3 py-2">
                      <LinkIncomeControl incomeId={i.id} chargeId={charge.id} apartments={knownApts} suggested={i.suggested} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ title, value, note, cls = 'text-gray-800', icon }: { title: string; value: string; note?: string; cls?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-3 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-medium text-gray-500">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="pb-3 px-3">
        <p className={`text-lg font-bold font-mono ${cls}`}>{value}</p>
        {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
      </CardContent>
    </Card>
  )
}
