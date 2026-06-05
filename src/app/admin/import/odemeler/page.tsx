'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { bulkImportPayments } from '@/lib/supabase/actions'
import { Upload, ClipboardPaste, ArrowLeft, CreditCard, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentRow {
  apartment_no: string
  resident_name: string
  month: number
  year: number
  amount_due: number
  amount_paid: number
  payment_status: 'paid' | 'unpaid' | 'partial'
  note?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_MONTHS = [
  { month: 10, year: 2025, label: 'Eki 2025' },
  { month: 11, year: 2025, label: 'Kas 2025' },
  { month: 12, year: 2025, label: 'Ara 2025' },
  { month: 1,  year: 2026, label: 'Oca 2026' },
  { month: 2,  year: 2026, label: 'Şub 2026' },
  { month: 3,  year: 2026, label: 'Mar 2026' },
  { month: 4,  year: 2026, label: 'Nis 2026' },
  { month: 5,  year: 2026, label: 'May 2026' },
  { month: 6,  year: 2026, label: 'Haz 2026' },
  { month: 7,  year: 2026, label: 'Tem 2026' },
  { month: 8,  year: 2026, label: 'Ağu 2026' },
]

const DEFAULT_ANNUAL_DUE = 40000

// ─── CSV Parser ───────────────────────────────────────────────────────────────

/** Parse a single CSV line respecting quoted fields */
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

/** Parse a number in Turkish locale format ("40.000,00" or "40000" or "-502,16") */
function parseTR(s: string): number {
  if (!s || !s.trim()) return NaN
  const cleaned = s.trim().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned)
}

function parsePaymentCSV(text: string, fallbackAnnualDue: number): {
  records: PaymentRow[]
  skipped: { apartment_no: string; resident_name: string; reason: string }[]
} {
  const records: PaymentRow[] = []
  const skipped: { apartment_no: string; resident_name: string; reason: string }[] = []
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Detect separator: tab-separated or comma-separated
    const cols = line.includes('\t')
      ? line.split('\t').map(c => c.trim())
      : parseCSVLine(line)

    const firstCol = (cols[0] ?? '').trim()
    // Only rows matching apartment pattern (A-1 ... F-8)
    if (!/^[A-Fa-f]-\d+$/.test(firstCol)) continue

    const apartment_no  = firstCol.toUpperCase()
    const resident_name = cols[1] ?? ''

    // Previous year balance — negative = credit (overpayment), positive = debt
    const prevBalance = parseTR(cols[2] ?? '')

    // Annual due: explicit CSV value takes precedence; fall back to manual default
    const csvAnnualDue = parseTR(cols[3] ?? '')
    const hasExplicitZero = !isNaN(csvAnnualDue) && csvAnnualDue === 0
    const annualDue = hasExplicitZero ? 0 : (csvAnnualDue > 0 ? csvAnnualDue : fallbackAnnualDue)

    if (annualDue <= 0) {
      skipped.push({ apartment_no, resident_name, reason: 'Yıllık aidat bedeli 0 (muaf)' })
      continue
    }

    const monthlyDue = Math.round((annualDue / 11) * 100) / 100

    // Build note for first month record
    let noteBase: string | undefined
    if (!isNaN(prevBalance) && prevBalance !== 0) {
      if (prevBalance < 0) {
        noteBase = `Geçen dönemden alacak: ${Math.abs(prevBalance).toLocaleString('tr-TR')} ₺`
      } else {
        noteBase = `Geçen dönemden devreden borç: ${prevBalance.toLocaleString('tr-TR')} ₺`
      }
    }

    for (let i = 0; i < PAYMENT_MONTHS.length; i++) {
      const rawPaid = parseTR(cols[4 + i] ?? '')
      const paid = isNaN(rawPaid) || rawPaid < 0 ? 0 : rawPaid

      const status: PaymentRow['payment_status'] =
        paid >= monthlyDue ? 'paid' : paid > 0 ? 'partial' : 'unpaid'

      records.push({
        apartment_no,
        resident_name,
        month: PAYMENT_MONTHS[i].month,
        year: PAYMENT_MONTHS[i].year,
        amount_due: monthlyDue,
        amount_paid: paid,
        payment_status: status,
        note: i === 0 ? noteBase : undefined,
      })
    }
  }

  return { records, skipped }
}

// ─── Preview helpers ─────────────────────────────────────────────────────────

