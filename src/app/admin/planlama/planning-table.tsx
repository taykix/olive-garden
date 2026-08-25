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

// ─── Dil (sayfa içi TR/EN geçişi — global admin dilinden bağımsız) ────────────
type Lang = 'tr' | 'en'

const DICT = {
  tr: {
    planning: 'Planlama',
    noPlanDesc: 'Henüz bir yıllık plan oluşturulmadı. Geçen yılın gerçekleşen giderlerini baz alarak gelecek dönemin işletme planını hazırlayın.',
    newPlan: 'Yeni Plan Oluştur',
    newAnnualPlan: 'Yeni Yıllık Plan',
    defaultCPI: 'Varsayılan TÜFE',
    items: 'kalem',
    print: 'Yazdır',
    csv: 'CSV İndir',
    refreshBase: 'Bazı Güncelle',
    planSettings: 'Plan Ayarları',
    addItem: 'Kalem Ekle',
    selectedN: (n: number) => `${n} kalem seçili`,
    merge: 'Birleştir',
    dismiss: 'Vazgeç',
    fixedItems: 'Sabit Kalemler',
    perApt: 'daire başına',
    optionalGA: 'Opsiyonel (Genel Kurul)',
    grandTotal: 'Genel Toplam',
    operatingPlan: 'İşletme Planı',
    baseNote: '(baz: 2025-2026 gerçekleşen)',
    rateInfo: 'Bu sene için harcamalar, yıllık belirlenen TÜFE oranı geçen yılın gerçekleşen harcamalarına eklenerek oluşturulmuştur.',
    assemblyNote1: 'Genel kurulda alınan karara göre bu dönem yıllık aidat 50.000 TL olarak belirlenmiştir.',
    assemblyNote2: 'Artan miktar, çatı onarımı gibi ekstra proje maliyetlerinde yıl içinde sitenin ihtiyacına göre planlanacaktır.',
    removedNote: 'Not: Geçen senenin işletme planında adı geçen (harcama yapılmış ya da yapılmamış), bu sene plana dâhil edilmeyecek başlıklar çıkarılmıştır.',
    colItem: 'Harcama Konusu',
    colLastYear: 'Geçen Yıl',
    colMethod: 'Yöntem',
    colRate: 'Oran %',
    colPlanned: 'Planlanan',
    methodRate: 'Oran',
    methodManual: 'Manuel',
    badgeOptional: 'OPSİYONEL',
    badgeNew: 'YENİ',
    badgeMerged: (n: number) => `+${n} birleşik`,
    badgeExcluded: 'ÇIKARILDI',
    merged: 'birleşik',
    mergedInto: 'birleştirildi',
    total: 'TOPLAM',
    perAptRow: 'Daire Başına',
    aptsDiv: (n: number) => `(÷ ${n} daire)`,
    tUnmerge: 'Ayır',
    tRestore: 'Geri Al',
    tSetFixed: 'Sabit yap',
    tSetOptional: 'Opsiyonel yap (Genel kurul)',
    tEdit: 'Düzenle',
    tExclude: 'Çıkar',
    newExpenseItem: 'Yeni Harcama Kalemi',
    editItemTitle: 'Kalem Düzenle',
    mergeItemsTitle: 'Kalemleri Birleştir',
    mergePrompt: 'Seçilen kalemler tek bir hedef kalemde toplanacak. Hedef kalemi seçin:',
    mergeNote: 'Diğer kalemler bu hedefe eklenir (bazları toplanır) ve listede “birleşik” olarak gösterilir. İstediğinizde geri alabilirsiniz.',
    deletePlan: 'Planı Sil',
    noDate: 'tarih belirtilmemiş',
    period: 'Dönem *',
    startDate: 'Başlangıç Tarihi',
    endDate: 'Bitiş Tarihi',
    defaultCPIrate: 'Varsayılan TÜFE Oranı (%)',
    defaultCPIhint: 'Yeni oluşturulacak/tohumlanan kalemlere varsayılan olarak uygulanır.',
    createHint: 'Plan oluşturulunca, geçen yılın (2025-2026 gerçekleşen) harcama kalemleri baz alınarak otomatik getirilir.',
    cancel: 'İptal',
    saving: 'Kaydediliyor...',
    update: 'Güncelle',
    createPlanBtn: 'Plan Oluştur',
    expenseItem: 'Harcama Konusu *',
    expenseItemEn: 'Harcama Konusu (EN)',
    expenseItemEnPh: 'İngilizce ad — sakinlerin İngilizce görünümü için',
    calcMethod: 'Hesap Yöntemi',
    methodRateOpt: 'Oran ile (baz × artış %)',
    methodManualOpt: 'Manuel tutar',
    baseAmount: 'Baz Tutar (geçen yıl)',
    increaseRate: 'Artış Oranı (%)',
    plannedAmount: 'Planlanan Tutar',
    itemType: 'Kalem Türü',
    fixedOpt: 'Sabit (kesin — her zaman dahil)',
    optionalOpt: 'Opsiyonel (Genel kurulda oylanacak)',
    description: 'Açıklama',
    optionalPh: 'Opsiyonel...',
    add: 'Ekle',
    // toasts
    periodRequired: 'Dönem gereklidir.',
    planUpdated: 'Plan güncellendi.',
    planCreated: 'Plan oluşturuldu, kalemler geçen yıldan getirildi.',
    itemRequired: 'Harcama konusu gereklidir.',
    updated: 'Güncellendi.',
    itemAdded: 'Kalem eklendi.',
    baseUpdated: 'Baz tutarlar geçen yıldan güncellendi.',
    min2: 'En az 2 kalem seçin.',
    mergedT: 'Kalemler birleştirildi.',
    unmergedT: 'Ayrıldı.',
    restoredT: 'Geri alındı.',
    setFixedT: 'Sabit yapıldı.',
    setOptionalT: 'Opsiyonel yapıldı.',
    excludedT: 'Kalem çıkarıldı.',
    csvType: 'Tür', csvBase: 'Geçen Yıl (Baz)', csvMethod: 'Yöntem', csvRate: 'Oran %', csvPlanned: 'Planlanan',
    csvExcluded: 'Çıkarıldı', csvOptional: 'Opsiyonel', csvFixed: 'Sabit',
  },
  en: {
    planning: 'Planning',
    noPlanDesc: "No annual plan has been created yet. Prepare the operating plan for the upcoming period based on last year's actual expenses.",
    newPlan: 'Create New Plan',
    newAnnualPlan: 'New Annual Plan',
    defaultCPI: 'Default CPI',
    items: 'items',
    print: 'Print',
    csv: 'CSV Download',
    refreshBase: 'Refresh Base',
    planSettings: 'Plan Settings',
    addItem: 'Add Item',
    selectedN: (n: number) => `${n} items selected`,
    merge: 'Merge',
    dismiss: 'Dismiss',
    fixedItems: 'Fixed Items',
    perApt: 'per apartment',
    optionalGA: 'Optional (General Assembly)',
    grandTotal: 'Grand Total',
    operatingPlan: 'Operating Plan',
    baseNote: '(base: 2025-2026 actuals)',
    rateInfo: "This year's expenses are created by adding the annually determined CPI (inflation) rate to last year's actual spending.",
    assemblyNote1: 'By resolution of the general assembly, the annual dues for this period have been set at 50,000 TL.',
    assemblyNote2: "The surplus will be allocated during the year, according to the community's needs, to extra project costs such as roof repair.",
    removedNote: "Note: Titles listed in last year's operating plan (whether spent or not) that will not be included in this year's plan have been removed.",
    colItem: 'Expense Item',
    colLastYear: 'Last Year',
    colMethod: 'Method',
    colRate: 'Rate %',
    colPlanned: 'Planned',
    methodRate: 'Rate',
    methodManual: 'Manual',
    badgeOptional: 'OPTIONAL',
    badgeNew: 'NEW',
    badgeMerged: (n: number) => `+${n} merged`,
    badgeExcluded: 'EXCLUDED',
    merged: 'merged',
    mergedInto: 'merged',
    total: 'TOTAL',
    perAptRow: 'Per Apartment',
    aptsDiv: (n: number) => `(÷ ${n} apartments)`,
    tUnmerge: 'Unmerge',
    tRestore: 'Restore',
    tSetFixed: 'Set as fixed',
    tSetOptional: 'Set as optional (GA)',
    tEdit: 'Edit',
    tExclude: 'Exclude',
    newExpenseItem: 'New Expense Item',
    editItemTitle: 'Edit Item',
    mergeItemsTitle: 'Merge Items',
    mergePrompt: 'The selected items will be combined into one target item. Choose the target:',
    mergeNote: 'The other items are added to this target (their bases are summed) and shown as “merged” in the list. You can undo anytime.',
    deletePlan: 'Delete Plan',
    noDate: 'date not set',
    period: 'Period *',
    startDate: 'Start Date',
    endDate: 'End Date',
    defaultCPIrate: 'Default CPI Rate (%)',
    defaultCPIhint: 'Applied by default to newly created / seeded items.',
    createHint: "When the plan is created, last year's (2025-2026 actual) expense items are imported automatically as the base.",
    cancel: 'Cancel',
    saving: 'Saving...',
    update: 'Update',
    createPlanBtn: 'Create Plan',
    expenseItem: 'Expense Item *',
    expenseItemEn: 'Expense Item (EN)',
    expenseItemEnPh: "English name — for residents' English view",
    calcMethod: 'Calculation Method',
    methodRateOpt: 'By rate (base × increase %)',
    methodManualOpt: 'Manual amount',
    baseAmount: 'Base Amount (last year)',
    increaseRate: 'Increase Rate (%)',
    plannedAmount: 'Planned Amount',
    itemType: 'Item Type',
    fixedOpt: 'Fixed (always included)',
    optionalOpt: 'Optional (voted at general assembly)',
    description: 'Description',
    optionalPh: 'Optional...',
    add: 'Add',
    // toasts
    periodRequired: 'Period is required.',
    planUpdated: 'Plan updated.',
    planCreated: 'Plan created; items imported from last year.',
    itemRequired: 'Expense item is required.',
    updated: 'Updated.',
    itemAdded: 'Item added.',
    baseUpdated: 'Base amounts refreshed from last year.',
    min2: 'Select at least 2 items.',
    mergedT: 'Items merged.',
    unmergedT: 'Unmerged.',
    restoredT: 'Restored.',
    setFixedT: 'Set as fixed.',
    setOptionalT: 'Set as optional.',
    excludedT: 'Item excluded.',
    csvType: 'Type', csvBase: 'Last Year (Base)', csvMethod: 'Method', csvRate: 'Rate %', csvPlanned: 'Planned',
    csvExcluded: 'Excluded', csvOptional: 'Optional', csvFixed: 'Fixed',
  },
} as const

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
function fmtC(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}
function fmtRate(n: number | null | undefined): string {
  if (n == null) return '0'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}
