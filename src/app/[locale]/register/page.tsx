import { createClient } from '@/lib/supabase/server'
import { RegisterForm } from '@/components/shared/register-form'

export default async function RegisterPage() {
  const supabase = await createClient()

  const { data: settingsData } = await supabase
    .from('apartment_settings')
    .select('apartment_no')
    .order('apartment_no')

  const apartments = settingsData?.map(s => s.apartment_no) ?? []

  return <RegisterForm apartments={apartments} />
}
