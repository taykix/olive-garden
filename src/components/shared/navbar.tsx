'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Leaf, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/supabase/actions'
import { LanguageSwitcher } from './language-switcher'

interface NavbarProps {
  role?: 'admin' | 'resident' | null
  userName?: string | null
  showLanguageSwitcher?: boolean
}

const adminLinks = [
  { href: '/admin', label: 'Panel' },
  { href: '/admin/gelirler', label: 'Gelirler' },
  { href: '/admin/giderler', label: 'Giderler' },
  { href: '/admin/odemeler', label: 'Ödemeler' },
  { href: '/admin/duyurular', label: 'Duyurular' },
  { href: '/admin/yillik-isler', label: 'Yıllık İşler' },
  { href: '/admin/raporlar', label: 'Raporlar' },
  { href: '/admin/import', label: 'Veri Aktar' },
]

const residentLinks = [
  { href: '/resident', label: 'Ana Sayfa' },
]

export function Navbar({ role, userName, showLanguageSwitcher = false }: NavbarProps) {
  const [open, setOpen] = useState(false)
  const links = role === 'admin' ? adminLinks : role === 'resident' ? residentLinks : []

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href={role === 'admin' ? '/admin' : role === 'resident' ? '/resident' : '/'} className="flex items-center gap-2 font-semibold text-green-800">
            <div className="h-7 w-7 rounded-full bg-green-800 flex items-center justify-center">
              <Leaf className="h-3.5 w-3.5 text-green-100" />
            </div>
            <span className="hidden sm:inline">Olive Garden 2</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="px-3 py-1.5 text-sm rounded-md text-gray-700 hover:bg-gray-100 transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {showLanguageSwitcher && <LanguageSwitcher />}
            {userName && (
              <span className="hidden sm:block text-sm text-gray-500">{userName}</span>
            )}
            {role && (
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit" className="gap-1 text-gray-600">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Çıkış</span>
                </Button>
              </form>
            )}
            {/* Mobile menu button */}
            {links.length > 0 && (
              <button
                className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
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
        <div className="md:hidden border-t bg-white px-4 py-3 flex flex-col gap-1">
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
