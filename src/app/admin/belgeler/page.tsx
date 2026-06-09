import { FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatFileSize, getFileTypeInfo } from '@/lib/utils'
import { DocumentForm } from '@/components/admin/document-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { deleteDocument } from '@/lib/supabase/actions'
import { SiteDocument } from '@/types'

export const dynamic = 'force-dynamic'

export default async function BelgelerPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false })

  const documents: SiteDocument[] = data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Belgeler</h1>
          <p className="text-gray-500 text-sm mt-1">{documents.length} belge</p>
        </div>
        <DocumentForm />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">Veriler yüklenirken hata oluştu.</p>
      )}

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="Henüz belge yok" description="Yeni bir belge eklemek için 'Belge Ekle' butonunu kullanın." />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const fileInfo = getFileTypeInfo(doc.file_type, doc.file_name)
            return (
              <Card key={doc.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${fileInfo.colorClass}`}>
                          {fileInfo.label}
                        </span>
                        <h3 className="font-semibold text-gray-900">{doc.title_tr}</h3>
                        <span className="text-xs flex items-center gap-1">
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-medium">TR</span>
                          {doc.title_en && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">EN</span>}
                          {doc.title_de && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-medium">DE</span>}
                          {doc.title_fr && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-medium">FR</span>}
                          {doc.title_ru && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-medium">RU</span>}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {doc.file_name}
                        {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                        {' · '}
                        {formatDate(doc.uploaded_at)}
                      </p>
                      {doc.description_tr && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{doc.description_tr}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-700"
                      >
                        İndir
                      </a>
                      <DocumentForm document={doc} />
                      <DeleteConfirmDialog onConfirm={deleteDocument.bind(null, doc.id)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
