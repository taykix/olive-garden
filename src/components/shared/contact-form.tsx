'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { sendContactEmail } from '@/lib/actions/contact'
import { Mail, Phone, Send, CheckCircle2 } from 'lucide-react'

export function ContactForm() {
  const t = useTranslations('contact')
  const [senderEmail, setSenderEmail] = useState('')
  const [subject, setSubject]         = useState('')
  const [message, setMessage]         = useState('')
  const [phone, setPhone]             = useState('')
  const [sending, setSending]         = useState(false)
  const [success, setSuccess]         = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)
    const result = await sendContactEmail({ senderEmail, subject, message, phone: phone || undefined })
    setSending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-lg">{t('success_title')}</p>
          <p className="text-gray-500 text-sm mt-1">{t('success_desc')}</p>
        </div>
        <button
          onClick={() => { setSuccess(false); setSenderEmail(''); setSubject(''); setMessage(''); setPhone('') }}
          className="text-sm text-green-700 hover:underline mt-2"
        >
          {t('new_message')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-400 italic">{t('tip')}</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            {t('email_label')} <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            required
            value={senderEmail}
            onChange={e => setSenderEmail(e.target.value)}
            placeholder={t('email_placeholder')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {t('phone_label')} <span className="text-gray-400 text-xs font-normal">({t('phone_optional')})</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder={t('phone_placeholder')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          {t('subject_label')} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder={t('subject_placeholder')}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">
          {t('message_label')} <span className="text-red-400">*</span>
        </label>
        <textarea
          required
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={t('message_placeholder')}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        <Send className="h-4 w-4" />
        {sending ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}
