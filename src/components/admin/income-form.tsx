'use client'

import { useEffect, useState } from 'react'
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
import { useTranslations } from 'next-intl'
import { createIncome, updateIncome } from '@/lib/supabase/actions'
import { createClient } from '@/lib/supabase/client'
import { INCOME_CATEGORIES, INCOME_CATEGORY_KEY } from '@/lib/utils'
import { Income } from '@/types'
import { Plus, Pencil } from 'lucide-react'

const SIRA_RE = /Defter S[ıi]ra No:\s*(\S+)/i

function extractSiraNo(desc: string | null): { siraNo: string; cleanDesc: string } {
  if (!desc) return { siraNo: '', cleanDesc: '' }
  const m = desc.match(SIRA_RE)
  if (m) {
    const cleanDesc = desc.replace(m[0], '').replace(/^\s*[·\-]+\s*|\s*[·\-]+\s*$/g, '').trim()
    return { siraNo: m[1], cleanDesc }
  }
  return { siraNo: '', cleanDesc: desc }
}

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

const supabase = createClient()

export function IncomeForm({ income }: IncomeFormProps) {
  const tCat = useTranslations('income_cat')
  const [open, setOpen] = useState(false)
  const [siraNo, setSiraNo] = useState('')
  const isEdit = !!income

  const catLabel = (c: string) => {
    const key = INCOME_CATEGORY_KEY[c]
    return key ? tCat(key) : c
  }

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: income
      ? {
          date: income.date,
          title: income.title,
          description: extractSiraNo(income.description).cleanDesc,
          category: income.category ?? '',
          amount: income.amount,
        }
      : { date: new Date().toISOString().split('T')[0] },
  })

  // Auto-fill next S.No in add mode
  useEffect(() => {
    if (!open || isEdit || siraNo.trim()) return
    supabase.from('income').select('description').ilike('description', 'Defter%No:%')
      .then(({ data: rows }) => {
        const nums: number[] = []
        rows?.forEach(r => {
          const m = ((r.description as string) || '').match(SIRA_RE)
          if (m) {
            const n = parseInt(m[1], 10)
            if (!isNaN(n) && n > 0) nums.push(n)
          }
        })
        setSiraNo(nums.length > 0 ? String(Math.max(...nums) + 1) : '1')
      })
  }, [open, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpen(v: boolean) {
    if (v && isEdit) {
      const { siraNo: sNo, cleanDesc } = extractSiraNo(income?.description ?? null)
      setSiraNo(sNo)
      setValue('description', cleanDesc)
    } else if (v && !isEdit) {
      setSiraNo('')
    }
    setOpen(v)
  }

  async function onSubmit(data: FormData) {
    const siraPrefix = siraNo.trim() ? `Defter Sıra No: ${siraNo.trim()} · ` : ''
    const fullDescription = siraPrefix + (data.description ?? '')

    const result = isEdit
      ? await updateIncome(income!.id, { ...data, description: fullDescription || undefined })
      : await createIncome({ ...data, description: fullDescription || undefined })

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Gelir güncellendi.' : 'Gelir eklendi.')
      setOpen(false)
      if (!isEdit) { reset(); setSiraNo('') }
    }
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => handleOpen(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" className="gap-1" onClick={() => handleOpen(true)}>
          <Plus className="h-4 w-4" /> Gelir Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpen}>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="title">Başlık</Label>
                <Input id="title" placeholder="Gelir başlığı" {...register('title')} />
                {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="siraNo">Defter Sıra No</Label>
                <Input
                  id="siraNo"
                  placeholder="örn: 42"
                  value={siraNo}
                  onChange={e => setSiraNo(e.target.value)}
                />
              </div>
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
                    <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea id="description" placeholder="Opsiyonel açıklama..." {...register('description')} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpen(false)}>İptal</Button>
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
