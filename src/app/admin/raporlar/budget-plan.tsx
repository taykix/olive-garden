'use client'

import { useState, useMemo, useRef } from 'react'
import { BudgetItem, Expense } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { createBudgetItem, updateBudgetItem, deleteBudgetItem, bulkUpsertBudgetItems } from '@/lib/supabase/actions'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { Eye, Pencil, Plus, Upload } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_START = '2025-10-01'
const PERIOD_END   = '2026-08-31'
const APT_COUNT    = 42

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
}

function parseAmount(s: string): number | null {
  const trimmed = s.trim().replace(/\./g, '').replace(',', '.')
  if (!trimmed) return null
  const n = parseFloat(trimmed)
  return isNaN(n) ? null : n
}

function computeActual(itemId: string, expenses: Expense[]): { amount: number; list: Expense[] } {
  const list = expenses.filter(
    e => e.date >= PERIOD_START && e.date <= PERIOD_END && e.budget_item_id === itemId
  )
  const amount = list.reduce((s, e) => s + Number(e.amount), 0)
  return { amount, list }
}

// ─── CSV import helpers ───────────────────────────────────────────────────────

interface CsvRow {
  category: string
  sort_order: number
  plan_2023_2024: number | null
  actual_2023_2024: number | null
  plan_2024_2025: number | null
  actual_2024_2025: number | null
  plan_2025_2026: number | null
}

function parseCsvNum(s: string | undefined): number | null {
  if (!s?.trim() || /^[-—]$/.test(s.trim())) return null
  const n = parseFloat(s.trim().replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  cols.push(cur.trim())
  return cols
}

function parseBudgetCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const rows: CsvRow[] = []
  let sortOrder = 0

  for (const line of lines) {
    const cols = line.includes('\t')
      ? line.split('\t').map(c => c.trim())
      : parseCsvLine(line)

    const category = cols[0]?.trim() ?? ''
    // Skip header / total / per-apt rows
    if (!category || /^harcama\s*konusu|^toplam|^daire ba|^zorunlu\s*har|^expense items/i.test(category)) continue

    sortOrder++
    rows.push({
      category,
      sort_order: sortOrder,
      plan_2023_2024:   parseCsvNum(cols[1]),
      actual_2023_2024: parseCsvNum(cols[2]),
      plan_2024_2025:   parseCsvNum(cols[3]),
      actual_2024_2025: parseCsvNum(cols[4]),
      plan_2025_2026:   parseCsvNum(cols[5]),
    })
  }
  return rows
}

// ─── BudgetItemForm ───────────────────────────────────────────────────────────

