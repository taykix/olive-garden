'use server'

import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

// Gönderici adresi. Resend'de doğrulanmış domaindeki bir adres olmalıdır.
// RESEND_FROM env değişkeni ile override edilebilir (Resend doğrulama sırasında
// istenen tam adresi buraya yazın). Varsayılan: olivegardenakbuk.com.
const FROM = process.env.RESEND_FROM ?? 'Olive Garden 3 <noreply@olivegardenakbuk.com>'

// Okunması kolay (karışık karakter içermeyen) geçici şifre üretir.
function generateTempPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz'
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}

function buildEmail(tempPassword: string): { subject: string; html: string; text: string } {
  const subject = 'Olive Garden 3 · Geçici Şifreniz / Your Temporary Password'

  const text = [
    'OLIVE GARDEN 3 — Şifre Sıfırlama',
    '',
    'Merhaba,',
    'Hesabınız için geçici bir şifre oluşturuldu:',
    '',
    `    ${tempPassword}`,
    '',
    'Nasıl kullanılır:',
    '1) Giriş sayfasında e-postanız ve bu geçici şifre ile giriş yapın.',
    '2) Giriş yaptıktan sonra sağ üstteki profil simgesine tıklayın.',
    '3) "Şifre Değiştir" ile kendi yeni şifrenizi belirleyin.',
    '',
    'Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz',
    'yalnızca yukarıdaki geçici şifreyle değiştirilene kadar geçerli kalır.',
    '',
    '───────────────────────────────',
    '',
    'OLIVE GARDEN 3 — Password Reset',
    '',
    'Hello,',
    'A temporary password has been created for your account:',
    '',
    `    ${tempPassword}`,
    '',
    'How to use it:',
    '1) Sign in on the login page with your email and this temporary password.',
    '2) After signing in, click the profile icon in the top-right corner.',
    '3) Use "Change Password" to set your own new password.',
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n')

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.6">
    <h2 style="color:#15803d;margin-bottom:4px">Olive Garden 3</h2>

    <h3 style="margin:16px 0 4px">Geçici Şifreniz</h3>
    <p>Merhaba, hesabınız için geçici bir şifre oluşturuldu:</p>
    <p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center;font-family:monospace">${tempPassword}</p>
    <ol style="padding-left:18px">
      <li>Giriş sayfasında e-postanız ve bu geçici şifre ile giriş yapın.</li>
      <li>Giriş yaptıktan sonra <strong>sağ üstteki profil simgesine</strong> tıklayın.</li>
      <li><strong>"Şifre Değiştir"</strong> ile kendi yeni şifrenizi belirleyin.</li>
    </ol>
    <p style="color:#6b7280;font-size:13px">Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />

    <h3 style="margin:16px 0 4px">Your Temporary Password</h3>
    <p>Hello, a temporary password has been created for your account:</p>
    <p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;text-align:center;font-family:monospace">${tempPassword}</p>
    <ol style="padding-left:18px">
      <li>Sign in on the login page with your email and this temporary password.</li>
      <li>After signing in, click the <strong>profile icon in the top-right corner</strong>.</li>
      <li>Use <strong>"Change Password"</strong> to set your own new password.</li>
    </ol>
    <p style="color:#6b7280;font-size:13px">If you did not request this, you can ignore this email.</p>
  </div>`

  return { subject, html, text }
}

// Verilen e-postaya sahip kullanıcı için geçici şifre oluşturur, hesabın şifresini
// bununla günceller ve iki dilli (TR/EN) bir e-posta gönderir.
// Güvenlik: kullanıcı bulunamasa bile aynı "başarılı" mesajı döner (e-posta sızıntısı olmaz).
export async function requestPasswordReset(email: string): Promise<{ success?: boolean; error?: string }> {
  const clean = (email || '').trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(clean)) return { error: 'invalid_email' }

  const admin = createAdminClient()

  // Kullanıcıyı e-postaya göre bul
  let userId: string | null = null
  let page = 1
  // Küçük kullanıcı tabanı; tek sayfa yeterli, yine de sayfalama güvenli
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    const match = data.users.find(u => u.email?.toLowerCase() === clean)
    if (match) { userId = match.id; break }
    if (data.users.length < 1000) break
    page++
  }

  // Kullanıcı yoksa: sızıntı olmaması için yine başarı döndür (işlem yapılmaz)
  if (!userId) return { success: true }

  const tempPassword = generateTempPassword()
  const { subject, html, text } = buildEmail(tempPassword)

  // Önce e-postayı gönder; başarısızsa hesabı DEĞİŞTİRME (kilitlenmeyi önler)
  const { error: mailErr } = await resend.emails.send({ from: FROM, to: clean, subject, html, text })
  if (mailErr) {
    console.error('[password-reset] Resend error:', mailErr)
    return { error: 'mail_failed' }
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: tempPassword })
  if (updErr) {
    console.error('[password-reset] updateUser error:', updErr)
    return { error: 'update_failed' }
  }

  return { success: true }
}
