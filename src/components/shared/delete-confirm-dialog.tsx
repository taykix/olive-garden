'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteConfirmDialogProps {
  onConfirm: () => Promise<{ error?: string; success?: boolean }>
  label?: string
}

export function DeleteConfirmDialog({ onConfirm, label = 'Sil' }: DeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await onConfirm()
    setLoading(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Başarıyla silindi.')
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Silmek istediğinizden emin misiniz?</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Kayıt kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Siliniyor...' : label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
