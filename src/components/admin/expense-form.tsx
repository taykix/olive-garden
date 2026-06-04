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
import { createExpense, updateExpense } from '@/lib/supabase/actions'
import { EXPENSE_CATEGORIES } from '@/lib/utils'
import { Expense } from '@/types'
import { Plus, Pencil } from 'lucide-react'

const schema = z.object({
  date: z.string().min(1, 'Tarih zorunludur'),
  title: z.string().min(1, 'Başlık zorunludur'),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().positive('Tutar sıfırdan büyük olmalıdır'),
  document_url: z.string().url('Geçerli bir URL giriniz').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

interface ExpenseFormProps {
  expense?: Expense
}

export function ExpenseForm({ expense }: ExpenseFormProps) {
  const [open, setOpen] = useState(false)
  const isEdit = !!expense

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: expense
      ? {
          date: expense.date,
          title: expense.title,
          description: expense.description ?? '',
          category: expense.category ?? '',
          amount: expense.amount,
          document_url: expense.document_url ?? '',
        }
      : { date: new Date().toISOString().split('T')[0] },
  })

  async function onSubmit(data: FormData) {
    const payload = {
      ...data,
      document_url: data.document_url || undefined,
    }
    const result = isEdit
      ? await updateExpense(expense!.id, payload)
      : await createExpense(payload)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Gider güncellendi.' : 'Gider eklendi.')
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
          <Plus className="h-4 w-4" /> Gider Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Gideri Düzenle' : 'Yeni Gider Ekle'}</DialogTitle>
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
              <Input id="title" placeholder="Gider başlığı" {...register('title')} />
              {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Kategori</Label>
              <Select
                defaultValue={expense?.category ?? undefined}
                onValueChange={(v) => setValue('category', v ?? undefined)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea id="description" placeholder="Opsiyonel açıklama..." {...register('description')} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="document_url">Belge URL (opsiyonel)</Label>
              <Input id="document_url" type="url" placeholder="https://..." {...register('document_url')} />
              {errors.document_url && <p className="text-xs text-red-500">{errors.document_url.message}</p>}
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
