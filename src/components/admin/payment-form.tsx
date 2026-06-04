'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { createPayment, updatePayment } from '@/lib/supabase/actions'
import { MONTHS } from '@/lib/utils'
import { Payment } from '@/types'
import { Plus, Pencil } from 'lucide-react'

const schema = z.object({
  apartment_no: z.string().min(1, 'Daire numarası zorunludur'),
  resident_name: z.string().optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  amount_due: z.number().positive('Tutar sıfırdan büyük olmalıdır'),
  amount_paid: z.number().min(0).optional(),
  payment_status: z.enum(['paid', 'unpaid', 'partial']),
  payment_date: z.string().optional(),
  note: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface PaymentFormProps {
  payment?: Payment
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)

export function PaymentForm({ payment }: PaymentFormProps) {
  const [open, setOpen] = useState(false)
  const isEdit = !!payment
  const [status, setStatus] = useState<string>(payment?.payment_status ?? 'unpaid')

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: payment
      ? {
          apartment_no: payment.apartment_no,
          resident_name: payment.resident_name ?? '',
          month: payment.month,
          year: payment.year,
          amount_due: payment.amount_due,
          amount_paid: payment.amount_paid,
          payment_status: payment.payment_status,
          payment_date: payment.payment_date ?? '',
          note: payment.note ?? '',
        }
      : {
          month: new Date().getMonth() + 1,
          year: currentYear,
          amount_paid: 0,
          payment_status: 'unpaid',
        },
  })

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      payment_date: data.payment_date || undefined,
    }
    const result = isEdit
      ? await updatePayment(payment!.id, payload)
      : await createPayment(payload)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Ödeme güncellendi.' : 'Ödeme eklendi.')
      setOpen(false)
      if (!isEdit) reset()
    }
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" className="gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Ödeme Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Ödemeyi Düzenle' : 'Yeni Ödeme Kaydı Ekle'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Daire No</Label>
                <Input placeholder="örn: A-5" {...register('apartment_no')} />
                {errors.apartment_no && <p className="text-xs text-red-500">{errors.apartment_no.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Sakin Adı</Label>
                <Input placeholder="Sakin adı soyadı" {...register('resident_name')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Ay</Label>
                <Select
                  defaultValue={String(payment?.month ?? new Date().getMonth() + 1)}
                  onValueChange={(v) => setValue('month', Number(v ?? 1))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MONTHS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Yıl</Label>
                <Select
                  defaultValue={String(payment?.year ?? currentYear)}
                  onValueChange={(v) => setValue('year', Number(v ?? currentYear))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Borç Tutarı (₺)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount_due', { valueAsNumber: true })} />
                {errors.amount_due && <p className="text-xs text-red-500">{errors.amount_due.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Ödenen Tutar (₺)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount_paid', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Ödeme Durumu</Label>
                <Select
                  defaultValue={payment?.payment_status ?? 'unpaid'}
                  onValueChange={(v) => {
                    const val = (v ?? 'unpaid') as 'paid' | 'unpaid' | 'partial'
                    setValue('payment_status', val)
                    setStatus(val)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Ödendi</SelectItem>
                    <SelectItem value="unpaid">Ödenmedi</SelectItem>
                    <SelectItem value="partial">Kısmi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(status === 'paid' || status === 'partial') && (
                <div className="space-y-1">
                  <Label>Ödeme Tarihi</Label>
                  <Input type="date" {...register('payment_date')} />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Not</Label>
              <Textarea placeholder="Opsiyonel not..." {...register('note')} rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