function parseAmount(s: string): number | null {
  const t = s.trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}
function parseRate(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = parseFloat(t)
  return isNaN(n) ? null : n
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

// ─── Plan başlığı formu ───────────────────────────────────────────────────────
function PlanHeaderForm({ plan, lang, onClose }: { plan: Plan | null; lang: Lang; onClose: () => void }) {
  const L = DICT[lang]
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [period, setPeriod] = useState(plan?.period ?? '2026-2027')
  const [start, setStart] = useState(plan?.start_date ?? '')
  const [end, setEnd] = useState(plan?.end_date ?? '')
  const [rate, setRate] = useState(String(plan?.default_rate ?? 32.11))

  async function handleSave() {
    if (!period.trim()) { toast.error(L.periodRequired); return }
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
    toast.success(plan ? L.planUpdated : L.planCreated)
    router.refresh()
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">{L.period}</Label>
        <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-2027" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{L.startDate}</Label>
          <Input type="date" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{L.endDate}</Label>
          <Input type="date" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{L.defaultCPIrate}</Label>
        <Input value={rate} onChange={e => setRate(e.target.value)} className="font-mono" placeholder="32,11" />
        <p className="text-xs text-gray-400">{L.defaultCPIhint}</p>
      </div>
      {!plan && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{L.createHint}</p>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>{L.cancel}</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? L.saving : plan ? L.update : L.createPlanBtn}
        </Button>
      </div>
    </div>
  )
}

// ─── Kalem formu ──────────────────────────────────────────────────────────────
function PlanItemForm({ planId, item, lang, onClose }: { planId: string; item: PlanItem | null; lang: Lang; onClose: () => void }) {
  const L = DICT[lang]
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState(item?.category ?? '')
  const [categoryEn, setCategoryEn] = useState(item?.category_en ?? '')
  const [method, setMethod] = useState<'rate' | 'manual'>(item?.method ?? 'manual')
  const [base, setBase] = useState(item?.base_amount != null ? String(item.base_amount) : '')
  const [rate, setRate] = useState(item?.rate != null ? String(item.rate) : '')
  const [amount, setAmount] = useState(item?.planned_amount != null ? String(item.planned_amount) : '')
  const [optional, setOptional] = useState(item?.optional ? 'optional' : 'fixed')
  const [desc, setDesc] = useState(item?.description_tr ?? '')

  async function handleSave() {
    if (!category.trim()) { toast.error(L.itemRequired); return }
    setSaving(true)
    const payload = {
      category: category.trim().toUpperCase(),
      category_en: categoryEn.trim().toUpperCase() || null,
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
    toast.success(item ? L.updated : L.itemAdded)
    router.refresh()
    onClose()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">{L.expenseItem}</Label>
        <Input value={category} onChange={e => setCategory(e.target.value)} className="uppercase" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{L.expenseItemEn}</Label>
        <Input value={categoryEn} onChange={e => setCategoryEn(e.target.value)} className="uppercase text-xs" placeholder={L.expenseItemEnPh} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{L.calcMethod}</Label>
        <Select value={method} onValueChange={v => setMethod(v as 'rate' | 'manual')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rate">{L.methodRateOpt}</SelectItem>
            <SelectItem value="manual">{L.methodManualOpt}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {method === 'rate' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{L.baseAmount}</Label>
            <Input value={base} onChange={e => setBase(e.target.value)} className="font-mono text-right" placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{L.increaseRate}</Label>
            <Input value={rate} onChange={e => setRate(e.target.value)} className="font-mono text-right" placeholder="32,11" />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">{L.plannedAmount}</Label>
          <Input value={amount} onChange={e => setAmount(e.target.value)} className="font-mono text-right" placeholder="0" />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">{L.itemType}</Label>
        <Select value={optional} onValueChange={v => setOptional(v ?? 'fixed')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">{L.fixedOpt}</SelectItem>
            <SelectItem value="optional">{L.optionalOpt}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{L.description}</Label>
        <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="text-xs" placeholder={L.optionalPh} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>{L.cancel}</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? L.saving : item ? L.update : L.add}
        </Button>
      </div>
    </div>
  )
}

// ─── Dil geçişi düğmesi ───────────────────────────────────────────────────────
function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex rounded-md border overflow-hidden print:hidden">
      {(['tr', 'en'] as Lang[]).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${lang === l ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export function PlanningTable({ plan, items }: { plan: Plan | null; items: PlanItem[] }) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('tr')
  const L = DICT[lang]
  const [headerOpen, setHeaderOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const catLabel = (it: PlanItem) => (lang === 'en' && it.category_en ? it.category_en : it.category)

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{L.planning}</h1>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-gray-500 text-sm max-w-md mx-auto">{L.noPlanDesc}</p>
            <Button onClick={() => setHeaderOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> {L.newPlan}
            </Button>
          </CardContent>
        </Card>
        <Dialog open={headerOpen} onOpenChange={setHeaderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{L.newAnnualPlan}</DialogTitle></DialogHeader>
            <PlanHeaderForm plan={null} lang={lang} onClose={() => setHeaderOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

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
    await runAction(() => refreshPlanBase(plan!.id), L.baseUpdated)
  }

  function openMerge() {
    if (selected.size < 2) { toast.error(L.min2); return }
    const sel = items.filter(i => selected.has(i.id))
    const target = sel.reduce((a, b) => (a.sort_order <= b.sort_order ? a : b))
    setMergeTarget(target.id)
  }

  async function confirmMerge() {
    if (!mergeTarget) return
    const ids = [...selected].filter(id => id !== mergeTarget)
    const ok = await runAction(() => mergePlanItems(mergeTarget, ids), L.mergedT)
    if (ok) { setSelected(new Set()); setMergeTarget(null) }
  }

  const dateLabel = plan.start_date && plan.end_date
    ? `${plan.start_date} → ${plan.end_date}`
    : plan.start_date || plan.end_date || L.noDate

  const planCSV = [
    ...items.filter(i => i.status !== 'merged').map(it => ({
      [L.colItem]: catLabel(it),
      [L.csvType]: it.status === 'excluded' ? L.csvExcluded : it.optional ? L.csvOptional : L.csvFixed,
      [L.csvBase]: effectiveBase(it, items) || null,
      [L.csvMethod]: it.status === 'excluded' ? L.csvExcluded : it.method === 'rate' ? L.methodRate : L.methodManual,
      [L.csvRate]: it.method === 'rate' && it.status === 'active' ? it.rate : null,
      [L.csvPlanned]: planned(it, items) || null,
    })),
    { [L.colItem]: L.total, [L.csvType]: '', [L.csvBase]: null, [L.csvMethod]: '', [L.csvRate]: null, [L.csvPlanned]: totalPlanned },
  ]

  const selectedItems = items.filter(i => selected.has(i.id))

  return (
    <div className="space-y-6">
      {/* Yazdırmada tek sayfaya sığması için yatay sayfa */}
      <style>{'@media print{@page{size:A4 landscape;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'}</style>
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{L.planning} — {plan.period}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {dateLabel} · {L.defaultCPI} %{fmtRate(plan.default_rate)} · {items.filter(i => i.status !== 'merged').length} {L.items}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <LangToggle lang={lang} setLang={setLang} />
          <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> {L.print}
          </Button>
          <CSVExportButton data={planCSV} filename={`plan-${plan.period}`} label={L.csv} />
          <Button size="sm" variant="outline" onClick={handleRefreshBase} disabled={busy} className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50">
            <RefreshCw className="h-3.5 w-3.5" /> {L.refreshBase}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setHeaderOpen(true)} className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> {L.planSettings}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {L.addItem}
          </Button>
        </div>
      </div>

      {/* Genel kurul kararı bilgi notu */}
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        <p className="font-medium">{L.assemblyNote1}</p>
        <p className="mt-1 text-green-800">{L.assemblyNote2}</p>
      </div>

      {/* Birleştirme çubuğu */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm print:hidden">
          <span className="text-blue-800 font-medium">{L.selectedN(selected.size)}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openMerge} disabled={selected.size < 2} className="gap-1.5 text-blue-700 border-blue-300">
              <GitMerge className="h-3.5 w-3.5" /> {L.merge}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{L.dismiss}</Button>
          </div>
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid grid-cols-3 gap-3 print:hidden">
        <Card className="border-gray-200">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-gray-500">{L.fixedItems}</CardTitle></CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-lg font-bold font-mono text-gray-800">{fmtC(totals.fixed)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{L.perApt} {totals.fixed ? fmtC(Math.round(totals.fixed / APT_COUNT)) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-100">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-gray-500">{L.optionalGA}</CardTitle></CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-lg font-bold font-mono text-blue-600">{fmtC(totals.optional)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{L.perApt} {totals.optional ? fmtC(Math.round(totals.optional / APT_COUNT)) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-gray-500">{L.grandTotal}</CardTitle></CardHeader>
          <CardContent className="pb-4 px-4">
            <p className="text-lg font-bold font-mono text-green-700">{fmtC(totals.grand)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{L.perApt} {totals.grand ? fmtC(Math.round(totals.grand / APT_COUNT)) : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tablo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-700">
            {plan.period} {L.operatingPlan}
            <span className="text-xs font-normal text-gray-400 ml-2">{L.baseNote}</span>
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1 max-w-3xl">{L.rateInfo}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="text-xs w-full min-w-[860px] print:min-w-0 print:text-[10px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-8 px-2 py-2 print:hidden" />
                  <th className="text-left px-3 py-2 font-medium text-gray-600 min-w-[240px]">{L.colItem}</th>
                  <th className="text-right px-3 py-2 font-medium text-amber-600 whitespace-nowrap">{L.colLastYear}</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">{L.colMethod}</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500 whitespace-nowrap">{L.colRate}</th>
                  <th className="text-right px-3 py-2 font-medium text-green-600 whitespace-nowrap">{L.colPlanned}</th>
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
                          <span className="line-through">{catLabel(it)}</span>
                          <span className="ml-2 text-[11px] not-italic text-blue-400">↳ {parent ? catLabel(parent) : L.mergedInto}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono line-through">{fmt(it.base_amount)}</td>
                        <td className="px-3 py-1.5 text-gray-300">{L.merged}</td>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 text-right font-mono text-gray-300">—</td>
                        <td className="px-2 py-1.5 print:hidden">
                          <button onClick={() => runAction(() => unmergePlanItem(it.id), L.unmergedT)} title={L.tUnmerge} className="p-1 text-gray-300 hover:text-blue-500">
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
                          {catLabel(it)}
                          {it.optional && !excluded && <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{L.badgeOptional}</span>}
                          {it.is_new && <span className="ml-2 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{L.badgeNew}</span>}
                          {mergedChildren.length > 0 && <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{L.badgeMerged(mergedChildren.length)}</span>}
                          {excluded && <span className="ml-2 text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{L.badgeExcluded}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-600 whitespace-nowrap">{fmt(eff)}</td>
                      <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{excluded ? '—' : it.method === 'rate' ? L.methodRate : L.methodManual}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-500 whitespace-nowrap">{!excluded && it.method === 'rate' ? fmtRate(it.rate) : '—'}</td>
                      <td className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${excluded ? 'text-gray-300' : 'text-green-700 font-semibold'}`}>
                        {excluded ? '0' : fmtC(plannedVal)}
                      </td>
                      <td className="px-2 py-1.5 print:hidden">
                        <div className="flex items-center gap-0.5">
                          {excluded ? (
                            <button onClick={() => runAction(() => updatePlanItem(it.id, { status: 'active' }), L.restoredT)} title={L.tRestore} className="p-1 text-gray-300 hover:text-green-600">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => runAction(() => updatePlanItem(it.id, { optional: !it.optional }), it.optional ? L.setFixedT : L.setOptionalT)}
                                title={it.optional ? L.tSetFixed : L.tSetOptional}
                                className={`p-1 transition-colors ${it.optional ? 'text-blue-500 hover:text-blue-700' : 'text-gray-300 hover:text-blue-500'}`}
                              >
                                <Vote className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setEditItem(it)} title={L.tEdit} className="p-1 text-gray-300 hover:text-gray-600">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => runAction(() => updatePlanItem(it.id, { status: 'excluded' }), L.excludedT)} title={L.tExclude} className="p-1 text-gray-300 hover:text-amber-600">
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
                  <td className="px-3 py-2.5 text-xs text-gray-700">{L.total}</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right font-mono text-green-700">{fmtC(totalPlanned)}</td>
                  <td className="px-2 py-2.5 print:hidden" />
                </tr>
                <tr className="bg-gray-50 border-t border-gray-200 text-gray-500 italic">
                  <td className="px-2 py-1.5 print:hidden" />
                  <td className="px-3 py-1.5 text-xs not-italic font-medium">{L.perAptRow} <span className="text-gray-400 font-normal">{L.aptsDiv(APT_COUNT)}</span></td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 text-right font-mono text-gray-600">{totalPlanned ? fmtC(Math.round(totalPlanned / APT_COUNT)) : '—'}</td>
                  <td className="px-2 py-1.5 print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 italic px-4 py-2">{L.removedNote}</p>
        </CardContent>
      </Card>

      {/* Diyaloglar */}
      <Dialog open={headerOpen} onOpenChange={setHeaderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{L.planSettings}</DialogTitle></DialogHeader>
          <PlanHeaderForm plan={plan} lang={lang} onClose={() => setHeaderOpen(false)} />
          <div className="border-t pt-3 mt-1">
            <DeleteConfirmDialog onConfirm={() => deletePlan(plan.id)} label={L.deletePlan} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{L.newExpenseItem}</DialogTitle></DialogHeader>
          <PlanItemForm planId={plan.id} item={null} lang={lang} onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{L.editItemTitle}</DialogTitle></DialogHeader>
          {editItem && <PlanItemForm key={editItem.id} planId={plan.id} item={editItem} lang={lang} onClose={() => setEditItem(null)} />}
        </DialogContent>
      </Dialog>

      {/* Birleştirme onayı */}
      <Dialog open={!!mergeTarget} onOpenChange={v => { if (!v) setMergeTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{L.mergeItemsTitle}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{L.mergePrompt}</p>
            <Select value={mergeTarget ?? undefined} onValueChange={setMergeTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {selectedItems.map(it => (
                  <SelectItem key={it.id} value={it.id}>{catLabel(it)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400">{L.mergeNote}</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setMergeTarget(null)}>{L.cancel}</Button>
              <Button size="sm" onClick={confirmMerge} disabled={busy}>{L.merge}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
