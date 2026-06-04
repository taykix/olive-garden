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
import { createIncome, updateIncome } from '@/lib/supabase/actions'
import { INCOME_CATEGORIES } from '@/lib/utils'
import { Income } from '@/types'
import { Plus, Pencil } from 'lucide-react'

const schema = z.object({
  date: z.string().min(1, 'Tarih zorunludur'),
  title: z.string().min(1, 'Başlık zorunludur'),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().positive('Tutar sıfırdan büyük olmalıdır'),
})

type FormData = z.infer<typeof schema>

interface IncomeFormProps {
  income?: Income
}

export function IncomeForm({ income }: IncomeFormProps) {
  const [open, setOpen] = useState(false)
  const isEdit = !!income

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: income
      ? {
          date: income.date,
          title: income.title,
          description: income.description ?? '',
          category: income.category ?? '',
          amount: income.amount,
        }
      : { date: new Date().toISOString().split('T')[0] },
  })

  async function onSubmit(data: FormData) {
    const result = isEdit
      ? await updateIncome(income!.id, data)
      : await createIncome(data)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Gelir güncellendi.' : 'Gelir eklendi.')
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
          <Plus className="h-4 w-4" /> Gelir Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Geliri Düzenle' : 'Yeni Gelir Ekle'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="date">Tarih</Label>
                <Input id="date" type="date" {...register('date')} />
                {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="amount">Tutar (₺)</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0.00" {...register('amount', { valueAsNumber: true })} />
                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="title">Başlık</Label>
              <Input id="title" placeholder="Gelir başlığı" {...register('title')} />
              {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Kategori</Label>
              <Select
                defaultValue={income?.category ?? undefined}
                onValueChange={(v) => setValue('category', v ?? undefined)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea id="description" placeholder="Opsiyonel açıklama..." {...register('description')} />
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
