'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plan, PlanItem } from '@/types'
import {
  createPlan, updatePlan, deletePlan, refreshPlanBase,
  createPlanItem, updatePlanItem, deletePlanItem,
  mergePlanItems, unmergePlanItem,
} from '@/lib/supabase/actions'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { CSVExportButton } from '@/components/admin/csv-export-button'
import { Plus, Pencil, Settings, RefreshCw, GitMerge, Undo2, EyeOff, Eye, Vote, Printer } from 'lucide-react'

const APT_COUNT = 42

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
function fmtC(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
// Oran gösterimi — 2 ondalık (örn. 32,11)
function fmtRate(n: number | null | undefined): string {
  if (n == null) return '0'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}
// Para tutarı parse — Türk formatı: nokta binlik, virgül ondalık (1.234,56)
function parseAmount(s: string): number | null {
  const t = s.trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}
// Oran parse — hem nokta hem virgül ONDALIK kabul edilir (32.11 = 32,11 = 32.11)
function parseRate(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}

// Efektif baz: kendi bazı + birleştirilmiş çocukların bazı
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

// ─── Plan başlığı formu (oluştur / düzenle) ───────────────────────────────────
function PlanHeaderForm({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [period, setPeriod] = useState(plan?.period ?? '2026-2027')
  const [start, setStart] = useState(plan?.start_date ?? '')
  const [end, setEnd] = useState(plan?.end_date ?? '')
  const [rate, setRate] = useState(String(plan?.default_rate ?? 32.11))

  async function handleSave() {
    if (!period.trim()) { toast.error('Dönem gereklidir.'); return }
    setSaving(true)
    const payload = {
      period: period.trim(),
      start_date: start || null,
      end_date: end || null,
      default_rate: parseRate(rate) ?? 0,
    }
    const result = plan ? await updatePlan(plan.id, payload) : await createPlan(payload)
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success(plan ? 'Plan güncellendi.' : 'Plan oluşturuldu, kalemler geçen yıldan getirildi.')
    router.refresh()
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Dönem *</Label>
        <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-2027" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Başlangıç Tarihi</Label>
          <Input type="date" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bitiş Tarihi</Label>
          <Input type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Varsayılan TÜFE Oranı (%)</Label>
        <Input value={rate} onChange={e => setRate(e.target.value)} className="font-mono" placeholder="32,11" />
        <p className="text-xs text-gray-400">Yeni oluşturulacak/tohumlanan kalemlere varsayılan olarak uygulanır.</p>
      </div>
      {!plan && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          Plan oluşturulunca, geçen yılın (2025-2026 gerçekleşen) harcama kalemleri baz alınarak otomatik getirilir.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : plan ? 'Güncelle' : 'Plan Oluştur'}
        </Button>
      </div>
    </div>
  )
}

// ─── Kalem formu (ekle / düzenle) ─────────────────────────────────────────────
function PlanItemForm({ planId, item, onClose }: { planId: string; item: PlanItem | null; onClose: () => void }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState(item?.category ?? '')
  const [method, setMethod] = useState<'rate' | 'manual'>(item?.method ?? 'manual')
  const [base, setBase] = useState(item?.base_amount != null ? String(item.base_amount) : '')
  const [rate, setRate] = useState(item?.rate != null ? String(item.rate) : '')
  const [amount, setAmount] = useState(item?.planned_amount != null ? String(item.planned_amount) : '')
  const [optional, setOptional] = useState(item?.optional ? 'optional' : 'fixed')
  const [desc, setDesc] = useState(item?.description_tr ?? '')

  async function handleSave() {
    if (!category.trim()) { toast.error('Harcama konusu gereklidir.'); return }
    setSaving(true)
    const payload = {
      category: category.trim().toUpperCase(),
      method,
      base_amount: parseAmount(base),
      rate: method === 'rate' ? parseRate(rate) : null,
      planned_amount: method === 'manual' ? parseAmount(amount) : null,
      optional: optional === 'optional',
      description_tr: desc.trim() || null,
    }
    const result = item
      ? await updatePlanItem(item.id, payload)
      : await createPlanItem(planId, { ...payload, is_new: true })
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success(item ? 'Güncellendi.' : 'Kalem eklendi.')
    router.refresh()
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Harcama Konusu *</Label>
        <Input value={category} onChange={e => setCategory(e.target.value)} className="uppercase" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Hesap Yöntemi</Label>
        <Select value={method} onValueChange={v => setMethod(v as 'rate' | 'manual')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rate">Oran ile (baz × artış %)</SelectItem>
            <SelectItem value="manual">Manuel tutar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {method === 'rate' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Baz Tutar (geçen yıl)</Label>
            <Input value={base} onChange={e => setBase(e.target.value)} className="font-mono text-right" placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Artış Oranı (%)</Label>
            <Input value={rate} onChange={e => setRate(e.target.value)} className="font-mono text-right" placeholder="32,11" />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">Planlanan Tutar</Label>
          <Input value={amount} onChange={e => setAmount(e.target.value)} className="font-mono text-right" placeholder="0" />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Kalem Türü</Label>
        <Select value={optional} onValueChange={v => setOptional(v ?? 'fixed')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Sabit (kesin — her zaman dahil)</SelectItem>
            <SelectItem value="optional">Opsiyonel (Genel kurulda oylanacak)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Açıklama</Label>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="text-xs" placeholder="Opsiyonel..." />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : item ? 'Güncelle' : 'Ekle'}
        </Button>
      </div>
    </div>
  )
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export function PlanningTable({ plan, items }: { plan: Plan | null; items: PlanItem[] }) {
  const router = useRouter()
  const [headerOpen, setHeaderOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const totals = useMemo(() => {
    let fixed = 0, optional = 0
    for (const it of items) {
      const v = planned(it, items)
      if (it.optional) optional += v; else fixed += v
    }
    return { fixed, optional, grand: fixed + optional }
  }, [items])
  const totalPlanned = totals.grand

  // Plan yoksa: oluşturma kartı
  if (!plan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Planlama</h1>
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Henüz bir yıllık plan oluşturulmadı. Geçen yılın gerçekleşen giderlerini baz alarak
              gelecek dönemin işletme planını hazırlayın.
            </p>
            <Button onClick={() => setHeaderOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Yeni Plan Oluştur
            </Button>
          </CardContent>
        </Card>
        <Dialog open={headerOpen} onOpenChange={setHeaderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Yeni Yıllık Plan</DialogTitle></DialogHeader>
            <PlanHeaderForm plan={null} onClose={() => setHeaderOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const selectableIds = items.filter(i => i.status === 'active').map(i => i.id)
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function runAction(fn: () => Promise<{ error?: string; success?: boolean }>, okMsg: string) {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    if (r.error) { toast.error(r.error); return false }
    toast.success(okMsg)
    router.refresh()
    return true
  }

  async function handleRefreshBase() {
    await runAction(() => refreshPlanBase(plan!.id), 'Baz tutarlar geçen yıldan güncellendi.')
  }

  function openMerge() {
    if (selected.size < 2) { toast.error('En az 2 kalem seçin.'); return }
    // hedef varsayılan: en küçük sıra
    const sel = items.filter(i => selected.has(i.id))
    const target = sel.reduce((a, b) => (a.sort_order <= b.sort_order ? a : b))
    setMergeTarget(target.id)
  }

  async function confirmMerge() {
    if (!mergeTarget) return
    const ids = [...selected].filter(id => id !== mergeTarget)
    const ok = await runAction(() => mergePlanItems(mergeTarget, ids), 'Kalemler birleştirildi.')
    if (ok) { setSelected(new Set()); setMergeTarget(null) }
  }

  const dateLabel = plan.start_date && plan.end_date
    ? `${plan.start_date} → ${plan.end_date}`
    : plan.start_date || plan.end_date || 'tarih belirtilmemiş'

  const planCSV = [
    ...items.filter(i => i.status !== 'merged').map(it => ({
      'Harcama Konusu': it.category,
      'Tür': it.status === 'excluded' ? 'Çıkarıldı' : it.optional ? 'Opsiyonel' : 'Sabit',
      'Geçen Yıl (Baz)': effectiveBase(it, items) || null,
      'Yöntem': it.status === 'excluded' ? 'Çıkarıldı' : it.method === 'rate' ? 'Oran' : 'Manuel',
      'Oran %': it.method === 'rate' && it.status === 'active' ? it.rate : null,
      'Planlanan': planned(it, items) || null,
    })),
    { 'Harcama Konusu': 'TOPLAM', 'Tür': '', 'Geçen Yıl (Baz)': null, 'Yöntem': '', 'Oran %': null, 'Planlanan': totalPlanned },
  ]

  const selectedItems = items.filter(i => selected.has(i.id))

  return (
    <div className="space-y-6">
      {/* Yazdırmada tek sayfaya sığması için yatay sayfa */}
      <style>{'@media print{@page{size:A4 landscape;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'}</style>
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planlama — {plan.period}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {dateLabel} · Varsayılan TÜFE %{fmtRate(plan.default_rate)} · {items.filter(i => i.status !== 'merged').length} kalem
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Yazdır
          </Button>
          <CSVExportButton data={planCSV} filename={`plan-${plan.period}`} label="CSV İndir" />
          <Button size="sm" variant="outline" onClick={handleRefreshBase} disabled={busy} className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50">
            <RefreshCw className="h-3.5 w-3.5" /> Bazı Güncelle
          </Button>
          <Button size="sm" variant="outline" onClick={() => setHeaderOpen(true)} className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Plan Ayarları
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Kalem Ekle
          </Button>
        </div>
      </div>

      {/* Birleştirme çubuğu */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm print:hidden">
          <span className="text-blue-800 font-medium">{selected.size} kalem seçili</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openMerge} disabled={selected.size < 2} className="gap-1.5 text-blue-700 border-blue-300">
              <GitMerge className="h-3.5 w-3.5" /> Birleştir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Vazgeç</Button>
          </div>
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid grid-cols-3 gap-3 print:hidden">
        <Card className="border-gray-200">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-gray-500">Sabit Kalemler</CardTitle></CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-lg font-bold font-mono text-gray-800">{fmtC(totals.fixed)}</p>
            <p className="text-xs text-gray-400 mt-0.5">daire başına {totals.fixed ? fmtC(Math.round(totals.fixed / APT_COUNT)) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-gray-500">Opsiyonel (Genel Kurul)</CardTitle></CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-lg font-bold font-mono text-blue-600">{fmtC(totals.optional)}</p>
            <p className="text-xs text-gray-400 mt-0.5">daire başına {totals.optional ? fmtC(Math.round(totals.optional / APT_COUNT)) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-gray-500">Genel Toplam</CardTitle></CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-lg font-bold font-mono text-green-700">{fmtC(totals.grand)}</p>
            <p className="text-xs text-gray-400 mt-0.5">daire başına {totals.grand ? fmtC(Math.round(totals.grand / APT_COUNT)) : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tablo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-700">
            {plan.period} İşletme Planı
            <span className="text-xs font-normal text-gray-400 ml-2">(baz: 2025-2026 gerçekleşen)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="text-xs w-full min-w-[860px] print:min-w-0 print:text-[10px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-8 px-2 py-2 print:hidden" />
                  <th className="text-left px-3 py-2 font-medium text-gray-600 min-w-[240px]">Harcama Konusu</th>
                  <th className="text-right px-3 py-2 font-medium text-amber-600 whitespace-nowrap">Geçen Yıl</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Yöntem</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Oran %</th>
                  <th className="text-right px-3 py-2 font-medium text-green-600 whitespace-nowrap">Planlanan</th>
                  <th className="w-24 px-2 py-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const isOdd = i % 2 === 1
                  const bg = isOdd ? 'bg-gray-50/40' : 'bg-white'
                  const eff = effectiveBase(it, items)
                  const plannedVal = planned(it, items)
                  const mergedChildren = items.filter(c => c.merged_into === it.id && c.status === 'merged')

                  if (it.status === 'merged') {
                    const parent = items.find(p => p.id === it.merged_into)
                    return (
                      <tr key={it.id} className="border-b border-gray-100 bg-gray-50/60 text-gray-400 print:break-inside-avoid">
                        <td className="px-2 py-1.5 print:hidden" />
                        <td className="px-3 py-1.5 pl-8">
                          <span className="line-through">{it.category}</span>
                          <span className="ml-2 text-[11px] not-italic text-blue-400">↳ {parent?.category ?? 'birleştirildi'}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono line-through">{fmt(it.base_amount)}</td>
                        <td className="px-3 py-1.5 text-gray-300">birleşik</td>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 text-right font-mono text-gray-300">—</td>
                        <td className="px-2 py-1.5 print:hidden">
                          <button onClick={() => runAction(() => unmergePlanItem(it.id), 'Ayrıldı.')} title="Ayır" className="p-1 text-gray-300 hover:text-blue-500">
                            <Undo2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  }

                  const excluded = it.status === 'excluded'
                  return (
                    <tr key={it.id} className={`border-b border-gray-100 ${bg} ${excluded ? 'opacity-50' : 'hover:bg-blue-50/20'} transition-colors print:break-inside-avoid`}>
                      <td className="px-2 py-1.5 text-center print:hidden">
                        {!excluded && (
                          <input
                            type="checkbox"
                            checked={selected.has(it.id)}
                            onChange={() => toggleSelect(it.id)}
                            className="accent-blue-600"
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className={`font-medium text-gray-800 leading-tight ${excluded ? 'line-through' : ''}`}>
                          {it.category}
                          {it.optional && !excluded && <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">OPSİYONEL</span>}
                          {it.is_new && <span className="ml-2 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">YENİ</span>}
                          {mergedChildren.length > 0 && <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">+{mergedChildren.length} birleşik</span>}
                          {excluded && <span className="ml-2 text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">ÇIKARILDI</span>}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-600 whitespace-nowrap">{fmt(eff)}</td>
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{excluded ? '—' : it.method === 'rate' ? 'Oran' : 'Manuel'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-500 whitespace-nowrap">{!excluded && it.method === 'rate' ? fmtRate(it.rate) : '—'}</td>
                      <td className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${excluded ? 'text-gray-300' : 'text-green-700 font-semibold'}`}>
                        {excluded ? '0' : fmtC(plannedVal)}
                      </td>
                      <td className="px-2 py-1.5 print:hidden">
                        <div className="flex items-center gap-0.5">
                          {excluded ? (
                            <button onClick={() => runAction(() => updatePlanItem(it.id, { status: 'active' }), 'Geri alındı.')} title="Geri Al" className="p-1 text-gray-300 hover:text-green-600">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => runAction(() => updatePlanItem(it.id, { optional: !it.optional }), it.optional ? 'Sabit yapıldı.' : 'Opsiyonel yapıldı.')}
                                title={it.optional ? 'Sabit yap' : 'Opsiyonel yap (Genel kurul)'}
                                className={`p-1 transition-colors ${it.optional ? 'text-blue-500 hover:text-blue-700' : 'text-gray-300 hover:text-blue-500'}`}
                              >
                                <Vote className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setEditItem(it)} title="Düzenle" className="p-1 text-gray-300 hover:text-gray-600">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => runAction(() => updatePlanItem(it.id, { status: 'excluded' }), 'Kalem çıkarıldı.')} title="Çıkar" className="p-1 text-gray-300 hover:text-amber-600">
                                <EyeOff className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <DeleteConfirmDialog onConfirm={() => deletePlanItem(it.id)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                  <td className="px-2 py-2.5 print:hidden" />
                  <td className="px-3 py-2.5 text-xs text-gray-700">TOPLAM</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmtC(totalPlanned)}</td>
                  <td className="px-2 py-2.5 print:hidden" />
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200 text-gray-500 italic">
                  <td className="px-2 py-1.5 print:hidden" />
                  <td className="px-3 py-1.5 text-xs not-italic font-medium">Daire Başına <span className="text-gray-400 font-normal">(÷ {APT_COUNT} daire)</span></td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 text-right font-mono text-gray-600">{totalPlanned ? fmtC(Math.round(totalPlanned / APT_COUNT)) : '—'}</td>
                  <td className="px-2 py-1.5 print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Diyaloglar */}
      <Dialog open={headerOpen} onOpenChange={setHeaderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Plan Ayarları</DialogTitle></DialogHeader>
          <PlanHeaderForm plan={plan} onClose={() => setHeaderOpen(false)} />
          <div className="border-t pt-3 mt-1">
            <DeleteConfirmDialog onConfirm={() => deletePlan(plan.id)} label="Planı Sil" />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Harcama Kalemi</DialogTitle></DialogHeader>
          <PlanItemForm planId={plan.id} item={null} onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Kalem Düzenle</DialogTitle></DialogHeader>
          {editItem && <PlanItemForm key={editItem.id} planId={plan.id} item={editItem} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>

      {/* Birleştirme onayı */}
      <Dialog open={!!mergeTarget} onOpenChange={v => { if (!v) setMergeTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Kalemleri Birleştir</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Seçilen kalemler tek bir hedef kalemde toplanacak. Hedef kalemi seçin:</p>
            <Select value={mergeTarget ?? undefined} onValueChange={setMergeTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {selectedItems.map(it => (
                  <SelectItem key={it.id} value={it.id}>{it.category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">
              Diğer kalemler bu hedefe eklenir (bazları toplanır) ve listede “birleşik” olarak gösterilir. İstediğinizde geri alabilirsiniz.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setMergeTarget(null)}>İptal</Button>
              <Button size="sm" onClick={confirmMerge} disabled={busy}>Birleştir</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