function groupByApartment(rows: PaymentRow[]) {
  const map = new Map<string, { name: string; paid: number; partial: number; unpaid: number; monthlyDue: number }>()
  for (const r of rows) {
    const prev = map.get(r.apartment_no) ?? { name: r.resident_name, paid: 0, partial: 0, unpaid: 0, monthlyDue: r.amount_due }
    if (r.payment_status === 'paid') prev.paid++
    else if (r.payment_status === 'partial') prev.partial++
    else prev.unpaid++
    map.set(r.apartment_no, prev)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OdemelerImportPage() {
  const [annualDue, setAnnualDue]     = useState(DEFAULT_ANNUAL_DUE)
  const [records, setRecords]         = useState<PaymentRow[]>([])
  const [skipped, setSkipped]         = useState<{ apartment_no: string; resident_name: string; reason: string }[]>([])
  const [msg, setMsg]                 = useState('')
  const [loading, setLoading]         = useState(false)
  const [imported, setImported]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  function processText(text: string, src: string) {
    const { records: parsed, skipped: sk } = parsePaymentCSV(text, annualDue)
    if (parsed.length) {
      setRecords(parsed)
      setSkipped(sk)
      setImported(false)
      flash(`✓ ${src}: ${parsed.length} kayıt okundu (${groupByApartment(parsed).length} daire${sk.length ? `, ${sk.length} daire atlandı` : ''}).`)
    } else {
      flash('Satır tanınamadı. CSV formatı bekleniyor: DA.NO, ADI SOYADI, 2024-2025 KALAN, 2025-2026 AİDAT, [11 ay], KALAN')
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault()
    processText(e.clipboardData.getData('text'), 'Yapıştırma')
    e.currentTarget.value = ''
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      processText(ev.target?.result as string, file.name)
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (!records.length) return
    setLoading(true)
    const result = await bulkImportPayments(
      records.map(r => ({ ...r, note: r.note ?? undefined }))
    )
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${result.count} ödeme kaydı başarıyla aktarıldı.`)
      setImported(true)
      setRecords([])
      setSkipped([])
    }
  }

  const grouped    = groupByApartment(records)
  const totalPaid    = records.filter(r => r.payment_status === 'paid').length
  const totalPartial = records.filter(r => r.payment_status === 'partial').length
  const totalUnpaid  = records.filter(r => r.payment_status === 'unpaid').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin/import" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Veri Girişi'ne Dön
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Ödeme Kaydı Aktar</h1>
        <p className="text-gray-500 text-sm mt-1">
          Aidat tablosunu CSV dosyası olarak yükleyin ya da Excel'den kopyalayıp yapıştırın.
        </p>
      </div>

      {/* Annual due config */}
      <Card className="border-amber-100 bg-amber-50/40">
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap gap-6 items-end">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Varsayılan Yıllık Aidat Bedeli (₺)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={annualDue}
                  onChange={e => setAnnualDue(Number(e.target.value))}
                  className="h-9 w-40 font-mono"
                />
                <span className="text-xs text-gray-400">/ yıl · daire başına</span>
              </div>
            </div>
            <div className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded-lg max-w-sm">
              CSV'deki daire bazlı tutar önceliklidir. Bu alan yalnızca CSV'de değer olmadığında veya sonraki yıl aktarımı için kullanılır. Sıfır (0) olan daireler muaf sayılır ve aktarılmaz.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paste / Upload */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-purple-700">
            <CreditCard className="h-4 w-4" /> Veri Gir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Beklenen sütunlar (virgül veya sekme ile ayrılmış):{' '}
            <span className="font-mono bg-gray-100 px-1 rounded">DA.NO, ADI SOYADI, 2024-2025 KALAN, 2025-2026 AİDAT, EKİ·KAS·ARA 2025, OCA·ŞUB·MAR·NİS·MAY·HAZ·TEM·AĞU 2026, KALAN</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50"
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              <Upload className="h-3.5 w-3.5" /> CSV Dosyası Yükle
            </Button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
            <span className="text-gray-300 text-xs">veya</span>
            <span className="text-xs text-gray-400">Excel'den kopyalayıp yapıştırın</span>
          </div>

          <div className="relative">
            <textarea
              rows={3}
              onPaste={handlePaste}
              placeholder="Ctrl+V ile yapıştırın"
              className="w-full rounded-lg border border-dashed border-purple-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 placeholder:text-gray-400 focus:outline-none focus:border-purple-400 resize-none"
            />
            <ClipboardPaste className="absolute right-3 top-2.5 h-4 w-4 text-gray-300 pointer-events-none" />
          </div>

          {msg && (
            <p className={`text-xs ${msg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-700">
              Önizleme — {grouped.length} Daire · {records.length} Kayıt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status summary */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Ödendi: {totalPaid}
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Kısmi: {totalPartial}
              </span>
              <span className="inline-flex items-center gap-1.5 text-red-700 bg-red-50 px-3 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-red-400 inline-block" /> Ödenmedi: {totalUnpaid}
              </span>
            </div>

            {/* Apartment table */}
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Daire</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Sakin</th>
                    <th className="text-center px-2 py-2 text-xs text-green-600 font-medium">Ödendi</th>
                    <th className="text-center px-2 py-2 text-xs text-amber-600 font-medium">Kısmi</th>
                    <th className="text-center px-2 py-2 text-xs text-red-500 font-medium">Ödenmedi</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Aylık Borç</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([apt, info]) => (
                    <tr key={apt} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-mono font-medium text-gray-900">{apt}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[180px]">{info.name || '—'}</td>
                      <td className="px-2 py-2 text-center text-green-600 font-medium">{info.paid}</td>
                      <td className="px-2 py-2 text-center text-amber-600 font-medium">{info.partial}</td>
                      <td className="px-2 py-2 text-center text-red-500 font-medium">{info.unpaid}</td>
                      <td className="px-3 py-2 text-right text-gray-500 font-mono text-xs">
                        {info.monthlyDue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Skipped apartments */}
            {skipped.length > 0 && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Atlanan daireler ({skipped.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {skipped.map(s => (
                    <span key={s.apartment_no} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded" title={s.reason}>
                      <span className="font-mono font-medium text-gray-700">{s.apartment_no}</span> — {s.reason}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">Bu işlem mevcut kayıtların üzerine yazmaz — yeni kayıt olarak ekler.</p>

            <Button onClick={handleImport} disabled={loading} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <CreditCard className="h-4 w-4" />
              {loading ? 'Aktarılıyor...' : `${records.length} Kaydı Aktar`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {imported && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <div>
              <p className="font-semibold text-green-800">Aktarım tamamlandı!</p>
              <p className="text-sm text-green-600 mt-1">Ödeme kayıtları Ödemeler sayfasında görüntülenebilir.</p>
            </div>
            <Link href="/admin/odemeler">
              <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-100">
                Ödeme Takibine Git
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
