'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { changePassword } from '@/lib/supabase/actions'

export default function ResetPasswordPage() {
  const t = useTranslations('reset')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const pw = String(formData.get('new_password') ?? '')
    const confirm = String(formData.get('confirm_password') ?? '')
    if (pw.length < 6) { setError(t('error_min')); return }
    if (pw !== confirm) { setError(t('error_match')); return }

    setLoading(true)
    const res = await changePassword({}, formData)
    setLoading(false)
    if (res.error) { setError(t('error_generic')); return }
    setDone(true)
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

        {done ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
              {t('success')}
            </div>
            <Link
              href="/login"
              className="block text-center w-full h-11 leading-[2.75rem] bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl transition-colors"
            >
              {t('go_login')}
            </Link>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="new_password" className="text-gray-700 text-sm font-medium">{t('new_password')}</Label>
              <Input
                id="new_password"
                name="new_password"
                type="password"
                placeholder={t('placeholder_min')}
                required
                autoComplete="new-password"
                className="h-11 border-gray-200 bg-white focus-visible:ring-green-500 focus-visible:border-green-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password" className="text-gray-700 text-sm font-medium">{t('confirm_password')}</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder={t('placeholder_confirm')}
                required
                autoComplete="new-password"
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
              {loading ? t('saving') : t('submit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
