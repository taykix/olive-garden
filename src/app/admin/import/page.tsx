'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { bulkImportData } from '@/lib/supabase/actions'
import { categorizeIncome, categorizeExpense } from '@/lib/utils'
import { TrendingUp, TrendingDown, Plus, Trash2, Save, ClipboardPaste, Upload } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Row {
  id: number
  siraNo: string
  tarih: string
  aciklama: string
  tutar: string
}

let counter = 1
function newRow(partial: Partial<Omit<Row, 'id'>> = {}): Row {
  return { id: counter++, siraNo: '', tarih: '', aciklama: '', tutar: '', ...partial }
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

const SKIP_RE = /defter\s*s[ıi]|^\s*tarih\s*$|gelirler|giderler|toplam|miktarı|ayı/i

/** Parse a single CSV line, handling quoted fields */
function parseCSVLine(line: string): string[] {
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

/** Accept tab-sep OR comma-sep; returns partial Row objects */
function parseText(text: string): Partial<Omit<Row, 'id'>>[] {
  const rows: Partial<Omit<Row, 'id'>>[] = []
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue

    // Detect separator: prefer tab if present, else comma
    const sep = raw.includes('\t') ? '\t' : ','
    const cols = sep === '\t'
      ? raw.split('\t').map(c => c.trim())
      : parseCSVLine(raw)

    const joined = cols.join(' ')
    if (SKIP_RE.test(joined)) continue

    let siraNo = '', tarih = '', aciklama = '', tutar = ''

    if (cols.length >= 4) {
      siraNo   = cols[0]
      tarih    = normaliseDate(cols[1])
      aciklama = cols[2]
      tutar    = cols[3]
    } else if (cols.length === 3) {
      tarih    = normaliseDate(cols[0])
      aciklama = cols[1]
      tutar    = cols[2]
    } else if (cols.length === 2) {
      aciklama = cols[0]
      tutar    = cols[1]
    }

    if (!aciklama || !tutar) continue
    const n = parseFloat(tutar.replace(/\./g, '').replace(',', '.'))
    if (isNaN(n)) continue

    rows.push({ siraNo, tarih, aciklama, tutar })
  }
  return rows
}

function normaliseDate(s: string): string {
  s = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s          // already ISO
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) {            // dd.mm.yyyy
    const [d, m, y] = s.split('.')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return s
}

function parseTutar(s: string): number | null {
  if (!s.trim()) return null
  const n = parseFloat(s.trim().replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

// ─── Per-section upload + paste widget ───────────────────────────────────────

function ImportWidget({
  onRows,
  color,
}: {
  onRows: (rows: Partial<Omit<Row, 'id'>>[], src: string) => void
  color: 'green' | 'red'
}) {
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(m: string, ok: boolean) {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
    if (!ok) return
  }

  /* Paste handler */
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const rows = parseText(text)
    if (rows.length) {
      onRows(rows, 'yapıştırma')
      flash(`✓ ${rows.length} satır yapıştırıldı.`, true)
    } else {
      flash('Satır tanınamadı — sütun sırası: S.No, Tarih, Açıklama, Tutar', false)
    }
    e.currentTarget.value = ''
  }

  /* CSV file upload */
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseText(text)
      if (rows.length) {
        onRows(rows, file.name)
        flash(`✓ ${file.name}: ${rows.length} satır yüklendi.`, true)
      } else {
        flash('CSV okunamadı — beklenen sütunlar: S.No, Tarih, Açıklama, Tutar', false)
      }
      e.target.value = ''   // reset so same file can be re-selected
    }
    reader.readAsText(file, 'UTF-8')
  }

  const border = color === 'green' ? 'border-green-200 focus:border-green-400' : 'border-red-200 focus:border-red-400'
  const btn    = color === 'green' ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-red-200 text-red-600 hover:bg-red-50'
  const okText = color === 'green' ? 'text-green-600' : 'text-red-600'

  return (
    <div className="mx-4 mb-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* CSV upload button */}
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 ${btn}`}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          <Upload className="h-3.5 w-3.5" />
          CSV Dosyası Yükle
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
        <span className="text-gray-300 text-xs">veya</span>
        <span className="text-xs text-gray-400">Excel'den kopyalayıp aşağıya yapıştırın</span>
      </div>

      {/* Paste area */}
      <div className="relative">
        <textarea
          rows={2}
          onPaste={handlePaste}
          placeholder="Ctrl+V ile yapıştırın (Excel'den kopyalanmış hücreler)"
          className={`w-full rounded-lg border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500 placeholder:text-gray-400 focus:outline-none resize-none ${border}`}
        />
        <ClipboardPaste className="absolute right-3 top-2.5 h-4 w-4 text-gray-300 pointer-events-none" />
      </div>

      {msg && (
        <p className={`text-xs ${msg.startsWith('✓') ? okText : 'text-red-500'}`}>{msg}</p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VeriGirisPage() {
  const [gelirler, setGelirler] = useState<Row[]>([newRow()])
  const [giderler, setGiderler] = useState<Row[]>([newRow()])
  const [saving, setSaving]   = useState(false)

  function appendRows(
    setter: React.Dispatch<React.SetStateAction<Row[]>>,
    current: Row[],
    parsed: Partial<Omit<Row, 'id'>>[]
  ) {
    const isEmpty = current.length === 1 && !current[0].aciklama && !current[0].tutar
    const added   = parsed.map(p => newRow(p))
    setter(prev => isEmpty ? added : [...prev, ...added])
  }

  function update(setter: React.Dispatch<React.SetStateAction<Row[]>>, id: number, field: keyof Row, value: string) {
    setter(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function remove(setter: React.Dispatch<React.SetStateAction<Row[]>>, id: number) {
    setter(rows => rows.length > 1 ? rows.filter(r => r.id !== id) : rows)
  }

  const gelirTotal = gelirler.reduce((s, r) => s + (parseTutar(r.tutar) ?? 0), 0)
  const giderTotal = giderler.reduce((s, r) => s + (parseTutar(r.tutar) ?? 0), 0)

  async function handleSave() {
    const toRecord = (rows: Row[], catFn: (s: string) => string) =>
      rows
        .filter(r => r.aciklama.trim() && r.tutar.trim())
        .flatMap(r => {
          const amount = parseTutar(r.tutar)
          if (!amount) return []
          return [{
            date: r.tarih || new Date().toISOString().split('T')[0],
            title: r.aciklama.trim(),
            description: r.siraNo ? `Defter Sıra No: ${r.siraNo}` : '',
            category: catFn(r.aciklama),
            amount,
          }]
        })

    const incomeRows  = toRecord(gelirler, categorizeIncome)
    const expenseRows = toRecord(giderler, categorizeExpense)

    if (!incomeRows.length && !expenseRows.length) {
      toast.error('Kaydedilecek veri yok.')
      return
    }

    setSaving(true)
    const result = await bulkImportData(incomeRows, expenseRows)
    setSaving(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${result.incomeCount ?? 0} gelir, ${result.expenseCount ?? 0} gider kaydedildi.`)
      setGelirler([newRow()])
      setGiderler([newRow()])
    }
  }

  function Section({
    rows, setter, color, icon, label, total, placeholder, catFn,
  }: {
    rows: Row[]
    setter: React.Dispatch<React.SetStateAction<Row[]>>
    color: 'green' | 'red'
    icon: React.ReactNode
    label: string
    total: number
    placeholder: string
    catFn: (s: string) => string
  }) {
    void catFn
    const addBtn = color === 'green'
      ? 'text-green-600 border-green-200 hover:bg-green-50'
      : 'text-red-600 border-red-200 hover:bg-red-50'
    const titleCls = color === 'green' ? 'text-green-700' : 'text-red-600'

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className={`flex items-center gap-2 ${titleCls}`}>{icon} {label}</span>
            <span className="text-sm font-normal text-gray-400">
              Toplam: {total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            </span>
          </CardTitle>
        </CardHeader>

        <ImportWidget
          color={color}
          onRows={(parsed) => appendRows(setter, rows, parsed)}
        />

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium w-24">Defter S.No</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium w-36">Tarih</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">{label}</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium w-36">Tutar (₺)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-2 py-1.5">
                      <Input value={row.siraNo} onChange={e => update(setter, row.id, 'siraNo', e.target.value)} placeholder="1" className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="date" value={row.tarih} onChange={e => update(setter, row.id, 'tarih', e.target.value)} className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={row.aciklama} onChange={e => update(setter, row.id, 'aciklama', e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={row.tutar} onChange={e => update(setter, row.id, 'tutar', e.target.value)} placeholder="10000" className="h-8 text-sm" />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => remove(setter, row.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3">
            <Button variant="outline" size="sm" onClick={() => setter(r => [...r, newRow()])} className={`gap-1 ${addBtn}`}>
              <Plus className="h-3.5 w-3.5" /> Satır Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Veri Girişi</h1>
          <p className="text-gray-500 text-sm mt-1">
            Satır satır girin · Excel'den yapıştırın · veya CSV dosyası yükleyin
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
          <Save className="h-4 w-4" />
          {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
        </Button>
      </div>

      <Section
        rows={gelirler} setter={setGelirler}
        color="green" icon={<TrendingUp className="h-4 w-4" />}
        label="Gelirler" total={gelirTotal}
        placeholder="Örn: Ahmet Yılmaz Aidat Ödemesi"
        catFn={categorizeIncome}
      />

      <Section
        rows={giderler} setter={setGiderler}
        color="red" icon={<TrendingDown className="h-4 w-4" />}
        label="Giderler" total={giderTotal}
        placeholder="Örn: Aydem Elektrik Faturası"
        catFn={categorizeExpense}
      />

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 bg-green-600 hover:bg-green-700">
          <Save className="h-4 w-4" />
          {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
        </Button>
      </div>
    </div>
  )
}
