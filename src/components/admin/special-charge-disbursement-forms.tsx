'use client'

import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Paperclip, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  addSpecialChargeDisbursement,
  deleteSpecialChargeDisbursement,
  setSpecialChargeDisbursementReceipt,
} from '@/lib/supabase/actions'
import { RECEIPT_BUCKET, RECEIPT_PREFIX } from '@/lib/special-charges'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/heic,image/webp'
const MAX_BYTES = 10 * 1024 * 1024

async function uploadReceipt(file: File): Promise<{ path: string; name: string } | { error: string }> {
  if (file.size > MAX_BYTES) return { error: 'Dosya 10 MB’den büyük olamaz.' }
  const ext = (file.name.split('.').pop() ?? 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf'
  const path = `${RECEIPT_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await createClient().storage.from(RECEIPT_BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) return { error: `Dosya yüklenemedi: ${error.message}` }
  return { path, name: file.name }
}

// ─── Kuruma ödeme ekle ───────────────────────────────────────────────────────

export function DisbursementDialog({ chargeId, defaultRecipient }: { chargeId: string; defaultRecipient?: string }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [title, setTitle] = useState('')
  const [recipient, setRecipient] = useState(defaultRecipient ?? '')
  const [amount, setAmount] = useState(0)
  const [fee, setFee] = useState(0)
  const [reference, setReference] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (!title.trim()) return toast.error('Açıklama zorunlu.')
    if (!(amount > 0)) return toast.error('Tutar 0’dan büyük olmalı.')
    setSaving(true)
    let receipt: { path: string; name: string } | null = null
    if (file) {
      const up = await uploadReceipt(file)
      if ('error' in up) { setSaving(false); return toast.error(up.error) }
      receipt = up
    }
    const res = await addSpecialChargeDisbursement({
      charge_id: chargeId, date, title, recipient, amount, fee, reference,
      receipt_path: receipt?.path ?? null, receipt_name: receipt?.name ?? null,
    })
    setSaving(false)
    if (res.error) return toast.error(res.error)
    toast.success('Ödeme kaydedildi.')
    setOpen(false)
    setTitle(''); setAmount(0); setFee(0); setReference(''); setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3" /> Ödeme ekle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Kuruma yapılan ödeme</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tarih</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Dekont / işlem no</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="22020714/393103" /></div>
          </div>
          <div className="space-y-1.5"><Label>Açıklama</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Altyapı Ücreti" /></div>
          <div className="space-y-1.5"><Label>Alıcı</Label><Input value={recipient} onChange={e => setRecipient(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Kuruma geçen tutar (₺)</Label><Input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label>Banka masrafı (₺)</Label><Input type="number" step="0.01" value={fee || ''} onChange={e => setFee(parseFloat(e.target.value) || 0)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Dekont (PDF veya resim, en fazla 10 MB)</Label>
            <Input ref={fileRef} type="file" accept={ACCEPT} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Vazgeç</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Dekont ekle / değiştir ──────────────────────────────────────────────────

export function ReceiptUploadButton({ id, hasReceipt }: { id: string; hasReceipt: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    const up = await uploadReceipt(file)
    if ('error' in up) { setBusy(false); return toast.error(up.error) }
    const res = await setSpecialChargeDisbursementReceipt(id, up.path, up.name)
    setBusy(false)
    if (ref.current) ref.current.value = ''
    if (res.error) {
      await createClient().storage.from(RECEIPT_BUCKET).remove([up.path])
      return toast.error(res.error)
    }
    toast.success('Dekont yüklendi.')
  }

  return (
    <>
      <input ref={ref} type="file" accept={ACCEPT} className="hidden" onChange={e => onPick(e.target.files?.[0])} />
      <Button size="sm" variant={hasReceipt ? 'ghost' : 'outline'} disabled={busy} onClick={() => ref.current?.click()}
        title={hasReceipt ? 'Dekontu değiştir' : 'Dekont yükle'}>
        <Paperclip className="h-3.5 w-3.5 mr-1" />
        {busy ? 'Yükleniyor…' : hasReceipt ? 'Değiştir' : 'Dekont yükle'}
      </Button>
    </>
  )
}

export function DeleteDisbursementButton({ id, label }: { id: string; label: string }) {
  const [busy, setBusy] = useState(false)
  async function onDelete() {
    if (!confirm(`"${label}" kaydı ve dekontu silinsin mi?`)) return
    setBusy(true)
    const res = await deleteSpecialChargeDisbursement(id)
    setBusy(false)
    if (res.error) toast.error(res.error)
    else toast.success('Kayıt silindi.')
  }
  return (
    <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete} title="Sil" className="text-red-500 hover:text-red-700">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
