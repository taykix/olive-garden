'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="min-h-screen flex">

      {/* ── Sol panel: Fotoğraf ────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <Image
          src="/images/olive-grove.jpg"
          alt="Olive Garden 2 - Didim Akbük"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/25 to-transparent" />

        {/* İçerik */}
        <div className="relative z-10 flex flex-col justify-between p-12 h-full w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/olive-branch.png"
              alt="Olive Garden 2"
              width={44}
              height={44}
              className="drop-shadow-lg"
            />
            <span className="text-white text-xl font-bold tracking-tight drop-shadow">
              Olive Garden 2
            </span>
          </Link>

          {/* Alt: tagline */}
          <div className="text-white space-y-3">
            <div className="w-12 h-0.5 bg-white/50 rounded-full" />
            <h2 className="text-3xl font-bold leading-snug drop-shadow-lg">
              Saydam & Güvenilir<br />Site Yönetimi
            </h2>
            <p className="text-white/70 text-sm">Didim Akbük · Türkiye</p>
          </div>
        </div>
      </div>

      {/* ── Sağ panel: Form ────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8faf5] px-6 py-10 relative">
        {/* Dil seçici */}
        <div className="absolute top-5 right-5">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-[360px] space-y-8">

          {/* Mobile logo (sadece küçük ekranlarda) */}
          <div className="lg:hidden flex flex-col items-center gap-2">
            <Image
              src="/images/olive-branch.png"
              alt="Olive Garden 2"
              width={64}
              height={64}
            />
            <h1 className="text-xl font-bold text-green-800">Olive Garden 2</h1>
            <p className="text-sm text-gray-400">Didim Akbük</p>
          </div>

          {/* Başlık */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
            <p className="text-gray-400 text-sm mt-1">{t('subtitle')}</p>
          </div>

          {/* Form */}
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700 text-sm font-medium">
                {t('email')}
              </Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-700 text-sm font-medium">
                {t('password')}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="h-11 border-gray-200 bg-white focus-visible:ring-green-500 focus-visible:border-green-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl shadow-sm transition-colors"
              disabled={loading}
            >
              {loading ? t('loading') : t('submit')}
            </Button>
          </form>

          {/* Alt bağlantı */}
          <p className="text-center text-sm text-gray-400">
            <Link href="/" className="hover:text-green-700 transition-colors">
              {t('back')}
            </Link>
          </p>
        </div>

        {/* Alt köşe: zeytin dalı dekorasyon */}
        <div className="absolute bottom-0 left-0 opacity-10 pointer-events-none">
          <Image
            src="/images/olive-branch.png"
            alt=""
            width={180}
            height={180}
            className="rotate-[210deg]"
          />
        </div>
      </div>
    </div>
  )
}
