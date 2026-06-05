'use client'

import React, { memo, useCallback, useMemo, useReducer, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { bulkImportPayments, bulkUpsertApartmentSettings } from '@/lib/supabase/actions'
import { ArrowLeft, ClipboardPaste, Save, Settings, Trash2, Upload, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'
import { MONTHS } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditRow {
  id: number
  apartment_no: string
  resident_name: string
  month: number
  year: number
  amount_due: number   // yıllık aidat bedeli (örn: 40000)
  amount_paid: number  // bu aya ait ödeme
  payment_status: 'paid' | 'unpaid' | 'partial'
  note: string
}

type Action =
  | { type: 'SET'; rows: EditRow[] }
  | { type: 'UPD'; id: number; field: keyof EditRow; value: string | number }
  | { type: 'DEL'; id: number }

function calcStatus(annualDue: number, totalPaid: number): EditRow['payment_status'] {
  if (totalPaid >= annualDue && annualDue > 0) return 'paid'
  if (totalPaid > 0) return 'partial'
  return 'unpaid'
}

function reducer(state: EditRow[], action: Action): EditRow[] {
  switch (action.type) {
    case 'SET': return action.rows
    case 'DEL': return state.filter(r => r.id !== action.id)
    case 'UPD': {
      return state.map(r => {
        if (r.id !== action.id) return r
        const upd = { ...r, [action.field]: action.value }
        // Status auto-recalc requires knowing apt total — not easily available here,
        // so let user set status manually after edit, or we use amount_due as threshold
        if (action.field === 'amount_paid' || action.field === 'amount_due') {
          upd.payment_status = upd.amount_paid >= upd.amount_due ? 'paid'
            : upd.amount_paid > 0 ? 'partial' : 'unpaid'
        }
        return upd
      })
    }
  }
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

const PAYMENT_MONTHS = [
  { month: 10, year: 2025 }, { month: 11, year: 2025 }, { month: 12, year: 2025 },
  { month: 1,  year: 2026 }, { month: 2,  year: 2026 }, { month: 3,  year: 2026 },
  { month: 4,  year: 2026 }, { month: 5,  year: 2026 }, { month: 6,  year: 2026 },
  { month: 7,  year: 2026 }, { month: 8,  year: 2026 },
]

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  cols.push(cur.trim())
  return cols
}

function parseTR(s: string): number {
  if (!s?.trim()) return NaN
  return parseFloat(s.trim().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
}

let idSeq = 1

interface AptSetting { apartment_no: string; annual_due: number; previous_balance: number }

function parseCsv(text: string, fallbackDue: number): { rows: EditRow[]; skipped: string[]; aptSettings: AptSetting[] } {
  const rows: EditRow[] = []
  const skipped: string[] = []
  const aptSettings: AptSetting[] = []

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim()
    if (!raw) continue
    const cols = raw.includes('\t') ? raw.split('\t').map(c => c.trim()) : parseCsvLine(raw)
    const first = cols[0]?.trim() ?? ''
    if (!/^[A-Fa-f]-\d+$/.test(first)) continue

    const apt  = first.toUpperCase()
    const name = cols[1]?.trim() ?? ''
    const prev = parseTR(cols[2] ?? '') // 2024-2025 kalan borç (negatif = alacak)

    const csvDue   = parseTR(cols[3] ?? '')
    const annualDue = isNaN(csvDue) ? fallbackDue : csvDue === 0 ? 0 : csvDue

    if (annualDue <= 0) {
      skipped.push(apt)
      // Still save the setting so muaf daireler are tracked
      aptSettings.push({ apartment_no: apt, annual_due: 0, previous_balance: isNaN(prev) ? 0 : prev })
      continue
    }

    aptSettings.push({ apartment_no: apt, annual_due: annualDue, previous_balance: isNaN(prev) ? 0 : prev })

    // Monthly payments from columns 4-14
    const monthPaid = PAYMENT_MONTHS.map((_, i) => {
      const v = parseTR(cols[4 + i] ?? '')
      return isNaN(v) || v < 0 ? 0 : v
    })
    const totalPaid = monthPaid.reduce((s, v) => s + v, 0)

    // Use KALAN ÖDEME (col 15) if available, else compute
    const kalanRaw = parseTR(cols[15] ?? '')
    const remaining = isNaN(kalanRaw) ? annualDue - totalPaid : kalanRaw

    // Annual status — NOT per-month
    const annualStatus: EditRow['payment_status'] =
      remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

    // Note for previous year balance
    const prevNote = !isNaN(prev) && prev !== 0
      ? prev < 0
        ? `Geçen dönemden alacak: ${Math.abs(prev).toLocaleString('tr-TR')} ₺`
        : `Geçen dönemden borç: ${prev.toLocaleString('tr-TR')} ₺`
      : ''

    // Only create records for months where payment > 0
    let isFirstPayment = true
    for (let i = 0; i < PAYMENT_MONTHS.length; i++) {
      const paid = monthPaid[i]
      if (paid <= 0) continue

      rows.push({
        id: idSeq++,
        apartment_no: apt,
        resident_name: name,
        month: PAYMENT_MONTHS[i].month,
        year: PAYMENT_MONTHS[i].year,
        amount_due: annualDue,      // yıllık borç
        amount_paid: paid,           // bu aya ait ödeme
        payment_status: annualStatus, // yıllık duruma göre
        note: isFirstPayment ? prevNote : '',
      })
      isFirstPayment = false
    }

    // Apartment made no payments at all → still create one "unpaid" record
    if (totalPaid === 0) {
      rows.push({
        id: idSeq++,
        apartment_no: apt,
        resident_name: name,
        month: 10,
        year: 2025,
        amount_due: annualDue,
        amount_paid: 0,
        payment_status: 'unpaid',
        note: prevNote,
      })
    }
  }

  return { rows, skipped, aptSettings }
}

// ─── Memoised row ────────────────────────────────────────────────────────────

const MONTH_OPTS = Object.entries(MONTHS) as [string, string][]

const EditableRow = memo(function EditableRow({
  row, isOdd, dispatch,
}: {
  row: EditRow
  isOdd: boolean
  dispatch: React.Dispatch<Action>
}) {
  const upd = useCallback(
    (field: keyof EditRow, value: string | number) =>
      dispatch({ type: 'UPD', id: row.id, field, value }),
    [dispatch, row.id]
  )

  const statusColor =
    row.payment_status === 'paid' ? 'text-green-700 bg-green-50'
    : row.payment_status === 'partial' ? 'text-amber-700 bg-amber-50'
    : 'text-red-600 bg-red-50'

  const inp = 'h-6 w-full border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 text-xs bg-transparent focus:bg-white'

  return (
    <tr className={isOdd ? 'bg-gray-50/60' : 'bg-white'}>
      <td className="px-1.5 py-0.5 border-b border-gray-100">
        <input className={`${inp} font-mono w-14`} value={row.apartment_no}
          onChange={e => upd('apartment_no', e.target.value.toUpperCase())} />
      </td>
      <td className="px-1.5 py-0.5 border-b border-gray-100">
        <input className={`${inp} w-36`} value={row.resident_name}
          onChange={e => upd('resident_name', e.target.value)} />
      </td>
      <td className="px-1.5 py-0.5 border-b border-gray-100 whitespace-nowrap">
        <div className="flex items-center gap-0.5">
          <select value={row.month} onChange={e => upd('month', Number(e.target.value))}
            className="h-6 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-0.5 text-xs bg-transparent focus:bg-white">
            {MONTH_OPTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" className={`${inp} w-14`} value={row.year}
            onChange={e => upd('year', Number(e.target.value))} />
        </div>
      </td>
      <td className="px-1.5 py-0.5 border-b border-gray-100">
        <input type="number" step="1000" className={`${inp} w-24 text-right font-mono`}
          value={row.amount_due} onChange={e => upd('amount_due', parseFloat(e.target.value) || 0)} />
      </td>
      <td className="px-1.5 py-0.5 border-b border-gray-100">
        <input type="number" step="100" className={`${inp} w-24 text-right font-mono`}
          value={row.amount_paid} onChange={e => upd('amount_paid', parseFloat(e.target.value) || 0)} />
      </td>
      <td className="px-1.5 py-0.5 border-b border-gray-100">
        <select value={row.payment_status} onChange={e => upd('payment_status', e.target.value)}
          className={`h-6 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 text-xs font-medium ${statusColor}`}>
          <option value="paid">Ödendi</option>
          <option value="partial">Kısmi</option>
          <option value="unpaid">Ödenmedi</option>
        </select>
      </td>
      <td className="px-1.5 py-0.5 border-b border-gray-100">
        <input className={`${inp} w-48`} value={row.note}
          onChange={e => upd('note', e.target.value)} placeholder="—" />
      </td>
      <td className="px-1 py-0.5 border-b border-gray-100">
        <button onClick={() => dispatch({ type: 'DEL', id: row.id })}
          className="text-gray-200 hover:text-red-400 transition-colors p-0.5">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopluOdemePage() {
  const [rows, dispatch]    = useReducer(reducer, [])
  const [aptSettings, setAptSettings] = useState<AptSetting[]>([])
  const [fallbackDue, setFallbackDue] = useState(40000)
  const [skipped, setSkipped]         = useState<string[]>([])
  const [msg, setMsg]                 = useState('')
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  function load(text: string, src: string) {
    const { rows: parsed, skipped: sk, aptSettings: settings } = parseCsv(text, fallbackDue)
    if (parsed.length || settings.length) {
      dispatch({ type: 'SET', rows: parsed })
      setSkipped(sk)
      setAptSettings(settings)
      const aptCount = new Set(parsed.map(r => r.apartment_no)).size
      flash(`✓ ${src}: ${parsed.length} kayıt, ${aptCount} daire${sk.length ? ` (${sk.length} muaf atlandı)` : ''}.`)
    } else {
      flash('Satır tanınamadı — CSV formatını kontrol edin.')
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault()
    load(e.clipboardData.getData('text'), 'yapıştırma')
    e.currentTarget.value = ''
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { load(ev.target?.result as string, file.name); e.target.value = '' }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleSaveSettingsOnly() {
    if (!aptSettings.length) return
    setSaving(true)
    const result = await bulkUpsertApartmentSettings(aptSettings)
    setSaving(false)
    if (result.error) {
      toast.error(`Ayarlar kaydedilemedi: ${result.error}`)
    } else {
      toast.success(`${aptSettings.length} daire ayarı (yıllık aidat + geçen yıl bakiyesi) güncellendi.`)
      dispatch({ type: 'SET', rows: [] })
      setSkipped([])
      setAptSettings([])
    }
  }

  async function handleSave() {
    if (!rows.length && !aptSettings.length) return
    setSaving(true)

    // Save apartment settings (annual_due, previous_balance) first
    if (aptSettings.length) {
      const settingsResult = await bulkUpsertApartmentSettings(aptSettings)
      if (settingsResult.error) {
        setSaving(false)
        toast.error(`Aidat ayarları kaydedilemedi: ${settingsResult.error}`)
        return
      }
    }

    // Save payment records
    if (rows.length) {
      const result = await bulkImportPayments(
        rows.map(r => ({
          apartment_no: r.apartment_no,
          resident_name: r.resident_name || undefined,
          month: r.month,
          year: r.year,
          amount_due: r.amount_due,
          amount_paid: r.amount_paid,
          payment_status: r.payment_status,
          note: r.note || undefined,
        }))
      )
      if (result.error) {
        setSaving(false)
        toast.error(result.error)
        return
      }
      toast.success(`${result.count} ödeme kaydı ve ${aptSettings.length} daire ayarı aktarıldı.`)
    } else {
      toast.success(`${aptSettings.length} daire ayarı kaydedildi.`)
    }

    setSaving(false)
    dispatch({ type: 'SET', rows: [] })
    setSkipped([])
    setAptSettings([])
  }

  const aptGroups = useMemo(() => {
    let lastApt = '', group = 0
    return rows.map(r => {
      if (r.apartment_no !== lastApt) { lastApt = r.apartment_no; group++ }
      return { isOdd: group % 2 === 1 }
    })
  }, [rows])

  // Summary stats grouped by apartment
  const aptStats = useMemo(() => {
    const map = new Map<string, { due: number; paid: number; status: string }>()
    for (const r of rows) {
      const e = map.get(r.apartment_no) ?? { due: r.amount_due, paid: 0, status: r.payment_status }
      e.paid += r.amount_paid
      map.set(r.apartment_no, e)
    }
    return map
  }, [rows])

  const unpaidApts    = [...aptStats.values()].filter(a => a.status === 'unpaid').length
  const partialApts   = [...aptStats.values()].filter(a => a.status === 'partial').length
  const paidApts      = [...aptStats.values()].filter(a => a.status === 'paid').length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/odemeler" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Ödeme Takibine Dön
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Toplu Ödeme Kaydı</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            CSV'den içe aktar · düzenle · kaydet — durum <strong>yıllık toplamdan</strong> hesaplanır.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {aptSettings.length > 0 && (
            <Button onClick={handleSaveSettingsOnly} disabled={saving} variant="outline"
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
              <Settings className="h-4 w-4" />
              {saving ? 'Kaydediliyor...' : `Sadece Ayarları Güncelle (${aptSettings.length} daire)`}
            </Button>
          )}
          {rows.length > 0 && (
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4" />
              {saving ? 'Kaydediliyor...' : `${rows.length} Kaydı Kaydet`}
            </Button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-amber-100 bg-amber-50/40">
          <CardContent className="py-3 px-4 space-y-1.5">
            <p className="text-xs font-medium text-amber-800">Varsayılan Yıllık Aidat Bedeli (₺)</p>
            <div className="flex items-center gap-2">
              <input type="number" min={0} step={1000} value={fallbackDue}
                onChange={e => setFallbackDue(Number(e.target.value))}
                className="h-8 w-32 border border-amber-200 rounded px-2 text-sm font-mono focus:outline-none focus:border-amber-400" />
              <span className="text-xs text-amber-600">CSV'de değer yoksa kullanılır</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-4 space-y-2">
            <p className="text-xs font-medium text-gray-700">CSV / Excel Verisi Yükle</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"
                className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50 h-8"
                onClick={() => fileRef.current?.click()} type="button">
                <Upload className="h-3.5 w-3.5" /> Dosya Yükle
              </Button>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
              <div className="relative flex-1">
                <textarea rows={1} onPaste={handlePaste} placeholder="veya Ctrl+V ile yapıştırın"
                  className="w-full rounded border border-dashed border-purple-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 resize-none" />
                <ClipboardPaste className="absolute right-2 top-1.5 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
              </div>
            </div>
            {msg && <p className={`text-xs ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
          </CardContent>
        </Card>
      </div>

      {skipped.length > 0 && (
        <p className="text-xs text-gray-400">
          Atlandı (muaf / yıllık aidat = 0): {skipped.map(a => <span key={a} className="font-mono text-gray-500 mr-1">{a}</span>)}
        </p>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm flex items-center gap-2 text-gray-700">
                <FileSpreadsheet className="h-4 w-4 text-purple-500" />
                {aptStats.size} daire · {rows.length} ödeme kaydı
                <span className="text-xs font-normal text-gray-400 ml-1">(Borç = yıllık toplam, her satır o aya ait ödeme)</span>
              </CardTitle>
              <div className="flex gap-3 text-xs">
                <span className="text-green-600 font-medium">✓ {paidApts} daire ödedi</span>
                <span className="text-amber-600 font-medium">~ {partialApts} kısmi</span>
                <span className="text-red-500 font-medium">✗ {unpaidApts} ödenmedi</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-left px-2 py-2 font-medium text-gray-500">Daire</th>
                    <th className="text-left px-2 py-2 font-medium text-gray-500">Sakin</th>
                    <th className="text-left px-2 py-2 font-medium text-gray-500">Ay</th>
                    <th className="text-right px-2 py-2 font-medium text-gray-500">Yıllık Borç ₺</th>
                    <th className="text-right px-2 py-2 font-medium text-gray-500">Bu Ay Ödenen ₺</th>
                    <th className="text-left px-2 py-2 font-medium text-gray-500">Yıllık Durum</th>
                    <th className="text-left px-2 py-2 font-medium text-gray-500">Not</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <EditableRow key={row.id} row={row} isOdd={aptGroups[i]?.isOdd ?? false} dispatch={dispatch} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="flex justify-end gap-2 pb-6">
          {aptSettings.length > 0 && (
            <Button onClick={handleSaveSettingsOnly} disabled={saving} variant="outline" size="lg"
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
              <Settings className="h-4 w-4" />
              {saving ? 'Kaydediliyor...' : `Sadece Ayarları Güncelle`}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4" />
            {saving ? 'Kaydediliyor...' : `${rows.length} Kaydı Kaydet`}
          </Button>
        </div>
      )}
    </div>
  )
}
