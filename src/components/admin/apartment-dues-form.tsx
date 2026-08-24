'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { upsertApartmentSettings } from '@/lib/supabase/actions'
import { Settings } from 'lucide-react'
import { ApartmentSettings } from '@/types'

interface Props {
  apartment_no: string
  settings: ApartmentSettings | null
  periodId?: string
}

export function ApartmentDuesForm({ apartment_no, settings, periodId }: Props) {
  const [open, setOpen]             = useState(false)
  const [annualDue, setAnnualDue]   = useState(settings?.annual_due ?? 40000)
  const [prevBal, setPrevBal]       = useState(settings?.previous_balance ?? 0)
  const [notes, setNotes]           = useState(settings?.notes ?? '')
  const [saving, setSaving]         = useState(false)

  async function handleSave() {
    setSaving(true)
    const result = await upsertApartmentSettings({
      apartment_no,
      annual_due: annualDue,
      previous_balance: prevBal,
      notes: notes || undefined,
      period_id: periodId,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Aidat ayarları kaydedildi.')
      setOpen(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Settings className="h-3.5 w-3.5" />
        Aidat Ayarları
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{apartment_no} — Aidat Ayarları</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Yıllık Aidat Bedeli (₺)</Label>
              <Input
                type="number" min={0} step={1000}
                value={annualDue}
                onChange={e => setAnnualDue(Number(e.target.value))}
              />
              <p className="text-xs text-gray-400">0 = muaf daire (aidat almıyor)</p>
            </div>

            <div className="space-y-1.5">
              <Label>Geçen Dönem Bakiyesi (₺)</Label>
              <Input
                type="number" step={0.01}
                value={prevBal}
                onChange={e => setPrevBal(Number(e.target.value))}
              />
              <p className="text-xs text-gray-400">
                Pozitif = geçen dönemden devreden <span className="text-red-500">borç</span> ·
                Negatif = <span className="text-blue-500">alacak</span> (fazla ödeme)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Opsiyonel not..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
