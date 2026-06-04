'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { createAnnualWork, updateAnnualWork } from '@/lib/supabase/actions'
import { AnnualWork } from '@/types'
import { Plus, Pencil } from 'lucide-react'

const schema = z.object({
  year: z.number().min(2020).max(2050),
  title: z.string().min(1, 'Başlık zorunludur'),
  description: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'completed']),
  estimated_cost: z.number().min(0).optional(),
  actual_cost: z.number().min(0).optional(),
  contractor: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 8 }, (_, i) => currentYear - 2 + i)

interface Props { work?: AnnualWork }

export function AnnualWorkForm({ work }: Props) {
  const [open, setOpen] = useState(false)
  const isEdit = !!work

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: work
      ? { year: work.year, title: work.title, description: work.description ?? '', status: work.status, estimated_cost: work.estimated_cost ?? undefined, actual_cost: work.actual_cost ?? undefined, contractor: work.contractor ?? '', notes: work.notes ?? '' }
      : { year: currentYear, status: 'planned' },
  })

  async function onSubmit(data: FormData) {
    const result = isEdit ? await updateAnnualWork(work!.id, data) : await createAnnualWork(data)
    if (result?.error) { toast.error(result.error) } else {
      toast.success(isEdit ? 'Güncellendi.' : 'Eklendi.')
      setOpen(false)
      if (!isEdit) reset()
    }
  }

  return (
    <>
      {isEdit
        ? <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button>
        : <Button size="sm" className="gap-1" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> İş Ekle</Button>
      }
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isEdit ? 'İşi Düzenle' : 'Yeni Yapım/Onarım İşi'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Yıl</Label>
                <Select defaultValue={String(work?.year ?? currentYear)} onValueChange={(v) => setValue('year', Number(v ?? currentYear))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Durum</Label>
                <Select defaultValue={work?.status ?? 'planned'} onValueChange={(v) => setValue('status', (v ?? 'planned') as 'planned' | 'in_progress' | 'completed')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planlandı</SelectItem>
                    <SelectItem value="in_progress">Devam Ediyor</SelectItem>
                    <SelectItem value="completed">Tamamlandı</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Başlık</Label>
              <Input placeholder="İş başlığı" {...register('title')} />
              {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Açıklama</Label>
              <Textarea placeholder="İş detayları..." {...register('description')} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tahmini Maliyet (₺)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('estimated_cost', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label>Gerçek Maliyet (₺)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('actual_cost', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Yüklenici / Firma</Label>
              <Input placeholder="Firma adı" {...register('contractor')} />
            </div>
            <div className="space-y-1">
              <Label>Notlar</Label>
              <Textarea placeholder="Ek notlar..." {...register('notes')} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Ekle'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
