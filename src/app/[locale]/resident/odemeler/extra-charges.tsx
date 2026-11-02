import { Download, Droplets, Landmark } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { chargeStatus, isShop, localized, RECEIPT_BUCKET, type ChargeStatus } from '@/lib/special-charges'
import type { SpecialCharge, SpecialChargeDisbursement, SpecialChargeItem, SpecialChargePayment } from '@/types'

// Ek ödemeler (aidat dışı, ör. ASKİ) — sakinlere saydamlık için: birim bazlı tahsilat
// durumu + toplanan paranın kuruma aktarımı ve indirilebilir dekontlar.

const INTL_LOCALE: Record<string, string> = { tr: 'tr-TR', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', ru: 'ru-RU' }

const STATUS_CLS: Record<ChargeStatus, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
  exempt: 'bg-gray-50 text-gray-400',
  credit: 'bg-blue-100 text-blue-700',
}

function aptSort(a: string, b: string) {
  const [ba, na] = a.split('-'); const [bb, nb] = b.split('-')
  return ba === bb ? Number(na) - Number(nb) : ba.localeCompare(bb)
}

export async function ExtraCharges({ locale }: { locale: string }) {
  const t = await getTranslations('odemeler')
  const tr = await getTranslations('resident')
  const supabase = await createClient()

  // Tablolar henüz oluşturulmadıysa bölüm sessizce gizlenir.
  const { data: chargesData, error } = await supabase
    .from('special_charges').select('*').order('due_date', { ascending: false })
  if (error || !chargesData?.length) return null
  const charges = chargesData as SpecialCharge[]
  const ids = charges.map(c => c.id)

  const [itemsRes, paysRes, disbRes] = await Promise.all([
    supabase.from('special_charge_items').select('*').in('charge_id', ids),
    supabase.from('special_charge_payments').select('charge_id, apartment_no, amount_paid').in('charge_id', ids),
    supabase.from('special_charge_disbursements').select('*').in('charge_id', ids).order('date').order('created_at'),
  ])
  const items = (itemsRes.data ?? []) as SpecialChargeItem[]
  const pays = (paysRes.data ?? []) as Pick<SpecialChargePayment, 'charge_id' | 'apartment_no' | 'amount_paid'>[]
  const disbs = (disbRes.data ?? []) as SpecialChargeDisbursement[] // tablo yoksa boş

  const intl = INTL_LOCALE[locale] ?? 'tr-TR'
  const money = (n: number) => new Intl.NumberFormat(intl, { style: 'currency', currency: 'TRY', currencyDisplay: 'narrowSymbol' }).format(n)
  const date = (d: string) => new Intl.DateTimeFormat(intl, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(d))
  const receiptUrl = (d: SpecialChargeDisbursement) =>
    supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(d.receipt_path!, { download: d.receipt_name || true }).data.publicUrl

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Droplets className="h-5 w-5 text-sky-500" /> {tr('sc_title')}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">{tr('sc_note')}</p>
      </div>

      {charges.map(charge => {
        const chargeItems = items.filter(i => i.charge_id === charge.id)
        const paidByApt = new Map<string, number>()
        for (const p of pays) if (p.charge_id === charge.id) paidByApt.set(p.apartment_no, (paidByApt.get(p.apartment_no) ?? 0) + Number(p.amount_paid))
        const apts = [...new Set([...chargeItems.map(i => i.apartment_no), ...paidByApt.keys()])].sort(aptSort)
        const rows = apts.map(apt => {
          const due = Number(chargeItems.find(i => i.apartment_no === apt)?.amount_due ?? 0)
          const paid = paidByApt.get(apt) ?? 0
          return { apt, due, paid, remaining: due - paid, status: chargeStatus(due, paid, charge.due_date) }
        })
        const totalDue = rows.reduce((s, r) => s + r.due, 0)
        const totalPaid = rows.reduce((s, r) => s + r.paid, 0)
        const totalRemaining = rows.reduce((s, r) => s + Math.max(0, r.remaining), 0)
        const chargeDisbs = disbs.filter(d => d.charge_id === charge.id)
        const transferred = chargeDisbs.reduce((s, d) => s + Number(d.amount), 0)
        const fees = chargeDisbs.reduce((s, d) => s + Number(d.fee), 0)
        const balance = totalPaid - transferred - fees
        const description = charge.description ? localized(charge.description, charge.description_i18n, locale) : null

        return (
          <Card key={charge.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base text-gray-800">{localized(charge.title, charge.title_i18n, locale)}</CardTitle>
                  {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
                </div>
                <span className="self-start rounded-md bg-gray-50 px-2.5 py-1 text-xs text-gray-600 whitespace-nowrap">
                  {tr('sc_deadline')}: <strong>{date(charge.due_date)}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-3">
                <Stat label={t('ex_expected')} value={money(totalDue)} />
                <Stat label={t('ex_collected')} value={money(totalPaid)} cls="text-green-700" />
                <Stat label={t('ex_outstanding')} value={money(totalRemaining)} cls={totalRemaining > 0.01 ? 'text-red-600' : 'text-gray-800'} />
                <Stat label={t('ex_transferred')} value={money(transferred + fees)} cls="text-sky-700" />
              </div>
            </CardHeader>

            <CardContent className="p-0 space-y-0">
              {/* Kuruma yapılan ödemeler + dekontlar */}
              {chargeDisbs.length > 0 && (
                <div className="border-t border-gray-100">
                  <h3 className="px-4 pt-3 pb-2 text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 text-sky-600" /> {t('ex_transfers_title')}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-y border-gray-200 text-gray-500">
                          <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_date')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('ex_col_desc')}</th>
                          <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_amount')}</th>
                          <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_fee')}</th>
                          <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_sum')}</th>
                          <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_receipt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chargeDisbs.map(d => (
                          <tr key={d.id} className="border-b border-gray-100">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{date(d.date)}</td>
                            <td className="px-3 py-2 min-w-[200px]">
                              <div className="font-medium text-gray-800">{localized(d.title, d.title_i18n, locale)}</div>
                              <div className="text-[11px] text-gray-400">
                                {[d.recipient, d.reference && `${t('ex_ref')}: ${d.reference}`].filter(Boolean).join(' · ')}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{money(Number(d.amount))}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-gray-500">{Number(d.fee) ? money(Number(d.fee)) : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono whitespace-nowrap font-semibold text-gray-800">{money(Number(d.amount) + Number(d.fee))}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {d.receipt_path ? (
                                <a href={receiptUrl(d)} rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 font-medium text-sky-700 hover:bg-sky-100">
                                  <Download className="h-3.5 w-3.5" /> {t('ex_download')}
                                </a>
                              ) : <span className="text-gray-400">{t('ex_no_receipt')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-3 py-2" colSpan={2}>{t('total_row')}</td>
                          <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{money(transferred)}</td>
                          <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-gray-500">{money(fees)}</td>
                          <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{money(transferred + fees)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="px-4 py-2 text-xs text-gray-500">
                    {t('ex_balance', { collected: money(totalPaid), paid: money(transferred + fees) })}{' '}
                    <strong className={balance < -0.01 ? 'text-red-600' : 'text-gray-800'}>{money(balance)}</strong>
                  </p>
                </div>
              )}

              {/* Birim bazlı tahsilat durumu */}
              <div className="border-t border-gray-100">
                <h3 className="px-4 pt-3 pb-2 text-sm font-medium text-gray-700">{t('ex_units_title')}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-200 text-gray-500">
                        <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{t('col_apt')}</th>
                        <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_type')}</th>
                        <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{tr('sc_due')}</th>
                        <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{tr('sc_paid')}</th>
                        <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{tr('sc_remaining')}</th>
                        <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.apt} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/40' : 'bg-white'}`}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-green-700 whitespace-nowrap">{r.apt}</td>
                          <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{isShop(r.apt) ? t('ex_type_shop') : t('ex_type_apt')}</td>
                          <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-gray-600">{r.due ? money(r.due) : '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-green-700">{r.paid ? money(r.paid) : '—'}</td>
                          <td className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${r.remaining > 0.01 ? 'text-red-600 font-semibold' : r.remaining < -0.01 ? 'text-blue-600' : 'text-gray-300'}`}>
                            {Math.abs(r.remaining) < 0.01 ? '—' : r.remaining > 0 ? money(r.remaining) : `+${money(-r.remaining)}`}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_CLS[r.status]}`}>{tr(`sc_st_${r.status}`)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                        <td className="px-3 py-2" colSpan={2}>{t('total_row')}</td>
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{money(totalDue)}</td>
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-green-700">{money(totalPaid)}</td>
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-red-600">{money(totalRemaining)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

function Stat({ label, value, cls = 'text-gray-800' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-bold font-mono ${cls}`}>{value}</p>
    </div>
  )
}
