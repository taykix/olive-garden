'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signIn } from '@/lib/supabase/actions'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import Link from 'next/link'

export default function LoginPage() {
  const t = useTranslations('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signIn(formData)
    if (result?.error) {
      setError(
        result.error === 'Invalid login credentials'
          ? t('error_invalid')
          : t('error_generic')
      )
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2d0a] via-[#1a4a12] to-[#2d6b28] flex flex-col items-center justify-center p-4">
      {/* Language switcher */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher light />
      </div>

      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white font-bold text-xl">
            <div className="h-9 w-9 rounded-full bg-green-700 flex items-center justify-center">
              <Leaf className="h-4.5 w-4.5 text-green-100" />
            </div>
            Olive Garden 3
          </Link>
          <p className="text-green-200/60 text-sm mt-1">Didim Akbük</p>
        </div>

        <Card className="border-green-900/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-gray-900">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="ornek@email.com"
                  required
                  autoComplete="email"
                  className="border-gray-200 focus:border-green-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="border-gray-200 focus:border-green-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800"
                disabled={loading}
              >
                {loading ? t('loading') : t('submit')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-green-200/60">
          <Link href="/" className="hover:text-white transition-colors">
            {t('back')}
          </Link>
        </p>
      </div>
    </div>
  )
}
