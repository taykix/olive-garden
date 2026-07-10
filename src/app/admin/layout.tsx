import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/shared/navbar'
import { NextIntlClientProvider } from 'next-intl'
import trMessages from '../../../messages/tr.json'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, status, email, apartment_no')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.role !== 'admin') redirect('/resident')

  return (
    <NextIntlClientProvider locale="tr" messages={trMessages}>
      <div className="min-h-screen bg-gray-50 print:bg-white">
        <Navbar
          role="admin"
          userName={profile?.full_name}
          userEmail={profile?.email ?? user.email ?? null}
          userApartmentNo={profile?.apartment_no}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </NextIntlClientProvider>
  )
}
