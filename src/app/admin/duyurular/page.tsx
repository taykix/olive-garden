import { Megaphone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { AnnouncementForm } from '@/components/admin/announcement-form'
import { AnnouncementToggle } from '@/components/admin/announcement-toggle'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { deleteAnnouncement } from '@/lib/supabase/actions'
import { Announcement } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DuyurularPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  const announcements: Announcement[] = data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duyurular</h1>
          <p className="text-gray-500 text-sm mt-1">{announcements.length} duyuru</p>
        </div>
        <AnnouncementForm />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">Veriler yüklenirken hata oluştu.</p>
      )}

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="Henüz duyuru yok" description="Yeni bir duyuru oluşturmak için 'Duyuru Ekle' butonunu kullanın." />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} className={!a.published ? 'opacity-60 border-dashed' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      <Badge variant={a.published ? 'default' : 'secondary'} className="text-xs">
                        {a.published ? 'Yayında' : 'Taslak'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">{a.content}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatDate(a.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <AnnouncementToggle id={a.id} published={a.published} />
                    <AnnouncementForm announcement={a} />
                    <DeleteConfirmDialog onConfirm={deleteAnnouncement.bind(null, a.id)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
