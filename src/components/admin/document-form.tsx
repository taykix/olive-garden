'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Pencil, File } from 'lucide-react'
import { createDocument, updateDocument } from '@/lib/supabase/actions'
import { createClient } from '@/lib/supabase/client'
import { formatFileSize } from '@/lib/utils'
import { SiteDocument } from '@/types'

const supabaseClient = createClient()

type Lang = 'tr' | 'en' | 'de' | 'fr' | 'ru'
const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'tr', label: 'Türkçe',   flag: '🇹🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский',  flag: '🇷🇺' },
]

interface LangFields { title: string; description: string }
type LangData = Record<Lang, LangFields>

function emptyFields(): LangFields { return { title: '', description: '' } }

function fromDocument(doc: SiteDocument): LangData {
  return {
    tr: { title: doc.title_tr,          description: doc.description_tr ?? '' },
    en: { title: doc.title_en ?? '',    description: doc.description_en ?? '' },
    de: { title: doc.title_de ?? '',    description: doc.description_de ?? '' },
    fr: { title: doc.title_fr ?? '',    description: doc.description_fr ?? '' },
    ru: { title: doc.title_ru ?? '',    description: doc.description_ru ?? '' },
  }
}

interface Props { document?: SiteDocument }

export function DocumentForm({ document: doc }: Props) {
  const isEdit = !!doc
  const [open, setOpen]             = useState(false)
  const [tab, setTab]               = useState<Lang>('tr')
  const [data, setData]             = useState<LangData>(() =>
    doc ? fromDocument(doc) : { tr: emptyFields(), en: emptyFields(), de: emptyFields(), fr: emptyFields(), ru: emptyFields() }
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleOpen(v: boolean) {
    if (v && isEdit) {
      setData(fromDocument(doc!))
      setTab('tr')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    setOpen(v)
  }

  function setField(lang: Lang, field: keyof LangFields, value: string) {
    setData(prev => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }))
  }

  async function handleSave() {
    if (!data.tr.title.trim()) {
      toast.error('Türkçe başlık zorunludur.')
      setTab('tr')
      return
    }
    if (!isEdit && !selectedFile) {
      toast.error('Lütfen bir dosya seçin.')
      return
    }

    setSaving(true)

    let fileUrl       = doc?.file_url     ?? ''
    let storagePath   = doc?.storage_path ?? ''
    let fileName      = doc?.file_name    ?? ''
    let fileSize: number | null = doc?.file_size ?? null
    let fileType: string | null = doc?.file_type ?? null
    let oldStoragePath: string | undefined

    if (selectedFile) {
      const ext  = selectedFile.name.split('.').pop() ?? ''
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await supabaseClient.storage
        .from('documents')
        .upload(path, selectedFile, { contentType: selectedFile.type })
      if (uploadError) {
        toast.error(`Dosya yüklenemedi: ${uploadError.message}`)
        setSaving(false)
        return
      }
      const { data: { publicUrl } } = supabaseClient.storage.from('documents').getPublicUrl(path)
      if (isEdit && doc!.storage_path) oldStoragePath = doc!.storage_path
      fileUrl     = publicUrl
      storagePath = path
      fileName    = selectedFile.name
      fileSize    = selectedFile.size
      fileType    = selectedFile.type
    }

    const payload = {
      title_tr:        data.tr.title.trim(),
      title_en:        data.en.title.trim() || null,
      title_de:        data.de.title.trim() || null,
      title_fr:        data.fr.title.trim() || null,
      title_ru:        data.ru.title.trim() || null,
      description_tr:  data.tr.description.trim() || null,
      description_en:  data.en.description.trim() || null,
      description_de:  data.de.description.trim() || null,
      description_fr:  data.fr.description.trim() || null,
      description_ru:  data.ru.description.trim() || null,
      file_url:    fileUrl,
      file_name:   fileName,
      storage_path: storagePath,
      file_size:   fileSize,
      file_type:   fileType,
    }

    const result = isEdit
      ? await updateDocument(doc!.id, payload, oldStoragePath)
      : await createDocument(payload)

    setSaving(false)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? 'Belge güncellendi.' : 'Belge eklendi.')
      setOpen(false)
      if (!isEdit) {
        setData({ tr: emptyFields(), en: emptyFields(), de: emptyFields(), fr: emptyFields(), ru: emptyFields() })
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="sm" onClick={() => handleOpen(true)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" className="gap-1" onClick={() => handleOpen(true)}>
          <Plus className="h-4 w-4" /> Belge Ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Belgeyi Düzenle' : 'Yeni Belge Ekle'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1">
            {/* File upload */}
            <div className="space-y-1.5">
              <Label>
                Dosya {!isEdit && <span className="text-red-400">*</span>}
              </Label>
              {isEdit && doc && !selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm text-gray-600">
                  <File className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="truncate flex-1">{doc.file_name}</span>
                  {doc.file_size && <span className="text-gray-400 text-xs shrink-0">{formatFileSize(doc.file_size)}</span>}
                </div>
              )}
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md text-sm text-green-700">
                  <File className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="truncate flex-1">{selectedFile.name}</span>
                  <span className="text-green-600 text-xs shrink-0">{formatFileSize(selectedFile.size)}</span>
                </div>
              )}
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.csv,.txt"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              {isEdit && (
                <p className="text-xs text-gray-400">Dosyayı değiştirmek istemiyorsanız boş bırakın.</p>
              )}
            </div>

            {/* Lang tabs */}
            <div className="flex gap-1 border-b border-gray-200">
              {LANGS.map(l => {
                const filled = data[l.code].title.trim() || data[l.code].description.trim()
                return (
                  <button
                    key={l.code}
                    onClick={() => setTab(l.code)}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                      tab === l.code
                        ? 'border-green-600 text-green-700 bg-green-50/50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span className="uppercase text-xs font-semibold">{l.code}</span>
                    {l.code === 'tr' && <span className="text-red-400 text-xs leading-none">*</span>}
                    {l.code !== 'tr' && filled && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
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
                  <Label>Açıklama</Label>
                  <Textarea
                    placeholder={`${l.label} açıklama... (opsiyonel)`}
                    rows={3}
                    value={data[l.code].description}
                    onChange={e => setField(l.code, 'description', e.target.value)}
                  />
                </div>
              </div>
            ))}

          </div>

          {/* Actions — sabit alt bar */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 mt-2 shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving || !data.tr.title.trim()}>
              {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Ekle'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
