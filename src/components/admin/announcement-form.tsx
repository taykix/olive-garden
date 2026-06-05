'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { createAnnouncement, updateAnnouncement } from '@/lib/supabase/actions'
import { Announcement } from '@/types'
import { Plus, Pencil } from 'lucide-react'

type Lang = 'tr' | 'en' | 'de' | 'fr' | 'ru'
const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe',   flag: '🇹🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский',  flag: '🇷🇺' },
]

interface Fields { title: string; content: string }
type LangData = Record<Lang, Fields>

function empty(): Fields { return { title: '', content: '' } }

function fromAnnouncement(a: Announcement): LangData {
  return {
    tr: { title: a.title,         content: a.content },
    en: { title: a.title_en ?? '', content: a.content_en ?? '' },
    de: { title: a.title_de ?? '', content: a.content_de ?? '' },
    fr: { title: a.title_fr ?? '', content: a.content_fr ?? '' },
    ru: { title: a.title_ru ?? '', content: a.content_ru ?? '' },
  }
}

interface AnnouncementFormProps {
  announcement?: Announcement
}

export function AnnouncementForm({ announcement }: AnnouncementFormProps) {
  const isEdit = !!announcement
  const [open, setOpen]         = useState(false)
  const [tab, setTab]           = useState<Lang>('tr')
  const [data, setData]         = useState<LangData>(() =>
    announcement ? fromAnnouncement(announcement) : { tr: empty(), en: empty(), de: empty(), fr: empty(), ru: empty() }
  )
  const [published, setPublished] = useState(announcement?.published ?? false)
  const [saving, setSaving]     = useState(false)

  function handleOpen(v: boolean) {
    if (v && isEdit) {
      setData(fromAnnouncement(announcement!))
      setPublished(announcement!.published)
      setTab('tr')
    }
    setOpen(v)
  }

  function setField(lang: Lang, field: keyof Fields, value: string) {
    setData(prev => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }))
  }

  async function handleSave() {
    if (!data.tr.title.trim() || !data.tr.content.trim()) {
      toast.error('Türkçe başlık ve içerik zorunludur.')
      setTab('tr')
      return
    }
    setSaving(true)
    const payload = {
      title:      data.tr.title.trim(),
      content:    data.tr.content.trim(),
      title_en:   data.en.title.trim() || undefined,
      content_en: data.en.content.trim() || undefined,
      title_de:   data.de.title.trim() || undefined,
      content_de: data.de.content.trim() || undefined,
      title_fr:   data.fr.title.trim() || undefined,
      content_fr: data.fr.content.trim() || undefined,
      title_ru:   data.ru.title.trim() || undefined,
      content_ru: data.ru.content.trim() || undefined,
      published,
    }
    const result = isEdit
      ? await updateAnnouncement(announcement!.id, payload)
      : await createAnnouncement(payload)
    setSaving(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Duyuru güncellendi.' : 'Duyuru oluşturuldu.')
      setOpen(false)
      if (!isEdit) setData({ tr: empty(), en: empty(), de: empty(), fr: empty(), ru: empty() })
    }
  }

  const trMissing = !data.tr.title.trim() || !data.tr.content.trim()

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => handleOpen(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" className="gap-1" onClick={() => handleOpen(true)}>
          <Plus className="h-4 w-4" /> Duyuru Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Duyuruyu Düzenle' : 'Yeni Duyuru Oluştur'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dil tabları */}
            <div className="flex gap-1 border-b border-gray-200 pb-0">
              {LANGS.map(l => {
                const filled = data[l.code].title.trim() || data[l.code].content.trim()
                const isRequired = l.code === 'tr'
                return (
                  <button
                    key={l.code}
                    onClick={() => setTab(l.code)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                      tab === l.code
                        ? 'border-green-600 text-green-700 bg-green-50/50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                    {isRequired && (
                      <span className="text-red-400 text-xs">*</span>
                    )}
                    {!isRequired && filled && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-0.5" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Tab içerikleri */}
            {LANGS.map(l => (
              <div key={l.code} className={tab === l.code ? 'space-y-3' : 'hidden'}>
                {l.code !== 'tr' && (
                  <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
                    Boş bırakılırsa Türkçe içerik gösterilir.
                  </p>
                )}
                <div className="space-y-1">
                  <Label>Başlık {l.code === 'tr' && <span className="text-red-400">*</span>}</Label>
                  <Input
                    placeholder={`${l.label} başlık...`}
                    value={data[l.code].title}
                    onChange={e => setField(l.code, 'title', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>İçerik {l.code === 'tr' && <span className="text-red-400">*</span>}</Label>
                  <Textarea
                    placeholder={`${l.label} içerik...`}
                    rows={6}
                    value={data[l.code].content}
                    onChange={e => setField(l.code, 'content', e.target.value)}
                  />
                </div>
              </div>
            ))}

            {/* Yayın + butonlar */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={e => setPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Hemen yayınla
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
                <Button onClick={handleSave} disabled={saving || trMissing}>
                  {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Oluştur'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
