import { createAdminClient } from '@/lib/supabase/admin'
import { RegisterForm } from '@/components/shared/register-form'

export default async function RegisterPage() {
  // Admin client kullanıyoruz çünkü kayıt sayfasına anonim erişilir,
  // RLS apartment_settings'e anonim okuma izni vermiyor.
  const admin = createAdminClient()

  const { data: settingsData } = await admin
    .from('apartment_settings')
    .select('apartment_no')
    .order('apartment_no')

  const apartments = settingsData?.map((s: { apartment_no: string }) => s.apartment_no) ?? []

  return <RegisterForm apartments={apartments} />
}
