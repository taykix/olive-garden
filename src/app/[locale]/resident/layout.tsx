import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { setRequestLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/shared/navbar'

export default async function ResidentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loc = await getLocale()
    const loginPath = loc === 'tr' ? '/login' : `/${loc}/login`
    redirect(loginPath)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, status, email, apartment_no')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.status === 'rejected') {
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        role="resident"
        userName={profile?.full_name}
        userEmail={profile?.email ?? user.email ?? null}
        userApartmentNo={profile?.apartment_no}
        showLanguageSwitcher
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
