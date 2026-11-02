import { Download, Droplets, Landmark } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { localized, RECEIPT_BUCKET } from '@/lib/special-charges'
import type { SpecialCharge, SpecialChargeDisbursement, SpecialChargeItem, SpecialChargePayment } from '@/types'

// Ek ödemeler (aidat dışı, ör. ASKİ) — sakin görünümü, sade: her birim için yalnızca
// ödenen ve ödenecek tutar + kuruma yapılan ödemeler ve indirilebilir dekontlar.
// Toplamlar, durumlar ve bakiye yalnızca yönetici Ek Ödemeler sayfasında gösterilir.

const INTL_LOCALE: Record<string, string> = { tr: 'tr-TR', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', ru: 'ru-RU' }

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
          return { apt, paid, toPay: Math.max(0, due - paid) }
        })
        const chargeDisbs = disbs.filter(d => d.charge_id === charge.id)
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
            </CardHeader>

            <CardContent className="p-0">
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
                          <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_paid')}</th>
                          <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_receipt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chargeDisbs.map(d => (
                          <tr key={d.id} className="border-b border-gray-100">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{date(d.date)}</td>
                            <td className="px-3 py-2 min-w-[200px]">
                              <div className="font-medium text-gray-800">{localized(d.title, d.title_i18n, locale)}</div>
                              {d.recipient && <div className="text-[11px] text-gray-400">{d.recipient}</div>}
                            </td>
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
                    </table>
                  </div>
                </div>
              )}

              {/* Birim bazında ödenen / ödenecek */}
              <div className="border-t border-gray-100">
                <h3 className="px-4 pt-3 pb-2 text-sm font-medium text-gray-700">{t('ex_units_title')}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-200 text-gray-500">
                        <th className="text-left px-3 py-2 font-medium whitespace-nowrap">{t('col_apt')}</th>
                        <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_paid')}</th>
                        <th className="text-right px-3 py-2 font-medium whitespace-nowrap">{t('ex_col_to_pay')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.apt} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/40' : 'bg-white'}`}>
                          <td className="px-3 py-1.5 font-mono font-semibold text-green-700 whitespace-nowrap">{r.apt}</td>
                          <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-green-700">{r.paid > 0.01 ? money(r.paid) : '—'}</td>
                          <td className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${r.toPay > 0.01 ? 'text-red-600 font-semibold' : 'text-gray-300'}`}>
                            {r.toPay > 0.01 ? money(r.toPay) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
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
