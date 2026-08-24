import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Şifre sıfırlama bağlantısı buraya gelir. token_hash doğrulanır, recovery oturumu
// kurulur (çerezler set edilir) ve yeni şifre belirleme sayfasına yönlendirilir.
// Bu rota i18n middleware'inden hariç tutulmuştur (bkz. proxy.ts matcher).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) redirect('/reset-password')
  }

  // Geçersiz/süresi dolmuş bağlantı → yeni bağlantı istemesi için
  redirect('/forgot-password?expired=1')
}
