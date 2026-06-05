'use server'

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
// Resend ücretsiz planda sadece hesaba kayıtlı adrese gönderilebilir.
// Domain doğrulandıktan sonra f.karakaya05@gmail.com yazılabilir.
const ADMIN_EMAIL = process.env.CONTACT_TO_EMAIL ?? 'f.karakaya05@gmail.com'

export interface ContactPayload {
  senderEmail: string
  subject: string
  message: string
  phone?: string
}

export async function sendContactEmail(payload: ContactPayload): Promise<{ error?: string }> {
  const { senderEmail, subject, message, phone } = payload

  if (!senderEmail || !subject || !message) {
    return { error: 'Lütfen tüm zorunlu alanları doldurun.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(senderEmail)) {
    return { error: 'Geçerli bir e-posta adresi girin.' }
  }

  const phoneSection = phone ? `\nTelefon: ${phone}` : ''

  const { error } = await resend.emails.send({
    from: 'Olive Garden 3 İletişim <onboarding@resend.dev>',
    to: ADMIN_EMAIL,
    replyTo: senderEmail,
    subject: `[Olive Garden 3] ${subject}`,
    text: `Gönderen: ${senderEmail}${phoneSection}\n\n${message}`,
  })

  if (error) {
    console.error('[contact] Resend error:', error)
    return { error: 'Mail gönderilemedi, lütfen daha sonra tekrar deneyin.' }
  }
  return {}
}
