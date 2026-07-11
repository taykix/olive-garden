'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Plan, PlanItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Home } from 'lucide-react'

const APT_COUNT = 42

function fmtC(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
function fmtRate(n: number | null | undefined): string {
  if (n == null) return '0'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

function effectiveBase(item: PlanItem, all: PlanItem[]): number {
  if (item.status === 'merged') return 0
  const children = all.filter(c => c.merged_into === item.id && c.status === 'merged')
  return (item.base_amount ?? 0) + children.reduce((s, c) => s + (c.base_amount ?? 0), 0)
}
function planned(item: PlanItem, all: PlanItem[]): number {
  if (item.status === 'excluded' || item.status === 'merged') return 0
  if (item.method === 'manual') return item.planned_amount ?? 0
  return Math.round(effectiveBase(item, all) * (1 + (item.rate ?? 0) / 100))
}

export function ResidentPlanView({ plan, items, locale }: { plan: Plan; items: PlanItem[]; locale: string }) {
  const t = useTranslations('plan')

  const active = useMemo(() => items.filter(i => i.status === 'active'), [items])
  const fixed = useMemo(() => active.filter(i => !i.optional), [active])
  const optional = useMemo(() => active.filter(i => i.optional), [active])

  // Opsiyoneller varsayılan olarak seçili (tam plan) — kullanıcı kaldırabilir
  const [selected, setSelected] = useState<Set<string>>(() => new Set(optional.map(o => o.id)))

  const fixedTotal = useMemo(() => fixed.reduce((s, it) => s + planned(it, items), 0), [fixed, items])
  const optionalTotal = useMemo(
    () => optional.reduce((s, it) => s + (selected.has(it.id) ? planned(it, items) : 0), 0),
    [optional, selected, items]
  )
  const grand = fixedTotal + optionalTotal
  const perApt = grand ? Math.round(grand / APT_COUNT) : 0

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const catLabel = (it: PlanItem) => (locale === 'en' && it.category_en ? it.category_en : it.category)
  const dateLabel = plan.start_date && plan.end_date ? `${plan.start_date} → ${plan.end_date}` : plan.period

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')} — {plan.period}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Sonuç kartı — daire başına yıllık aidat (canlı) */}
      <Card className="border-green-200 bg-green-50/40">
        <CardContent className="py-6 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-green-600/10 flex items-center justify-center">
              <Home className="h-6 w-6 text-green-700" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('annual_per_apt')}</p>
              <p className="text-3xl font-bold text-green-700 font-mono leading-tight">{fmtC(perApt)} ₺</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center sm:text-right">
            <div>
              <p className="text-xs text-gray-400">{t('fixed_total')}</p>
              <p className="font-mono font-semibold text-gray-700">{fmtC(fixedTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('optional_total')}</p>
              <p className="font-mono font-semibold text-blue-600">{fmtC(optionalTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('grand_total')}</p>
              <p className="font-mono font-bold text-green-700">{fmtC(grand)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tablo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-700">
            {dateLabel}
            <span className="text-xs font-normal text-gray-400 ml-2">· ÷ {APT_COUNT} {t('apts')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-2 py-2.5" />
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t('col_item')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">{t('col_type')}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-amber-600 whitespace-nowrap">{t('col_base')}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">{t('col_calc')}</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">{t('col_amount')}</th>
                </tr>
              </thead>
              <tbody>
                {active.map((it, i) => {
                  const isOpt = it.optional
                  const isSel = !isOpt || selected.has(it.id)
                  const val = planned(it, items)
                  const isOdd = i % 2 === 1
                  return (
                    <tr
                      key={it.id}
                      className={`border-b border-gray-100 last:border-0 ${isOdd ? 'bg-gray-50/40' : 'bg-white'} ${isOpt ? 'cursor-pointer hover:bg-blue-50/30' : ''} ${isOpt && !isSel ? 'opacity-50' : ''}`}
                      onClick={isOpt ? () => toggle(it.id) : undefined}
                    >
                      <td className="px-2 py-2 text-center">
                        {isOpt ? (
                          <input type="checkbox" checked={isSel} onChange={() => toggle(it.id)} onClick={e => e.stopPropagation()} className="accent-blue-600 h-4 w-4" />
                        ) : (
                          <span className="text-gray-300 text-xs">✓</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-800">{catLabel(it)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isOpt ? (
                          <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{t('type_optional')}</span>
                        ) : (
                          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{t('type_fixed')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500 whitespace-nowrap">
                        {effectiveBase(it, items) ? fmtC(effectiveBase(it, items)) : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                        {it.method === 'rate'
                          ? <span className="text-amber-700">{t('method_inflation')} +%{fmtRate(it.rate)}</span>
                          : <span>{t('method_manual')}</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${isOpt && !isSel ? 'text-gray-300 line-through' : 'text-gray-700'}`}>
                        {fmtC(val)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                  <td className="px-2 py-2.5" />
                  <td className="px-3 py-2.5 text-xs text-gray-700" colSpan={4}>{t('grand_total')}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmtC(grand)}</td>
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200 text-gray-500 italic">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 text-xs not-italic font-medium" colSpan={4}>
                    {t('annual_per_apt')} <span className="text-gray-400 font-normal">(÷ {APT_COUNT})</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-green-700 font-bold not-italic">{fmtC(perApt)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-gray-400 px-4 pt-3 border-t border-gray-100">{t('calc_hint')}</p>
          {optional.length > 0 && (
            <p className="text-xs text-gray-400 px-4 pb-3 pt-1">{t('optional_hint')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
