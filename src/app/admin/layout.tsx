import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/shared/navbar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, status')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'pending') redirect('/pending')
  if (profile?.role !== 'admin') redirect('/resident')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="admin" userName={profile?.full_name} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
