'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Link2, Pencil, Plus, X } from 'lucide-react'
import {
  addSpecialChargePayment,
  deleteSpecialChargePayment,
  linkIncomeToSpecialCharge,
  updateSpecialChargeItem,
} from '@/lib/supabase/actions'
import { ApartmentCombobox } from '@/components/shared/apartment-combobox'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Ödeme ekle ───────────────────────────────────────────────────────────────

export function SpecialChargePaymentDialog({
  chargeId,
  chargeTitle,
  apartmentNo,
  defaultAmount,
  residentName,
}: {
  chargeId: string
  chargeTitle: string
  apartmentNo: string
  defaultAmount: number
  residentName?: string
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(defaultAmount)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [name, setName] = useState(residentName ?? '')
  const [serial, setSerial] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await addSpecialChargePayment({
      charge_id: chargeId,
      apartment_no: apartmentNo,
      amount_paid: amount,
      payment_date: date,
      resident_name: name || undefined,
      serial_no: serial || undefined,
      note: note || undefined,
    })
    setSaving(false)
    if (res.error) toast.error(res.error)
    else {
      toast.success(`${apartmentNo} ödemesi kaydedildi ve Gelirler'e eklendi.`)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs"
        onClick={() => { setAmount(defaultAmount); setOpen(true) }}
      >
        <Plus className="h-3 w-3" /> Ödeme
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{apartmentNo} — {chargeTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tutar (₺)</Label>
                <Input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ödeme Tarihi</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ödeyen (opsiyonel)</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ad Soyad" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Defter Sıra No</Label>
                <Input value={serial} onChange={e => setSerial(e.target.value)} placeholder="Opsiyonel" />
              </div>
              <div className="space-y-1.5">
                <Label>Not</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Opsiyonel" />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Kayıt, Gelirler tablosuna da otomatik eklenir (kategori: ek ödemenin gelir kategorisi).
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button onClick={handleSave} disabled={saving || !(amount > 0) || !date}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Birim borcunu düzenle (0 = muaf) ─────────────────────────────────────────

export function SpecialChargeItemDialog({
  chargeId,
  apartmentNo,
  amountDue,
  note,
}: {
  chargeId: string
  apartmentNo: string
  amountDue: number
  note: string | null
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(amountDue)
  const [n, setN] = useState(note ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await updateSpecialChargeItem(chargeId, apartmentNo, amount, n)
    setSaving(false)
    if (res.error) toast.error(res.error)
    else { toast.success('Borç tutarı güncellendi.'); setOpen(false) }
  }

  return (
    <>
      <button
        onClick={() => { setAmount(amountDue); setN(note ?? ''); setOpen(true) }}
        className="p-1 text-gray-300 hover:text-gray-600" title="Borç tutarını düzenle"
      >
        <Pencil className="h-3 w-3" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{apartmentNo} — Borç Tutarı</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Tutar (₺)</Label>
              <Input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(Number(e.target.value))} />
              <p className="text-xs text-gray-400">0 = muaf</p>
            </div>
            <div className="space-y-1.5">
              <Label>Not</Label>
              <Input value={n} onChange={e => setN(e.target.value)} placeholder="Opsiyonel" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button onClick={handleSave} disabled={saving || !(amount >= 0)}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Ödeme kaydını kaldır ─────────────────────────────────────────────────────

export function SpecialChargePaymentChip({
  id,
  amount,
  date,
}: {
  id: string
  amount: number
  date: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run(removeIncome: boolean) {
    setBusy(true)
    const res = await deleteSpecialChargePayment(id, removeIncome)
    setBusy(false)
    if (res.error) toast.error(res.error)
    else { toast.success(removeIncome ? 'Ödeme ve gelir kaydı silindi.' : 'Bağlantı kaldırıldı; gelir kaydı korundu.'); setOpen(false) }
  }

  return (
    <>
      <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-800 font-mono">
        {formatDate(date)} · {formatCurrency(amount)}
        <button onClick={() => setOpen(true)} className="text-green-400 hover:text-red-500" title="Kaldır">
          <X className="h-3 w-3" />
        </button>
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ödeme kaydını kaldır</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600">
            <p>{formatDate(date)} tarihli {formatCurrency(amount)} ödeme.</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
              <li><strong>Yalnızca bağlantıyı kaldır:</strong> gelir kaydı Gelirler&apos;de kalır (yanlış daireye eşleştirildiyse bunu seçin).</li>
              <li><strong>Gelirle birlikte sil:</strong> gelir kaydı da silinir (ödeme hiç yapılmadıysa).</li>
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button variant="outline" disabled={busy} onClick={() => run(false)}>Yalnızca bağlantıyı kaldır</Button>
              <Button variant="destructive" disabled={busy} onClick={() => run(true)}>Gelirle birlikte sil</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Mevcut gelir kaydını eşleştir ────────────────────────────────────────────

export function LinkIncomeControl({
  incomeId,
  chargeId,
  apartments,
  suggested,
}: {
  incomeId: string
  chargeId: string
  apartments: string[]
  suggested: string | null
}) {
  const [apt, setApt] = useState(suggested ?? '')
  const [busy, setBusy] = useState(false)

  async function handleLink() {
    setBusy(true)
    const res = await linkIncomeToSpecialCharge(incomeId, chargeId, apt)
    setBusy(false)
    if (res.error) toast.error(res.error)
    else toast.success(`Gelir kaydı ${apt} birimine bağlandı.`)
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-24">
        <ApartmentCombobox apartments={apartments} value={apt} onChange={setApt} placeholder="Birim" />
      </div>
      <Button size="sm" className="h-8 gap-1" disabled={busy || !apt} onClick={handleLink}>
        <Link2 className="h-3.5 w-3.5" /> Bağla
      </Button>
    </div>
  )
}
