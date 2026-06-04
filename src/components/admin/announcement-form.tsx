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
import { toast } from 'sonner'
import { createAnnouncement, updateAnnouncement } from '@/lib/supabase/actions'
import { Announcement } from '@/types'
import { Plus, Pencil } from 'lucide-react'

const schema = z.object({
  title: z.string().min(1, 'Başlık zorunludur'),
  content: z.string().min(1, 'İçerik zorunludur'),
  published: z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

interface AnnouncementFormProps {
  announcement?: Announcement
}

export function AnnouncementForm({ announcement }: AnnouncementFormProps) {
  const [open, setOpen] = useState(false)
  const isEdit = !!announcement

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: announcement
      ? {
          title: announcement.title,
          content: announcement.content,
          published: announcement.published,
        }
      : { published: false },
  })

  async function onSubmit(data: FormData) {
    const result = isEdit
      ? await updateAnnouncement(announcement!.id, data)
      : await createAnnouncement(data)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Duyuru güncellendi.' : 'Duyuru oluşturuldu.')
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
          <Plus className="h-4 w-4" /> Duyuru Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Duyuruyu Düzenle' : 'Yeni Duyuru Oluştur'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">Başlık</Label>
              <Input id="title" placeholder="Duyuru başlığı" {...register('title')} />
              {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="content">İçerik</Label>
              <Textarea id="content" placeholder="Duyuru içeriği..." rows={6} {...register('content')} />
              {errors.content && <p className="text-xs text-red-500">{errors.content.message}</p>}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="published" {...register('published')} className="h-4 w-4 rounded border-gray-300" />
              <Label htmlFor="published" className="cursor-pointer">Hemen yayınla</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Oluştur'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
