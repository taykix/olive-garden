'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { toggleAnnouncementPublished } from '@/lib/supabase/actions'

interface AnnouncementToggleProps {
  id: string
  published: boolean
}

export function AnnouncementToggle({ id, published }: AnnouncementToggleProps) {
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState(published)

  async function toggle() {
    setLoading(true)
    const result = await toggleAnnouncementPublished(id, !state)
    setLoading(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      setState(!state)
      toast.success(state ? 'Duyuru yayından kaldırıldı.' : 'Duyuru yayınlandı.')
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className={state ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}
      title={state ? 'Yayından kaldır' : 'Yayınla'}
    >
      {state ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </Button>
  )
}
