'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Menu, X, Leaf } from 'lucide-react'
import { LanguageSwitcher } from './language-switcher'
import { ProfileDropdown } from './profile-dropdown'

interface NavbarProps {
  role?: 'admin' | 'resident' | null
  userName?: string | null
  userEmail?: string | null
  userApartmentNo?: string | null
  showLanguageSwitcher?: boolean
}

export function Navbar({ role, userName, userEmail, userApartmentNo, showLanguageSwitcher = false }: NavbarProps) {
  const t = useTranslations('nav')
  const [open, setOpen] = useState(false)

  const adminLinks = [
    { href: '/admin',              label: t('panel') },
    { href: '/admin/gelirler',     label: t('income') },
    { href: '/admin/giderler',     label: t('expenses') },
    { href: '/admin/odemeler',     label: t('payments') },
    { href: '/admin/duyurular',    label: t('announcements') },
    { href: '/admin/yillik-isler', label: t('annual_works') },
    { href: '/admin/belgeler',     label: t('documents') },
    { href: '/admin/raporlar',     label: t('reports') },
    { href: '/admin/planlama',     label: t('planning') },
    { href: '/admin/import',       label: t('import') },
    { href: '/admin/kullanicilar', label: t('users') },
  ]

  const residentLinks = [
    { href: '/resident',           label: t('resident_home') },
    { href: '/resident/gelirler',  label: t('income') },
    { href: '/resident/giderler',  label: t('expenses') },
    { href: '/resident/odemeler',  label: t('payments') },
    { href: '/resident/belgeler',  label: t('documents') },
    { href: '/resident/raporlar',  label: t('reports') },
    { href: '/resident/planlama',  label: t('planning') },
  ]

  const links = role === 'admin' ? adminLinks : role === 'resident' ? residentLinks : []

  return (
    <header className="bg-white border-b shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href={role === 'admin' ? '/admin' : role === 'resident' ? '/resident' : '/'} className="flex items-center gap-2 font-semibold text-green-800">
            <div className="h-7 w-7 rounded-full bg-green-800 flex items-center justify-center">
              <Leaf className="h-3.5 w-3.5 text-green-100" />
            </div>
            <span className="hidden sm:inline">Olive Garden 3</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="px-2.5 py-1.5 text-sm rounded-md text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {showLanguageSwitcher && <LanguageSwitcher />}
            {role && (
              <ProfileDropdown
                userName={userName ?? null}
                userEmail={userEmail ?? null}
                apartmentNo={userApartmentNo ?? null}
                role={role}
              />
            )}
            {links.length > 0 && (
              <button
                className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
                onClick={() => setOpen(!open)}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden border-t bg-white px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-2 text-sm rounded-md text-gray-700 hover:bg-gray-100" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
