'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Announcement } from '@/types'

function localize(a: Announcement, locale: string): { title: string; content: string } {
  if (locale === 'en' && a.title_en) return { title: a.title_en, content: a.content_en || a.content }
  if (locale === 'de' && a.title_de) return { title: a.title_de, content: a.content_de || a.content }
  return { title: a.title, content: a.content }
}

const MORE: Record<string, string> = { tr: 'Devamını oku', en: 'Read more', de: 'Weiterlesen' }
const LESS: Record<string, string> = { tr: 'Daha az göster', en: 'Show less', de: 'Weniger anzeigen' }

export function ExpandableAnnouncement({ a }: { a: Announcement }) {
  const locale = useLocale()
  const { title, content } = localize(a, locale)
  const [expanded, setExpanded] = useState(false)
  const isLong = content.length > 160

  return (
    <Card
      className="border-green-100 bg-white hover:shadow-md transition-shadow rounded-2xl cursor-pointer select-none"
      onClick={() => isLong && setExpanded(v => !v)}
    >
      <CardContent className="py-5 px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
            <p className={`text-sm text-gray-500 leading-relaxed whitespace-pre-line transition-all ${!expanded && isLong ? 'line-clamp-2' : ''}`}>
              {content}
            </p>
            {isLong && (
              <button className="mt-2 inline-flex items-center gap-1 text-xs text-green-700 font-medium hover:text-green-800">
                {expanded
                  ? <><ChevronUp className="h-3.5 w-3.5" /> {LESS[locale] ?? LESS.tr}</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> {MORE[locale] ?? MORE.tr}</>}
              </button>
            )}
          </div>
          <Badge className="shrink-0 text-xs bg-green-100 text-green-700 border-0 hover:bg-green-100">
            {formatDate(a.created_at)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
