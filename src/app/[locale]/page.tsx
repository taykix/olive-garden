import { getTranslations, setRequestLocale } from 'next-intl/server'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Megaphone, LogIn, ShieldCheck, Bell, Users, ChevronDown, MapPin, Mail } from 'lucide-react'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { ExpandableAnnouncement } from '@/components/shared/expandable-announcement'
import { ContactForm } from '@/components/shared/contact-form'
import { PhotoCarousel } from '@/components/shared/photo-carousel'
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

      {/* ── Navbar ──────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-green-100/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/images/olive-branch.png"
              alt="Olive Garden 3"
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="font-bold text-green-900 text-base tracking-tight hidden sm:inline">
              Olive Garden 3
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{nt('login')}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero: Tam ekran fotoğraf ─────────────────────────── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <Image
          src="/images/olive-grove.jpg"
          alt="Olive Garden 3 - Didim Akbük"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient katmanı */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

        {/* İçerik */}
        <div className="relative z-10 text-center text-white max-w-3xl mx-auto px-6 space-y-6">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 text-white/90 px-4 py-1.5 rounded-full text-sm">
              <Image src="/images/olive-branch.png" alt="" width={18} height={18} className="object-contain opacity-90" />
              {t('badge')}
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold leading-tight drop-shadow-xl">
            {t('hero_title')}<br />
            <span className="text-green-300">{t('hero_title_accent')}</span>
          </h1>

          <p className="text-white/80 text-lg max-w-xl mx-auto leading-relaxed drop-shadow">
            {t('hero_subtitle')}
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-green-900 hover:bg-green-50 font-semibold px-7 py-3.5 rounded-xl transition-colors shadow-xl"
            >
              <LogIn className="h-4 w-4" />
              {t('hero_cta')}
            </Link>
            <a
              href="#duyurular"
              className="inline-flex items-center gap-2 border border-white/30 text-white hover:bg-white/10 backdrop-blur-sm px-7 py-3.5 rounded-xl transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
              {t('hero_scroll')}
            </a>
          </div>
        </div>

        {/* Aşağı ok */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronDown className="h-7 w-7" />
        </div>
      </section>

      {/* ── Site fotoğrafı + Zeytin dalı ────────────────────── */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Sol: Fotoğraf galerisi */}
          <div className="relative w-full max-w-[460px] mx-auto">
            <PhotoCarousel
              caption="Olive Garden 3 · Didim Akbük"
              slides={[
                { src: '/images/yilis_havuz.jpeg', alt: 'Olive Garden 3 havuzu' },
                { src: '/images/hero.jpg', alt: 'Olive Garden 3 bahçesi' },
              ]}
            />
            {/* Zeytin dalı dekorasyon */}
            <div className="absolute -bottom-10 -right-10 opacity-20 pointer-events-none">
              <Image src="/images/olive-branch.png" alt="" width={220} height={220} />
            </div>
          </div>

          {/* Sağ: Metin */}
          <div className="space-y-6">
            <div>
              <p className="text-green-600 font-medium text-sm uppercase tracking-widest mb-2">
                Olive Garden 3
              </p>
              <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                {t('features_title')}
              </h2>
            </div>
            <p className="text-gray-500 text-lg leading-relaxed">{t('features_subtitle')}</p>

            <div className="space-y-4 pt-2">
              {[
                { icon: ShieldCheck, title: t('feat1_title'), desc: t('feat1_desc'), color: 'text-green-600', bg: 'bg-green-50' },
                { icon: Bell, title: t('feat2_title'), desc: t('feat2_desc'), color: 'text-amber-600', bg: 'bg-amber-50' },
                { icon: Users, title: t('feat3_title'), desc: t('feat3_desc'), color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(({ icon: Icon, title, desc, color, bg }) => (
                <div key={title} className="flex gap-4 items-start">
                  <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm mt-4"
            >
              <LogIn className="h-4 w-4" />
              {t('hero_cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Duyurular ────────────────────────────────────────── */}
      <section id="duyurular" className="py-20 bg-[#f0f5eb]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-green-700/10 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-green-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{t('announcements_title')}</h2>
          </div>

          {!announcements?.length ? (
            <div className="rounded-2xl border border-green-100 bg-white p-12 text-center text-gray-400">
              {t('announcements_empty')}
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((a) => (
                <ExpandableAnnouncement key={a.id} a={a} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Konum ───────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-green-700/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('location_title')}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t('location_address')}</p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100 h-[420px]">
            <iframe
              title={t('location_map_title')}
              src="https://www.openstreetmap.org/export/embed.html?bbox=27.43267%2C37.39931%2C27.43667%2C37.40331&layer=mapnik&marker=37.401313107269765%2C27.43467001070739"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a> {t('osm_contrib')}
          </p>
        </div>
      </section>

      {/* ── İletişim ─────────────────────────────────────────── */}
      <section className="py-20 bg-[#f0f5eb]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-green-700/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('contact_title')}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t('contact_subtitle')}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="relative py-28 overflow-hidden">
        <Image
          src="/images/olive-grove.jpg"
          alt=""
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 max-w-2xl mx-auto px-6 text-center text-white space-y-5">
          <Image
            src="/images/olive-branch.png"
            alt=""
            width={60}
            height={60}
            className="mx-auto opacity-90"
          />
          <h2 className="text-3xl font-bold">{t('cta_title')}</h2>
          <p className="text-white/70">{t('cta_subtitle')}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-green-900 hover:bg-green-50 font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-xl"
          >
            <LogIn className="h-4 w-4" />
            {t('cta_btn')}
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="bg-[#0f1f0a] py-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex items-center justify-center gap-3 text-green-500/50 text-sm">
            <Image src="/images/olive-branch.png" alt="" width={20} height={20} className="opacity-30" />
            © {new Date().getFullYear()} {t('footer')}
          </div>
          <p className="text-green-500/40 text-xs">
            {t('credit')}: <span className="text-green-400/70 font-medium">Taylan Karakaya</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