function BudgetItemForm({
  item,
  nextSortOrder,
  onClose,
}: {
  item: BudgetItem | null
  nextSortOrder: number
  onClose: () => void
}) {
  const [saving, setSaving]     = useState(false)
  const [category, setCategory] = useState(item?.category ?? '')
  const [categoryEn, setCategoryEn] = useState(item?.category_en ?? '')
  const [sortOrder, setSortOrder] = useState(String(item?.sort_order ?? nextSortOrder))
  const [p23, setP23] = useState(item?.plan_2023_2024 != null ? String(item.plan_2023_2024) : '')
  const [a23, setA23] = useState(item?.actual_2023_2024 != null ? String(item.actual_2023_2024) : '')
  const [p24, setP24] = useState(item?.plan_2024_2025 != null ? String(item.plan_2024_2025) : '')
  const [a24, setA24] = useState(item?.actual_2024_2025 != null ? String(item.actual_2024_2025) : '')
  const [p25, setP25] = useState(item?.plan_2025_2026 != null ? String(item.plan_2025_2026) : '')
  const [descTr, setDescTr] = useState(item?.description_tr ?? '')
  const [descEn, setDescEn] = useState(item?.description_en ?? '')

  async function handleSave() {
    if (!category.trim()) { toast.error('Harcama konusu gereklidir.'); return }
    setSaving(true)
    const payload = {
      category:          category.trim().toUpperCase(),
      category_en:       categoryEn.trim() || null,
      sort_order:        parseInt(sortOrder) || 0,
      plan_2023_2024:    parseAmount(p23),
      actual_2023_2024:  parseAmount(a23),
      plan_2024_2025:    parseAmount(p24),
      actual_2024_2025:  parseAmount(a24),
      plan_2025_2026:    parseAmount(p25),
      expense_categories: item?.expense_categories ?? [],
      description_tr:    descTr.trim() || null,
      description_en:    descEn.trim() || null,
    }
    const result = item
      ? await updateBudgetItem(item.id, payload)
      : await createBudgetItem(payload)
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success(item ? 'Güncellendi.' : 'Eklendi.')
    onClose()
  }

  const numCls = 'h-7 text-xs font-mono text-right'

  return (
    <div className="space-y-5">

      {/* Names */}
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Harcama Konusu (TR) *</Label>
          <Input value={category} onChange={e => setCategory(e.target.value)} className="uppercase" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-4 space-y-1">
            <Label className="text-xs">Harcama Konusu (EN)</Label>
            <Input value={categoryEn} onChange={e => setCategoryEn(e.target.value)} className="text-xs uppercase" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sıra</Label>
            <Input type="number" min={0} value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={numCls} />
          </div>
        </div>
      </div>

      {/* Historical amounts */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Geçmiş Dönemler</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">2023-2024 Planlanan</Label>
            <Input type="number" min={0} step={1000} value={p23} onChange={e => setP23(e.target.value)} className={numCls} placeholder="—" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">2023-2024 Gerçekleşen</Label>
            <Input type="number" min={0} step={1000} value={a23} onChange={e => setA23(e.target.value)} className={numCls} placeholder="—" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">2024-2025 Planlanan</Label>
            <Input type="number" min={0} step={1000} value={p24} onChange={e => setP24(e.target.value)} className={numCls} placeholder="—" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">2024-2025 Gerçekleşen</Label>
            <Input type="number" min={0} step={1000} value={a24} onChange={e => setA24(e.target.value)} className={numCls} placeholder="—" />
          </div>
        </div>
      </div>

      {/* Current period */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-green-700">2025-2026 Planlanan</Label>
        <Input type="number" min={0} step={1000} value={p25} onChange={e => setP25(e.target.value)} className={`${numCls} border-green-200 focus:border-green-400`} placeholder="—" />
        <p className="text-xs text-gray-400">Gerçekleşen tutar aşağıdaki gider kategorilerinden otomatik hesaplanır.</p>
      </div>

      {/* Description */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Açıklama (TR)</Label>
          <Textarea value={descTr} onChange={e => setDescTr(e.target.value)} rows={3} placeholder="Opsiyonel..." className="text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Açıklama (EN)</Label>
          <Textarea value={descEn} onChange={e => setDescEn(e.target.value)} rows={3} placeholder="Optional..." className="text-xs" />
        </div>
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

// ─── ExpensesDialog ───────────────────────────────────────────────────────────

function ExpensesDialog({ item, expenses }: { item: BudgetItem; expenses: Expense[] }) {
  const { amount, list } = computeActual(item.id, expenses)
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 text-xs">
          {list.length} gider kaydı · {item.category}
        </span>
        <span className="font-bold text-red-600">{formatCurrency(amount)}</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Bu kategorilerde 2025-2026 dönemi gideri bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white border-b border-gray-200">
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Tarih</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Başlık</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Kategori</th>
                <th className="text-right px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => (
                <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-500">{e.date}</td>
                  <td className="px-3 py-1.5 max-w-[250px] truncate">{e.title}</td>
                  <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{e.category ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(Number(e.amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-gray-600">Toplam ({sorted.length} gider)</td>
                <td className="px-3 py-2 text-right font-mono text-red-600">{formatCurrency(amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── BudgetPlan (main export) ─────────────────────────────────────────────────

interface Props {
  items: BudgetItem[]
  expenses: Expense[]
}

export function BudgetPlan({ items, expenses }: Props) {
  const [addOpen, setAddOpen]       = useState(false)
  const [editItem, setEditItem]     = useState<BudgetItem | null>(null)
  const [viewItem, setViewItem]     = useState<BudgetItem | null>(null)
  const [importing, setImporting]   = useState(false)
  const fileRef                     = useRef<HTMLInputElement>(null)

  async function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)

    const text = await file.text()
    const csvRows = parseBudgetCsv(text)

    if (!csvRows.length) {
      toast.error('CSV okunamadı — beklenen sütunlar: Harcama Konusu, 2023-24 Plan, Gerçekleşen, 2024-25 Plan, Gerçekleşen, 2025-26 Plan')
      setImporting(false)
      e.target.value = ''
      return
    }

    const upsertRows = csvRows.map(row => {
      const existing = items.find(item => item.sort_order === row.sort_order)
      return {
        id:               existing?.id,
        ...row,
        expense_categories: existing?.expense_categories ?? [],
        category_en:      existing?.category_en ?? null,
        description_tr:   existing?.description_tr ?? null,
        description_en:   existing?.description_en ?? null,
      }
    })

    const result = await bulkUpsertBudgetItems(upsertRows)
    setImporting(false)
    e.target.value = ''

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${result.count} kalem aktarıldı.`)
    }
  }

  // Compute 2025-2026 actuals per item
  const actuals = useMemo(() => {
    const map = new Map<string, { amount: number; list: Expense[] }>()
    for (const item of items) {
      map.set(item.id, computeActual(item.id, expenses))
    }
    return map
  }, [items, expenses])

  // Column totals
  const totals = useMemo(() => {
    let p23 = 0, a23 = 0, p24 = 0, a24 = 0, p25 = 0, a25 = 0
    for (const item of items) {
      p23 += item.plan_2023_2024   ?? 0
      a23 += item.actual_2023_2024 ?? 0
      p24 += item.plan_2024_2025   ?? 0
      a24 += item.actual_2024_2025 ?? 0
      p25 += item.plan_2025_2026   ?? 0
      a25 += actuals.get(item.id)?.amount ?? 0
    }
    return { p23, a23, p24, a24, p25, a25 }
  }, [items, actuals])

  const nextSortOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1

  const th = 'px-2 py-2 text-xs font-medium text-gray-500 text-right whitespace-nowrap'
  const td = 'px-2 py-1.5 text-xs font-mono text-right whitespace-nowrap'

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm text-gray-700">Yıllık İşletme Planı</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">2023–2026 dönemi · {items.length} harcama kalemi · 2025-2026 gerçekleşen gider sisteminden otomatik hesaplanır</p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {importing ? 'Aktarılıyor...' : 'CSV Aktar'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.txt"
                className="hidden"
                onChange={handleCSVFile}
              />
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Kalem Ekle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="text-xs w-full min-w-[900px]">
              <thead>
                {/* Period group row */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-50 z-10 text-left px-3 py-2 text-xs font-semibold text-gray-600 border-r border-gray-200 min-w-[240px]">
                    HARCAMA KONUSU
                  </th>
                  <th colSpan={2} className="text-center px-2 py-2 text-xs font-medium text-gray-400 border-r border-gray-100">2023-2024</th>
                  <th colSpan={2} className="text-center px-2 py-2 text-xs font-medium text-gray-400 border-r border-gray-100">2024-2025</th>
                  <th colSpan={2} className="text-center px-2 py-2 text-xs font-semibold text-green-600">2025-2026</th>
                  <th className="print:hidden w-16" />
                </tr>
                {/* Column labels */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 bg-gray-50 z-10 border-r border-gray-200" />
                  <th className={th}>Planlanan</th>
                  <th className={`${th} border-r border-gray-100`}>Gerçekleşen</th>
                  <th className={th}>Planlanan</th>
                  <th className={`${th} border-r border-gray-100`}>Gerçekleşen</th>
                  <th className={`${th} text-green-600`}>Planlanan</th>
                  <th className={`${th} text-green-700 font-semibold bg-green-50/30`}>Gerçekleşen ✦</th>
                  <th className="print:hidden px-2 w-16" />
                </tr>
              </thead>

              <tbody>
                {items.map((item, i) => {
                  const actual    = actuals.get(item.id)
                  const bg        = i % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'
                  const hasActual = (actual?.amount ?? 0) > 0
                  return (
                    <tr key={item.id} className={`border-b border-gray-100 last:border-0 ${bg} hover:bg-blue-50/20 transition-colors`}>
                      <td className={`sticky left-0 z-10 px-3 py-2 border-r border-gray-100 ${bg} max-w-[280px]`}>
                        <div className="font-medium text-gray-800 leading-tight">{item.category}</div>
                        {item.category_en && (
                          <div className="text-gray-400 text-xs leading-tight mt-0.5">{item.category_en}</div>
                        )}
                      </td>
                      <td className={td}>{fmt(item.plan_2023_2024)}</td>
                      <td className={`${td} border-r border-gray-100`}>{fmt(item.actual_2023_2024)}</td>
                      <td className={td}>{fmt(item.plan_2024_2025)}</td>
                      <td className={`${td} border-r border-gray-100`}>{fmt(item.actual_2024_2025)}</td>
                      <td className={`${td} text-green-700`}>{fmt(item.plan_2025_2026)}</td>
                      <td className={`${td} bg-green-50/30 ${hasActual ? 'text-red-600 font-semibold' : 'text-gray-300'}`}>
                        {hasActual ? fmtCurrency(actual!.amount) : '—'}
                      </td>
                      <td className="print:hidden px-1 py-1 whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          {item.expense_categories.length > 0 && (
                            <button
                              onClick={() => setViewItem(item)}
                              title="Giderleri gör"
                              className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setEditItem(item)}
                            title="Düzenle"
                            className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <DeleteConfirmDialog onConfirm={() => deleteBudgetItem(item.id)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              <tfoot>
                {/* Totals */}
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                  <td className="sticky left-0 bg-gray-100 z-10 px-3 py-2.5 border-r border-gray-200 text-xs text-gray-700">
                    TOPLAM
                  </td>
                  <td className={td}>{fmtCurrency(totals.p23)}</td>
                  <td className={`${td} border-r border-gray-200`}>{fmtCurrency(totals.a23)}</td>
                  <td className={td}>{fmtCurrency(totals.p24)}</td>
                  <td className={`${td} border-r border-gray-200`}>{fmtCurrency(totals.a24)}</td>
                  <td className={`${td} text-green-700`}>{fmtCurrency(totals.p25)}</td>
                  <td className={`${td} bg-green-50/30 text-red-600`}>{totals.a25 > 0 ? fmtCurrency(totals.a25) : '—'}</td>
                  <td className="print:hidden" />
                </tr>
                {/* Per-apartment */}
                <tr className="bg-gray-50 border-t border-gray-200 text-gray-500 italic">
                  <td className="sticky left-0 bg-gray-50 z-10 px-3 py-1.5 border-r border-gray-200 text-xs not-italic font-medium">
                    Daire Başına <span className="text-gray-400 font-normal">(÷ {APT_COUNT} daire)</span>
                  </td>
                  <td className={td}>{totals.p23 ? fmtCurrency(Math.round(totals.p23 / APT_COUNT)) : '—'}</td>
                  <td className={`${td} border-r border-gray-200`}>{totals.a23 ? fmtCurrency(Math.round(totals.a23 / APT_COUNT)) : '—'}</td>
                  <td className={td}>{totals.p24 ? fmtCurrency(Math.round(totals.p24 / APT_COUNT)) : '—'}</td>
                  <td className={`${td} border-r border-gray-200`}>{totals.a24 ? fmtCurrency(Math.round(totals.a24 / APT_COUNT)) : '—'}</td>
                  <td className={`${td} text-green-600`}>{totals.p25 ? fmtCurrency(Math.round(totals.p25 / APT_COUNT)) : '—'}</td>
                  <td className={`${td} bg-green-50/30`}>{totals.a25 > 0 ? fmtCurrency(Math.round(totals.a25 / APT_COUNT)) : '—'}</td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Harcama Kalemi</DialogTitle>
          </DialogHeader>
          <BudgetItemForm item={null} nextSortOrder={nextSortOrder} onClose={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null) }}>
        <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Harcama Kalemi Düzenle</DialogTitle>
          </DialogHeader>
          {editItem && (
            <BudgetItemForm
              key={editItem.id}
              item={editItem}
              nextSortOrder={nextSortOrder}
              onClose={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Expenses view dialog */}
      <Dialog open={!!viewItem} onOpenChange={v => { if (!v) setViewItem(null) }}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm leading-tight">{viewItem?.category}<br /><span className="text-xs font-normal text-gray-400">2025-2026 Gerçekleşen Giderler</span></DialogTitle>
          </DialogHeader>
          {viewItem && <ExpensesDialog item={viewItem} expenses={expenses} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
