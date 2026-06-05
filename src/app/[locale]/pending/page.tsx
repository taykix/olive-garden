import { Clock, LogOut } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, status')
    .eq('id', user.id)
    .single()

  if (profile?.status === 'approved') redirect('/resident')
  if (profile?.status === 'rejected') redirect('/login')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8faf5] px-6 text-center">
      <div className="max-w-md space-y-6">
        <Image src="/images/olive-branch.png" alt="" width={64} height={64} className="mx-auto opacity-70" />

        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Clock className="h-8 w-8 text-amber-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Üyeliğiniz İnceleniyor</h1>
          <p className="text-gray-500">
            Merhaba {profile?.full_name ? <strong>{profile.full_name}</strong> : 'sayın üyemiz'},
          </p>
          <p className="text-gray-500 text-sm leading-relaxed">
            Üyelik talebiniz alındı. Yönetici incelemesinin ardından hesabınız aktif hale getirilecek
            ve sisteme erişim sağlayabileceksiniz.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Onay süreci genellikle 1 iş günü içinde tamamlanmaktadır.
        </div>

        <form action={signOut}>
          <Button variant="outline" type="submit" className="gap-2">
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </Button>
        </form>
      </div>
    </div>
  )
}
