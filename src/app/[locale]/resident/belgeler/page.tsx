import { FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatFileSize, getFileTypeInfo } from '@/lib/utils'
import { SiteDocument } from '@/types'
import { getTranslations, setRequestLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

type Locale = 'tr' | 'en' | 'de' | 'fr' | 'ru'

function getLocalized(doc: SiteDocument, field: 'title' | 'description', locale: Locale): string {
  const localeKey = `${field}_${locale}` as keyof SiteDocument
  return (doc[localeKey] as string | null) || (doc[`${field}_tr` as keyof SiteDocument] as string) || ''
}

export default async function ResidentBelgelerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('belgeler')

  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false })

  const documents: SiteDocument[] = data ?? []
  const loc = (locale as Locale) in { tr: 1, en: 1, de: 1, fr: 1, ru: 1 } ? (locale as Locale) : 'tr'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{documents.length} {t('count_suffix')}</p>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <FileText className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const fileInfo  = getFileTypeInfo(doc.file_type, doc.file_name)
            const title     = getLocalized(doc, 'title', loc)
            const desc      = getLocalized(doc, 'description', loc)
            return (
              <Card key={doc.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${fileInfo.colorClass}`}>
                          {fileInfo.label}
                        </span>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                      </div>
                      <p className="text-xs text-gray-400">
                        {doc.file_name}
                        {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                        {' · '}
                        {formatDate(doc.uploaded_at)}
                      </p>
                      {desc && (
                        <p className="text-sm text-gray-600 mt-1">{desc}</p>
                      )}
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-700"
                    >
                      {t('download')}
                    </a>
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
