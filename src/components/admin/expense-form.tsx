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
import { useLocale } from 'next-intl'
import { createExpense, updateExpense, createBudgetItem } from '@/lib/supabase/actions'
import { createClient } from '@/lib/supabase/client'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KEY } from '@/lib/utils'
import { Expense, BudgetItem } from '@/types'
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
  document_url: z.string().url('Geçerli bir URL giriniz').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

interface ExpenseFormProps {
  expense?: Expense
  budgetItems?: BudgetItem[]
}

const NEW_SENTINEL = '__new__'
const supabase = createClient()

export function ExpenseForm({ expense, budgetItems = [] }: ExpenseFormProps) {
  const tCat = useTranslations('expense_cat')
  const locale = useLocale()
  const [open, setOpen]               = useState(false)
  const [budgetItemId, setBudgetItemId] = useState<string>(expense?.budget_item_id ?? '')
  const [newItemName, setNewItemName] = useState('')
  const [siraNo, setSiraNo]           = useState('')
  const isEdit = !!expense

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: expense
      ? {
          date: expense.date,
          title: expense.title,
          description: extractSiraNo(expense.description).cleanDesc,
          category: expense.category ?? '',
          amount: expense.amount,
          document_url: expense.document_url ?? '',
        }
      : { date: new Date().toISOString().split('T')[0] },
  })

  // Auto-fill next S.No in add mode
  useEffect(() => {
    if (!open || isEdit || siraNo.trim()) return
    supabase.from('expenses').select('description').ilike('description', 'Defter%No:%')
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
    setOpen(v)
    if (v) {
      setBudgetItemId(expense?.budget_item_id ?? '')
      setNewItemName('')
      if (isEdit) {
        const { siraNo: sNo, cleanDesc } = extractSiraNo(expense?.description ?? null)
        setSiraNo(sNo)
        setValue('description', cleanDesc)
      } else {
        setSiraNo('')
      }
    }
  }

  async function onSubmit(data: FormData) {
    let finalBudgetItemId: string | null = budgetItemId || null

    if (budgetItemId === NEW_SENTINEL) {
      const name = newItemName.trim()
      if (!name) { toast.error('Harcama konusu adı gereklidir.'); return }
      const nextSort = budgetItems.length > 0 ? Math.max(...budgetItems.map(i => i.sort_order)) + 1 : 1
      const res = await createBudgetItem({
        category: name.toUpperCase(),
        sort_order: nextSort,
        expense_categories: [],
      })
      if (res.error || !res.id) { toast.error(res.error ?? 'Harcama konusu oluşturulamadı.'); return }
      finalBudgetItemId = res.id
    }

    const siraPrefix = siraNo.trim() ? `Defter Sıra No: ${siraNo.trim()} · ` : ''
    const fullDescription = siraPrefix + (data.description ?? '')

    const payload = {
      ...data,
      description: fullDescription || undefined,
      document_url: data.document_url || undefined,
      budget_item_id: finalBudgetItemId,
    }
    const result = isEdit
      ? await updateExpense(expense!.id, payload)
      : await createExpense(payload)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Gider güncellendi.' : 'Gider eklendi.')
      setOpen(false)
      if (!isEdit) { reset(); setBudgetItemId(''); setNewItemName(''); setSiraNo('') }
    }
  }

  const selectedItem = budgetItems.find(b => b.id === budgetItemId)
  const budgetLabel = (item: BudgetItem) =>
    locale === 'en' && item.category_en ? item.category_en : item.category
  const catLabel = (c: string) => {
    const key = EXPENSE_CATEGORY_KEY[c]
    return key ? tCat(key) : c
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => handleOpen(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" className="gap-1" onClick={() => handleOpen(true)}>
          <Plus className="h-4 w-4" /> Gider Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpen}>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="title">Başlık</Label>
                <Input id="title" placeholder="Gider başlığı" {...register('title')} />
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

            {/* Yıllık İşletme Planı bağlantısı */}
            <div className="space-y-1">
              <Label>Harcama Konusu (İşletme Planı)</Label>
              <Select
                value={budgetItemId || 'none'}
                onValueChange={v => { setBudgetItemId(!v || v === 'none' ? '' : v); setNewItemName('') }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Harcama konusu seçin (opsiyonel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Bağlantı yok —</SelectItem>
                  {budgetItems.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="text-gray-400 text-xs mr-1">{b.sort_order}.</span>
                      {budgetLabel(b)}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_SENTINEL} className="text-blue-600 font-medium">
                    + Yeni harcama konusu oluştur
                  </SelectItem>
                </SelectContent>
              </Select>
              {selectedItem && (
                <p className="text-xs text-green-700 font-medium mt-1">✓ {budgetLabel(selectedItem)}</p>
              )}
            </div>

            {budgetItemId === NEW_SENTINEL && (
              <div className="space-y-1">
                <Label htmlFor="newItemName">Yeni Harcama Konusu Adı</Label>
                <Input
                  id="newItemName"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="Örn: ÇEVRE DÜZENLEMESI"
                  className="uppercase"
                />
                <p className="text-xs text-gray-400">İşletme planına yeni bir satır olarak eklenecek.</p>
              </div>
            )}

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
                    <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>
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
