import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { Leaf, Megaphone, LogIn, ShieldCheck, Bell, Users, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')
  const nt = await getTranslations('nav')

  const supabase = await createClient()
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="min-h-screen bg-[#f8faf5]">

      {/* ── Top Nav ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-green-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-green-800 flex items-center justify-center">
              <Leaf className="h-4 w-4 text-green-100" />
            </div>
            <span className="font-bold text-green-900 text-lg tracking-tight">Olive Garden 3</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              {nt('login')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f2d0a] via-[#1a4a12] to-[#2d6b28]">
        {/* Decorative circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-green-700/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-green-600/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full border border-green-600/5" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-green-700/30 border border-green-600/30 text-green-200 px-4 py-1.5 rounded-full text-sm">
              <Leaf className="h-3.5 w-3.5" />
              {t('badge')}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              {t('hero_title')}<br />
              <span className="text-green-300">{t('hero_title_accent')}</span>
            </h1>
            <p className="text-green-100/80 text-lg max-w-lg leading-relaxed">
              {t('hero_subtitle')}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-white text-green-900 hover:bg-green-50 font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg"
              >
                <LogIn className="h-4 w-4" />
                {t('hero_cta')}
              </Link>
              <a
                href="#duyurular"
                className="inline-flex items-center gap-2 border border-green-500/40 text-green-200 hover:bg-green-800/30 px-6 py-3 rounded-xl transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
                {t('hero_scroll')}
              </a>
            </div>
          </div>

          {/* Right: photo placeholder */}
          <div className="hidden lg:flex items-center justify-center">
            {/*
              FOTOĞRAF ALANI
              Fotoğraf hazır olduğunda:
                <Image src="/images/hero.jpg" alt="Olive Garden 3" fill className="object-cover rounded-2xl" />
              şeklinde ekleyin ve bu div'i bir relative konumlu wrapper ile değiştirin.
            */}
            <div className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-green-600/30 bg-green-900/20 flex flex-col items-center justify-center gap-3 text-green-400/60">
              <Leaf className="h-16 w-16 opacity-30" />
              <p className="text-sm font-medium">{t('photo_placeholder')}</p>
              <p className="text-xs opacity-60">{t('photo_coming')}</p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-green-400/40 animate-bounce">
          <ChevronDown className="h-6 w-6" />
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{t('features_title')}</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">{t('features_subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: ShieldCheck, title: t('feat1_title'), desc: t('feat1_desc'), color: 'text-green-600', bg: 'bg-green-50' },
              { icon: Bell, title: t('feat2_title'), desc: t('feat2_desc'), color: 'text-amber-600', bg: 'bg-amber-50' },
              { icon: Users, title: t('feat3_title'), desc: t('feat3_desc'), color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className={`h-12 w-12 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Announcements ───────────────────────────────────── */}
      <section id="duyurular" className="py-20 bg-[#f0f5eb]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 mb-8">
            <Megaphone className="h-5 w-5 text-green-700" />
            <h2 className="text-2xl font-bold text-gray-900">{t('announcements_title')}</h2>
          </div>

          {!announcements?.length ? (
            <div className="rounded-2xl border border-green-100 bg-white p-12 text-center text-gray-400">
              {t('announcements_empty')}
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((a) => (
                <Card key={a.id} className="border-green-100 hover:shadow-md transition-shadow">
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{a.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{a.content}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs bg-green-100 text-green-700 border-0">
                        {formatDate(a.created_at)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-green-800 to-green-900">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <h2 className="text-3xl font-bold text-white">{t('cta_title')}</h2>
          <p className="text-green-200/80">{t('cta_subtitle')}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-green-900 hover:bg-green-50 font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg mt-2"
          >
            <LogIn className="h-4 w-4" />
            {t('cta_btn')}
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="bg-[#0f2d0a] py-8 text-center">
        <div className="flex items-center justify-center gap-2 text-green-400/60 text-sm">
          <Leaf className="h-3.5 w-3.5" />
          © {new Date().getFullYear()} {t('footer')}
        </div>
      </footer>
    </div>
  )
}
