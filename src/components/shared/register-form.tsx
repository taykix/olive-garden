'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp } from '@/lib/supabase/actions'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ApartmentCombobox } from '@/components/shared/apartment-combobox'
import { CheckCircle2 } from 'lucide-react'

interface RegisterFormProps {
  apartments: string[]
}

export function RegisterForm({ apartments }: RegisterFormProps) {
  const t = useTranslations('register')
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [needsEmail, setNeedsEmail] = useState(false)
  const [aptNo, setAptNo]         = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!aptNo) { setError(t('apt_no_selection')); return }
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('apartment_no', aptNo)
    const result = await signUp(fd)
    setLoading(false)
    if (result?.error) {
      setError(result.error === 'User already registered' ? t('existing_email') : result.error)
    } else if (result?.needsConfirmation) {
      setNeedsEmail(true)
    }
  }

  if (needsEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf5] px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{t('email_confirm_title')}</h2>
          <p className="text-gray-500 text-sm">{t('email_confirm_desc')}</p>
          <Link href="/login" className="text-sm text-green-700 hover:underline block">{t('back_to_login')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Sol panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <Image src="/images/olive-grove.jpg" alt="Olive Garden 3" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/25 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-12 h-full w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/olive-branch.png" alt="Olive Garden 3" width={44} height={44} className="drop-shadow-lg" />
            <span className="text-white text-xl font-bold tracking-tight drop-shadow">Olive Garden 3</span>
          </Link>
          <div className="text-white space-y-3">
            <div className="w-12 h-0.5 bg-white/50 rounded-full" />
            <h2 className="text-3xl font-bold leading-snug drop-shadow-lg">
              {t('hero_tagline1')}<br />{t('hero_tagline2')}
            </h2>
            <p className="text-white/70 text-sm">{t('hero_location')}</p>
          </div>
        </div>
      </div>

      {/* Sağ panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8faf5] px-6 py-10 relative">
        <div className="absolute top-5 right-5"><LanguageSwitcher /></div>

        <div className="w-full max-w-[380px] space-y-7">
          <div className="lg:hidden flex flex-col items-center gap-2">
            <Image src="/images/olive-branch.png" alt="Olive Garden 3" width={56} height={56} />
            <h1 className="text-xl font-bold text-green-800">Olive Garden 3</h1>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
            <p className="text-gray-400 text-sm mt-1">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm font-medium">{t('name_label')}</Label>
              <Input name="full_name" placeholder={t('name_placeholder')} required
                className="h-11 border-gray-200 bg-white focus-visible:ring-green-500 focus-visible:border-green-400" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm font-medium">{t('apt_label')}</Label>
              <ApartmentCombobox
                apartments={apartments}
                value={aptNo}
                onChange={setAptNo}
                placeholder={t('apt_placeholder')}
                invalidMessage={t('apt_invalid')}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm font-medium">{t('email_label')}</Label>
              <Input name="email" type="email" placeholder={t('email_placeholder')} required autoComplete="email"
                className="h-11 border-gray-200 bg-white focus-visible:ring-green-500 focus-visible:border-green-400" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm font-medium">{t('password_label')}</Label>
              <Input name="password" type="password" placeholder={t('password_placeholder')} required minLength={6} autoComplete="new-password"
                className="h-11 border-gray-200 bg-white focus-visible:ring-green-500 focus-visible:border-green-400" />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button type="submit" disabled={loading || !aptNo}
              className="w-full h-11 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl shadow-sm">
              {loading ? t('submitting') : t('submit')}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400">
            {t('already_member')}{' '}
            <Link href="/login" className="text-green-700 font-medium hover:underline">{t('sign_in_link')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
