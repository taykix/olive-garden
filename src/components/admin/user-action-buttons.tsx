'use client'

import { useState } from 'react'
import { approveUser, rejectUser, deleteUser } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  userName: string
  status: string
  role: string
}

export function UserActionButtons({ userId, userName, status, role }: Props) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleApprove() {
    setLoading('approve')
    await approveUser(userId)
    toast.success(`${userName || 'Kullanıcı'} onaylandı.`)
    setLoading(null)
    router.refresh()
  }

  async function handleReject() {
    setLoading('reject')
    await rejectUser(userId)
    toast.success(`${userName || 'Kullanıcı'} reddedildi.`)
    setLoading(null)
    router.refresh()
  }

  async function handleDelete() {
    setLoading('delete')
    const result = await deleteUser(userId)
    setLoading(null)
    setConfirmDelete(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(`${userName || 'Kullanıcı'} silindi.`)
      router.refresh()
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        {status !== 'approved' && (
          <Button size="sm" onClick={handleApprove} disabled={!!loading}
            className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {loading === 'approve' ? '...' : 'Onayla'}
          </Button>
        )}
        {status !== 'rejected' && (
          <Button size="sm" variant="outline" onClick={handleReject} disabled={!!loading}
            className="text-red-600 border-red-200 hover:bg-red-50 gap-1 h-8">
            <XCircle className="h-3.5 w-3.5" />
            {loading === 'reject' ? '...' : status === 'approved' ? 'Engelle' : 'Reddet'}
          </Button>
        )}
        {status === 'rejected' && (
          <Button size="sm" variant="outline" onClick={handleApprove} disabled={!!loading}
            className="text-green-600 border-green-200 hover:bg-green-50 gap-1 h-8">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {loading === 'approve' ? '...' : 'Yeniden Onayla'}
          </Button>
        )}
        {role !== 'admin' && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={!!loading}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcıyı silmek istediğinizden emin misiniz?</DialogTitle>
            <DialogDescription>
              <strong>{userName || 'Bu kullanıcı'}</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={loading === 'delete'}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading === 'delete'}>
              {loading === 'delete' ? 'Siliniyor...' : 'Evet, Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
