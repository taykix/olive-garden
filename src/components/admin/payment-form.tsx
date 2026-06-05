'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createPayment, updatePayment, deletePayment } from '@/lib/supabase/actions'
import { createClient } from '@/lib/supabase/client'
import { MONTHS } from '@/lib/utils'
import { Payment } from '@/types'
import { Pencil, Plus, Trash2 } from 'lucide-react'

interface PaymentFormProps {
  payment?: Payment
  defaultApartmentNo?: string
}

const supabase = createClient()
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)
const MONTH_OPTS = Object.entries(MONTHS) as [string, string][]

async function lookupApartment(aptNo: string): Promise<{ name: string; annualDue: number } | null> {
  if (!aptNo.trim()) return null

  const [{ data: payData }, { data: settData }, { data: profData }] = await Promise.all([
    supabase.from('payments').select('resident_name').eq('apartment_no', aptNo).not('resident_name', 'is', null).limit(1),
    supabase.from('apartment_settings').select('annual_due').eq('apartment_no', aptNo).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('apartment_no', aptNo).maybeSingle(),
  ])

  const name =
    (payData?.[0]?.resident_name as string | null) ??
    (profData?.full_name as string | null) ??
    ''

  const annualDue = (settData?.annual_due as number | null) ?? 40000

  return { name, annualDue }
}

export function PaymentForm({ payment, defaultApartmentNo }: PaymentFormProps) {
  const isEdit = !!payment
  const [open, setOpen]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form fields
  const [aptNo, setAptNo]         = useState(payment?.apartment_no ?? defaultApartmentNo ?? '')
  const [name, setName]           = useState(payment?.resident_name ?? '')
  const [month, setMonth]         = useState(payment?.month ?? new Date().getMonth() + 1)
  const [year, setYear]           = useState(payment?.year ?? currentYear)
  const [amount, setAmount]       = useState(payment?.amount_paid ?? 0)
  const [note, setNote]           = useState(payment?.note ?? '')
  const [annualDue, setAnnualDue] = useState(payment?.amount_due ?? 40000)

  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [looking, setLooking] = useState(false)
  const [negativeConfirm, setNegativeConfirm] = useState(false)

  // Auto-fill name + annual_due when apt changes (add mode only)
  useEffect(() => {
    if (isEdit || !aptNo.trim()) return
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    lookupTimer.current = setTimeout(async () => {
      setLooking(true)
      const result = await lookupApartment(aptNo.trim().toUpperCase())
      setLooking(false)
      if (result) {
        if (result.name) setName(result.name)
        setAnnualDue(result.annualDue)
      }
    }, 500)
  }, [aptNo, isEdit])

  function resetForm() {
    setAptNo(defaultApartmentNo ?? '')
    setName('')
    setMonth(new Date().getMonth() + 1)
    setYear(currentYear)
    setAmount(0)
    setNote('')
    setAnnualDue(40000)
    setNegativeConfirm(false)
  }

  async function handleSave(forceNegative = false) {
    if (!aptNo.trim()) { toast.error('Daire numarası gereklidir.'); return }
    if (amount === 0) { toast.error('Ödeme tutarı sıfır olamaz.'); return }
    if (amount < 0 && !forceNegative) { setNegativeConfirm(true); return }

    setSaving(true)
    setNegativeConfirm(false)
    const payload = {
      apartment_no:     aptNo.trim().toUpperCase(),
      resident_name:    name.trim() || undefined,
      month,
      year,
      amount_due:       annualDue,
      amount_paid:      amount,
      payment_status:   'partial' as const,
      note:             note.trim() || undefined,
    }

    const result = isEdit
      ? await updatePayment(payment!.id, payload)
      : await createPayment(payload)

    setSaving(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Ödeme güncellendi.' : 'Ödeme eklendi.')
      setOpen(false)
      if (!isEdit) resetForm()
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    setDeleting(true)
    const result = await deletePayment(payment!.id)
    setDeleting(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Ödeme kaydı silindi.')
      setOpen(false)
    }
  }

  function handleOpen(v: boolean) {
    if (v && isEdit) {
      // Re-sync edit form state when reopening
      setAptNo(payment!.apartment_no)
      setName(payment!.resident_name ?? '')
      setMonth(payment!.month)
      setYear(payment!.year)
      setAmount(payment!.amount_paid)
      setNote(payment!.note ?? '')
      setAnnualDue(payment!.amount_due)
    }
    setOpen(v)
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => handleOpen(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" className="gap-1" onClick={() => handleOpen(true)}>
          <Plus className="h-4 w-4" /> Ödeme Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Ödemeyi Düzenle' : 'Yeni Ödeme Kaydı'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Daire No + Sakin Adı */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Daire No</Label>
                <Input
                  placeholder="örn: A-5"
                  value={aptNo}
                  onChange={e => setAptNo(e.target.value)}
                  className="uppercase"
                  readOnly={isEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Sakin Adı
                  {looking && <span className="text-xs text-gray-400 font-normal">...</span>}
                </Label>
                <Input
                  placeholder="Otomatik dolar"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>

            {/* Ay + Yıl */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ay</Label>
                <Select
                  value={String(month)}
                  onValueChange={v => setMonth(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTS.map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Yıl</Label>
                <Select
                  value={String(year)}
                  onValueChange={v => setYear(Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ödeme Tutarı */}
            <div className="space-y-1.5">
              <Label>Ödeme Tutarı (₺)</Label>
              <Input
                type="number"
                step={500}
                value={amount || ''}
                onChange={e => { setAmount(parseFloat(e.target.value) || 0); setNegativeConfirm(false) }}
                placeholder="0"
              />
            </div>

            {/* Eksi değer uyarısı */}
            {negativeConfirm && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 space-y-2">
                <p className="font-medium">⚠️ Eksi değer ekliyorsunuz, emin misiniz?</p>
                <p className="text-amber-700">Bu kayıt geri ödeme / fazla ödeme iadesi olarak işlenecektir.</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setNegativeConfirm(false)}>
                    Hayır, iptal
                  </Button>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => handleSave(true)}>
                    Evet, ekle
                  </Button>
                </div>
              </div>
            )}

            {/* Not */}
            <div className="space-y-1.5">
              <Label>Not</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Opsiyonel..."
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              {isEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? 'Siliniyor...' : 'Sil'}
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                <Button onClick={() => handleSave()} disabled={saving}>
                  {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
