'use server'

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)

// Gönderici adresi (Resend'de doğrulanmış domain). RESEND_FROM ile override edilebilir.
const FROM = process.env.RESEND_FROM ?? 'Olive Garden 3 <noreply@olivegardenakbuk.com>'
// Sıfırlama bağlantısının işaret edeceği site kök adresi.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://olivegardenakbuk.com').replace(/\/$/, '')

function buildEmail(link: string): { subject: string; html: string; text: string } {
  const subject = 'Olive Garden 3 · Şifre Sıfırlama / Password Reset'

  const text = [
    'OLIVE GARDEN 3 — Şifre Sıfırlama',
    '',
    'Merhaba,',
    'Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın ve yeni şifrenizi belirleyin:',
    '',
    link,
    '',
    'Bu bağlantı kısa bir süre için geçerlidir ve tek kullanımlıktır.',
    'Bağlantıyı kullanana kadar MEVCUT şifreniz geçerli kalır.',
    'Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; hesabınızda hiçbir şey değişmez.',
    '',
    '───────────────────────────────',
    '',
    'OLIVE GARDEN 3 — Password Reset',
    '',
    'Hello,',
    'To reset your password, click the link below and set a new password:',
    '',
    link,
    '',
    'This link is valid for a limited time and can be used once.',
    'Your CURRENT password stays valid until you use this link.',
    'If you did not request this, you can ignore this email — nothing will change.',
  ].join('\n')

  const btn = `<a href="${link}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Şifreyi Sıfırla / Reset Password</a>`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.6">
    <h2 style="color:#15803d;margin-bottom:4px">Olive Garden 3</h2>

    <h3 style="margin:16px 0 4px">Şifre Sıfırlama</h3>
    <p>Merhaba, şifrenizi sıfırlamak için aşağıdaki butona tıklayın ve yeni şifrenizi belirleyin:</p>
    <p style="text-align:center;margin:20px 0">${btn}</p>
    <p style="color:#6b7280;font-size:13px">Bu bağlantı kısa süre geçerlidir ve tek kullanımlıktır. Bağlantıyı kullanana kadar <strong>mevcut şifreniz geçerli kalır</strong>. Bu isteği siz yapmadıysanız e-postayı yok sayın — hesabınızda hiçbir şey değişmez.</p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />

    <h3 style="margin:16px 0 4px">Password Reset</h3>
    <p>Hello, to reset your password click the button below and set a new password:</p>
    <p style="text-align:center;margin:20px 0">${btn}</p>
    <p style="color:#6b7280;font-size:13px">This link is valid for a limited time and can be used once. Your <strong>current password stays valid</strong> until you use it. If you did not request this, ignore this email — nothing will change.</p>

    <p style="color:#9ca3af;font-size:12px;word-break:break-all">${link}</p>
  </div>`

  return { subject, html, text }
}

// Verilen e-postaya güvenli, tek kullanımlık bir şifre SIFIRLAMA BAĞLANTISI gönderir.
// Şifre burada DEĞİŞTİRİLMEZ — kullanıcı bağlantıya tıklayıp yeni şifresini belirleyene
// kadar mevcut şifresi geçerli kalır. Böylece "başkası adına şifre sıfırlama" (DoS) önlenir.
// Güvenlik: kullanıcı bulunamasa bile aynı "başarılı" sonucu döner (e-posta sızıntısı olmaz).
export async function requestPasswordReset(email: string): Promise<{ success?: boolean; error?: string }> {
  const clean = (email || '').trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(clean)) return { error: 'invalid_email' }

  const admin = createAdminClient()

  // Recovery bağlantısı üret. Kullanıcı yoksa hata döner → sızıntı olmaması için sessizce başarı.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: clean,
    options: { redirectTo: `${SITE_URL}/auth/confirm` },
  })
  if (error || !data?.properties?.hashed_token) {
    if (error) console.error('[password-reset] generateLink:', error.message)
    return { success: true }
  }

  const link = `${SITE_URL}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`
  const { subject, html, text } = buildEmail(link)

  const { error: mailErr } = await resend.emails.send({ from: FROM, to: clean, subject, html, text })
  if (mailErr) {
    console.error('[password-reset] Resend error:', mailErr)
    return { error: 'mail_failed' }
  }

  return { success: true }
}
