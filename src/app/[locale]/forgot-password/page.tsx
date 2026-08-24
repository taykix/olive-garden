'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { requestPasswordReset } from '@/lib/actions/password-reset'

export default function ForgotPasswordPage() {
  const t = useTranslations('forgot')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const email = formData.get('email') as string
    const result = await requestPasswordReset(email)
    setLoading(false)
    if (result?.error) {
      setError(
        result.error === 'invalid_email' ? t('error_invalid')
        : result.error === 'mail_failed' ? t('error_mail')
        : t('error_generic')
      )
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf5] px-6 py-10 relative">
      <div className="absolute top-5 right-5">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[360px] space-y-8">
        <div className="flex flex-col items-center gap-2">
          <Image src="/images/olive-branch.png" alt="Olive Garden 3" width={56} height={56} />
          <h1 className="text-xl font-bold text-green-800">Olive Garden 3</h1>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          <p className="text-gray-400 text-sm mt-1">{t('subtitle')}</p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
              {t('success')}
            </div>
            <Link
              href="/login"
              className="block text-center w-full h-11 leading-[2.75rem] bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl transition-colors"
            >
              {t('back_to_login')}
            </Link>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700 text-sm font-medium">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ornek@email.com"
                required
                autoComplete="email"
                className="h-11 border-gray-200 bg-white focus-visible:ring-green-500 focus-visible:border-green-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl shadow-sm transition-colors"
              disabled={loading}
            >
              {loading ? t('sending') : t('submit')}
            </Button>

            <p className="text-center text-sm text-gray-400">
              <Link href="/login" className="hover:text-green-700 transition-colors">{t('back_to_login')}</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
