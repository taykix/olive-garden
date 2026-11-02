'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from './server'
import { createAdminClient } from './admin'
import { getPeriod, ACTIVE_PERIOD, BUDGET_BASE_PERIOD_ID, PERIODS, periodOfPayment } from '@/lib/periods'
import { isAidatCategory as isAidatCat } from '@/lib/reconcile'
import { RECEIPT_BUCKET, RECEIPT_PREFIX } from '@/lib/special-charges'

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Giriş başarısız.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single()

  // Son giriş tarihini güncelle
  await supabase.from('profiles').update({ last_sign_in_at: new Date().toISOString() }).eq('id', user.id)

  if (profile?.status === 'rejected') {
    await supabase.auth.signOut()
    return { error: 'Üyelik talebiniz reddedilmiştir. Detay için yöneticiyle iletişime geçin.' }
  }

  revalidatePath('/', 'layout')
  if (profile?.status === 'pending') redirect('/pending')
  redirect(profile?.role === 'admin' ? '/admin' : '/resident')
}

export async function signUp(formData: FormData): Promise<{ error?: string; needsConfirmation?: boolean }> {
  const supabase = await createClient()
  const email      = formData.get('email') as string
  const password   = formData.get('password') as string
  const fullName   = formData.get('full_name') as string
  const apartmentNo = formData.get('apartment_no') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        apartment_no: apartmentNo || null,
      },
    },
  })

  if (error) return { error: error.message }

  // Email onayı gerekiyorsa session null olur
  if (!data.session) return { needsConfirmation: true }

  revalidatePath('/', 'layout')
  redirect('/pending')
}

export async function approveUser(userId: string) {
  const supabase = await createClient()
  await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId)
  revalidatePath('/admin/kullanicilar')
}

export async function rejectUser(userId: string) {
  const supabase = await createClient()
  await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId)
  revalidatePath('/admin/kullanicilar')
}

export async function deleteUser(userId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Yetkisiz.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Yetkisiz.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath('/admin/kullanicilar')
  return { success: true }
}

export async function changePassword(
  _prev: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const newPassword = formData.get('new_password') as string
  const confirm    = formData.get('confirm_password') as string

  if (!newPassword || newPassword.length < 6) return { error: 'Şifre en az 6 karakter olmalıdır.' }
  if (newPassword !== confirm) return { error: 'Şifreler eşleşmiyor.' }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

// ─── Income ──────────────────────────────────────────────────────────────────

export async function createIncome(data: {
  date: string
  title: string
  description?: string
  category?: string
  amount: number
}) {
  // Aidat gelirleri elle eklenmez — "Aidat / Ödeme Takibi" sayfasından girilir ve
  // ödeme kaydıyla birlikte gelire otomatik yansır. Aksi halde aidat tablosuyla
  // bağı kopuk kayıtlar oluşuyor (bkz. ödeme→gelir senkronu tek yönlü).
  if (isAidatCat(data.category)) {
    return { error: 'Aidat gelirleri buradan eklenemez. Lütfen "Aidat / Ödeme Takibi" sayfasından ödeme girin — gelire otomatik yansır.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('income').insert({
    ...data,
    created_by: user?.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin')
  return { success: true }
}

export async function updateIncome(
  id: string,
  data: {
    date: string
    title: string
    description?: string
    category?: string
    amount: number
  }
) {
  const supabase = await createClient()

  // Bu gelir bir aidat ödemesine bağlı mı?
  const [{ data: linkedPayment }, { data: current }] = await Promise.all([
    supabase.from('payments').select('id').eq('income_id', id).maybeSingle(),
    supabase.from('income').select('category').eq('id', id).maybeSingle(),
  ])

  // Bağlantısız bir geliri sonradan "Aidat" yapmak tabloyu bozar → engelle.
  // (Zaten Aidat olan bağlantısız eski kayıtların düzenlenmesine izin verilir; Mutabakat'tan bağlanmalı.)
  if (!linkedPayment && isAidatCat(data.category) && !isAidatCat(current?.category)) {
    return { error: 'Aidat gelirleri buradan eklenemez. Ödemeyi "Aidat / Ödeme Takibi" sayfasından girin ya da Mutabakat sayfasından bir ödemeye bağlayın.' }
  }

  // Bağlı aidat gelirinin kategorisi değiştirilemez (aksi halde aidat tablosuyla bağ kopar)
  const payload = linkedPayment ? { ...data, category: 'Aidat' } : data

  const { error } = await supabase.from('income').update(payload).eq('id', id)
  if (error) return { error: error.message }

  // Aidat tablosu ile Gelirler senkron kalsın: tutar/tarih değişikliği ödemeye de yansır.
  // (Eskiden yansımıyordu — aidat tablosu ile gelirlerin ayrışmasının ana sebebi.)
  if (linkedPayment) {
    const { error: pErr } = await supabase.from('payments')
      .update({ amount_paid: data.amount, payment_date: data.date })
      .eq('id', linkedPayment.id)
    if (pErr) return { error: `Gelir güncellendi ama aidat kaydı güncellenemedi: ${pErr.message}` }
  }

  // Gelir bir ek ödemeye (ör. ASKİ) bağlıysa tutar/tarih senkron kalsın
  await supabase.from('special_charge_payments')
    .update({ amount_paid: data.amount, payment_date: data.date })
    .eq('income_id', id)
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin/ek-odemeler')
  revalidateAidat()
  return { success: true }
}

export async function deleteIncome(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('income').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin/odemeler')
  revalidatePath('/admin/ek-odemeler')
  revalidatePath('/admin')
  return { success: true }
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function createExpense(data: {
  date: string
  title: string
  description?: string
  category?: string
  amount: number
  document_url?: string
  budget_item_id?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('expenses').insert({
    ...data,
    created_by: user?.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/giderler')
  revalidatePath('/admin')
  return { success: true }
}

export async function updateExpense(
  id: string,
  data: {
    date: string
    title: string
    description?: string
    category?: string
    amount: number
    document_url?: string
    budget_item_id?: string | null
  }
) {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/giderler')
  revalidatePath('/admin')
  return { success: true }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/giderler')
  revalidatePath('/admin')
  return { success: true }
}

// ─── Payments ────────────────────────────────────────────────────────────────

// Aidat ödemesinin Gelirler'deki karşılığı (başlık/açıklama/tarih) — tek kaynak.
function aidatIncomeFields(d: {
  apartment_no: string
  resident_name?: string | null
  month: number
  year: number
  amount_paid?: number | null
  payment_date?: string | null
  serial_no?: string | null
}) {
  const TR_MONTHS = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  const monthName = TR_MONTHS[d.month] ?? ''
  const namePart = d.resident_name ? ` · ${d.resident_name}` : ''
  const siraPrefix = d.serial_no ? `Defter Sıra No: ${d.serial_no} · ` : ''
  return {
    date: d.payment_date || `${d.year}-${String(d.month).padStart(2, '0')}-01`,
    title: d.resident_name ? `${d.resident_name} - Aidat Ödemesi` : `Daire ${d.apartment_no} - Aidat Ödemesi`,
    description: `${siraPrefix}Daire ${d.apartment_no}${namePart} · ${monthName} ${d.year} Aidat Ödemesi`,
    category: 'Aidat',
    amount: Number(d.amount_paid ?? 0),
    apartment_no: d.apartment_no,
  }
}

function revalidateAidat() {
  revalidatePath('/admin/odemeler')
  revalidatePath('/admin/odemeler/mutabakat')
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin')
}

export async function createPayment(data: {
  apartment_no: string
  resident_name?: string
  month: number
  year: number
  amount_due: number
  amount_paid?: number
  payment_status: string
  payment_date?: string
  note?: string
  serial_no?: string
  period_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { serial_no, ...paymentData } = data
  const paid = Number(data.amount_paid ?? 0)

  // Yalnızca pozitif tahsilatlar gelire yansır (gelir tutarı > 0 olmak zorunda).
  // Eskiden gelir eklenemezse ödeme yine de bağlantısız kaydediliyordu → tablolar ayrışıyordu.
  let income_id: string | null = null
  if (paid > 0) {
    const { data: incomeRow, error: incomeError } = await supabase
      .from('income')
      .insert({ ...aidatIncomeFields(data), created_by: user?.id ?? null })
      .select('id')
      .single()
    if (incomeError || !incomeRow) return { error: `Gelir kaydı oluşturulamadı: ${incomeError?.message ?? ''}` }
    income_id = incomeRow.id as string
  }

  const { error } = await supabase.from('payments').insert({
    ...paymentData,
    serial_no: serial_no ?? null,
    income_id,
    period_id: data.period_id ?? ACTIVE_PERIOD.id,
  })
  if (error) {
    if (income_id) await supabase.from('income').delete().eq('id', income_id)
    return { error: error.message }
  }

  revalidateAidat()
  return { success: true }
}

export async function updatePayment(
  id: string,
  data: {
    apartment_no: string
    resident_name?: string
    month: number
    year: number
    amount_due: number
    amount_paid?: number
    payment_status: string
    payment_date?: string
    note?: string
    serial_no?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: existing } = await supabase
    .from('payments').select('income_id').eq('id', id).maybeSingle()
  let income_id = (existing?.income_id as string | null) ?? null
  const paid = Number(data.amount_paid ?? 0)
  const fields = aidatIncomeFields(data)

  if (paid > 0 && income_id) {
    // Bağlı geliri ödemeyle birebir eşitle (daire no ve kategori dahil)
    const { error } = await supabase.from('income').update(fields).eq('id', income_id)
    if (error) return { error: `Gelir kaydı güncellenemedi: ${error.message}` }
  } else if (paid > 0 && !income_id) {
    // Gelirsiz ödemeye gelir kaydı oluştur
    const { data: row, error } = await supabase
      .from('income').insert({ ...fields, created_by: user?.id ?? null }).select('id').single()
    if (error || !row) return { error: `Gelir kaydı oluşturulamadı: ${error?.message ?? ''}` }
    income_id = row.id as string
  }

  const { error } = await supabase.from('payments').update({
    ...data,
    serial_no: data.serial_no ?? null,
    income_id: paid > 0 ? income_id : null,
  }).eq('id', id)
  if (error) return { error: error.message }

  // Tutar 0/negatif yapıldıysa artık gelir karşılığı yok → eski geliri kaldır.
  // (Önce bağlantı koparıldı; aksi halde ON DELETE CASCADE ödemeyi de silerdi.)
  if (paid <= 0 && income_id) {
    await supabase.from('income').delete().eq('id', income_id)
  }

  revalidateAidat()
  return { success: true }
}

export async function deletePayment(id: string) {
  const supabase = await createClient()

  // income_id varsa önce income'ı sil (ON DELETE CASCADE payment'ı da siler)
  const { data: existing } = await supabase
    .from('payments')
    .select('income_id')
    .eq('id', id)
    .maybeSingle()

  const income_id = existing?.income_id as string | null

  if (income_id) {
    const { error } = await supabase.from('income').delete().eq('id', income_id)
    if (error) return { error: error.message }
    // CASCADE ile payment da silinmiş oldu
  } else {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/odemeler')
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin')
  return { success: true }
}

// ─── Announcements ───────────────────────────────────────────────────────────

export interface AnnouncementPayload {
  title: string
  content: string
  title_en?: string
  content_en?: string
  title_de?: string
  content_de?: string
  title_fr?: string
  content_fr?: string
  title_ru?: string
  content_ru?: string
  published?: boolean
}

export async function createAnnouncement(data: AnnouncementPayload) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('announcements').insert({
    ...data,
    created_by: user?.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/duyurular')
  revalidatePath('/')
  revalidatePath('/resident')
  return { success: true }
}

export async function updateAnnouncement(
  id: string,
  data: AnnouncementPayload
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('announcements')
    .update(data)
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/duyurular')
  revalidatePath('/')
  revalidatePath('/resident')
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/duyurular')
  revalidatePath('/')
  revalidatePath('/resident')
  return { success: true }
}

export async function toggleAnnouncementPublished(
  id: string,
  published: boolean
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('announcements')
    .update({ published })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/duyurular')
  revalidatePath('/')
  revalidatePath('/resident')
  return { success: true }
}

// ─── Bulk Import ─────────────────────────────────────────────────────────────

export async function bulkImportData(
  incomeRows: Array<{ date: string; title: string; description: string; category: string; amount: number }>,
  expenseRows: Array<{ date: string; title: string; description: string; category: string; amount: number }>
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Aidat gelirleri toplu aktarımla da eklenmez (aidat tablosuyla bağı kopuk kayıt oluşturur)
  const aidatRows = incomeRows.filter(r => isAidatCat(r.category))
  if (aidatRows.length) {
    return { error: `${aidatRows.length} satır "Aidat" kategorisinde. Aidat ödemelerini "Aidat / Ödeme Takibi" sayfasından girin; gelire otomatik yansır.` }
  }

  const incomeData = incomeRows.map((r) => ({ ...r, created_by: user?.id }))
  const expenseData = expenseRows.map((r) => ({ ...r, created_by: user?.id }))

  if (incomeData.length > 0) {
    const { error } = await supabase.from('income').insert(incomeData)
    if (error) return { error: `Gelir aktarım hatası: ${error.message}` }
  }

  if (expenseData.length > 0) {
    const { error } = await supabase.from('expenses').insert(expenseData)
    if (error) return { error: `Gider aktarım hatası: ${error.message}` }
  }

  revalidatePath('/admin/gelirler')
  revalidatePath('/admin/giderler')
  revalidatePath('/admin')
  revalidatePath('/')

  return {
    success: true,
    incomeCount: incomeRows.length,
    expenseCount: expenseRows.length,
  }
}

// ─── Apartment Settings ───────────────────────────────────────────────────────

export async function upsertApartmentSettings(data: {
  apartment_no: string
  annual_due: number
  previous_balance: number
  notes?: string
  period_id?: string
}) {
  const supabase = await createClient()
  const period_id = data.period_id ?? ACTIVE_PERIOD.id
  const { error } = await supabase
    .from('apartment_settings')
    .upsert(
      { ...data, period_id, updated_at: new Date().toISOString() },
      { onConflict: 'apartment_no,period_id' }
    )
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  return { success: true }
}

export async function bulkUpsertApartmentSettings(
  rows: Array<{ apartment_no: string; annual_due: number; previous_balance: number; period_id?: string }>
) {
  if (!rows.length) return { success: true }
  const supabase = await createClient()
  const { error } = await supabase
    .from('apartment_settings')
    .upsert(
      rows.map(r => ({
        ...r,
        period_id: r.period_id ?? ACTIVE_PERIOD.id,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'apartment_no,period_id' }
    )
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  return { success: true }
}

// ─── Yeni döneme geçiş (devir + tohumlama) ────────────────────────────────────
// 2026-2027 dönemi aidat kuralları (genel kurul kararı):
const NEW_PERIOD_DEFAULT_DUE = 50000
const NEW_PERIOD_EXEMPT_APTS = ['A-6']                       // yönetici → aidattan muaf
const NEW_PERIOD_HALF_APTS   = ['B-7', 'D-6', 'F-1', 'F-2']  // yönetici yardımcısı (B-7, D-6) + dükkanlar (F-1, F-2) → yarım aidat · F-3, F-4 daire → tam aidat

function newPeriodAnnualDue(apt: string): number {
  if (NEW_PERIOD_EXEMPT_APTS.includes(apt)) return 0
  if (NEW_PERIOD_HALF_APTS.includes(apt)) return NEW_PERIOD_DEFAULT_DUE / 2
  return NEW_PERIOD_DEFAULT_DUE
}

// Hedef dönem için apartment_settings satırlarını oluşturur:
//  • previous_balance = bir önceki dönemin kalanı (borç/alacak devri)
//  • annual_due       = yeni dönem kuralları (varsayılan / muaf / yarım)
// Idempotent: hedef dönemde ZATEN satırı olan daireler atlanır (elle düzenlemeler korunur).
export async function seedPeriodSettings(targetPeriodId?: string): Promise<{
  error?: string
  success?: boolean
  created?: number
  skipped?: number
}> {
  const supabase = await createClient()

  // Yalnızca yönetici çalıştırabilir
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum bulunamadı.' }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: 'Bu işlem için yönetici yetkisi gerekli.' }

  const target = getPeriod(targetPeriodId)
  const idx = PERIODS.findIndex(p => p.id === target.id)
  const prev = idx > 0 ? PERIODS[idx - 1] : null

  // Hedef dönemde hâlihazırda ayarı olan daireler (idempotent atlama)
  const { data: existingRows, error: exErr } = await supabase
    .from('apartment_settings').select('apartment_no').eq('period_id', target.id)
  if (exErr) return { error: exErr.message }
  const existing = new Set((existingRows ?? []).map(r => r.apartment_no))

  // Devir kaynağı: önceki dönemin ayarları + ödemeleri
  const prevSettingsMap = new Map<string, { annual_due: number; previous_balance: number }>()
  const paidByApt = new Map<string, number>()

  if (prev) {
    const { data: prevSettings } = await supabase
      .from('apartment_settings')
      .select('apartment_no, annual_due, previous_balance')
      .eq('period_id', prev.id)
    for (const s of prevSettings ?? []) {
      prevSettingsMap.set(s.apartment_no, {
        annual_due: Number(s.annual_due),
        previous_balance: Number(s.previous_balance),
      })
    }
    const { data: payments } = await supabase
      .from('payments').select('apartment_no, amount_paid').eq('period_id', prev.id)
    for (const p of payments ?? []) {
      paidByApt.set(p.apartment_no, (paidByApt.get(p.apartment_no) ?? 0) + Number(p.amount_paid))
    }
  }

  // Aday daireler: önceki dönem ayarı ∪ önceki dönem ödemesi olanlar
  const candidates = new Set<string>([...prevSettingsMap.keys(), ...paidByApt.keys()])

  const rows: Array<{ apartment_no: string; period_id: string; annual_due: number; previous_balance: number }> = []
  for (const apt of candidates) {
    if (existing.has(apt)) continue
    const prevSet = prevSettingsMap.get(apt)
    const prevDue = prevSet?.annual_due ?? 0
    const prevBal = prevSet?.previous_balance ?? 0
    const paid    = paidByApt.get(apt) ?? 0
    // Önceki dönem kalanı: + = borç devri, − = alacak (fazla ödeme) devri
    const carriedBalance = prevDue + prevBal - paid
    rows.push({
      apartment_no: apt,
      period_id: target.id,
      annual_due: newPeriodAnnualDue(apt),
      previous_balance: carriedBalance,
    })
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('apartment_settings').insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/odemeler')
  return { success: true, created: rows.length, skipped: existing.size }
}

// ─── Bulk Payment Import ─────────────────────────────────────────────────────

export async function bulkImportPayments(
  rows: Array<{
    apartment_no: string
    resident_name?: string
    month: number
    year: number
    amount_due: number
    amount_paid: number
    payment_status: string
    note?: string
    period_id?: string
  }>
) {
  if (!rows.length) return { error: 'İçe aktarılacak kayıt yok.' }
  const supabase = await createClient()
  const withPeriod = rows.map(r => ({ ...r, period_id: r.period_id ?? ACTIVE_PERIOD.id }))
  const { error } = await supabase.from('payments').insert(withPeriod)
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  revalidatePath('/admin')
  return { success: true, count: rows.length }
}

// ─── Annual Works ─────────────────────────────────────────────────────────────

export async function createAnnualWork(data: {
  year: number
  title: string
  description?: string
  status: string
  estimated_cost?: number
  actual_cost?: number
  contractor?: string
  notes?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('annual_works').insert({
    ...data,
    created_by: user?.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/yillik-isler')
  return { success: true }
}

export async function updateAnnualWork(
  id: string,
  data: {
    year: number
    title: string
    description?: string
    status: string
    estimated_cost?: number
    actual_cost?: number
    contractor?: string
    notes?: string
  }
) {
  const supabase = await createClient()
  const { error } = await supabase.from('annual_works').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/yillik-isler')
  return { success: true }
}

export async function deleteAnnualWork(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('annual_works').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/yillik-isler')
  return { success: true }
}

// ─── Budget Items ─────────────────────────────────────────────────────────────

type BudgetItemPayload = {
  category: string
  category_en?: string | null
  sort_order: number
  plan_2023_2024?: number | null
  actual_2023_2024?: number | null
  plan_2024_2025?: number | null
  actual_2024_2025?: number | null
  plan_2025_2026?: number | null
  expense_categories: string[]
  description_tr?: string | null
  description_en?: string | null
}

export async function createBudgetItem(data: BudgetItemPayload) {
  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('budget_items')
    .insert({ ...data, updated_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/admin/raporlar')
  return { success: true, id: inserted.id as string }
}

export async function updateBudgetItem(id: string, data: BudgetItemPayload) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('budget_items')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/raporlar')
  return { success: true }
}

export async function deleteBudgetItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('budget_items').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/raporlar')
  return { success: true }
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface DocumentPayload {
  title_tr: string
  title_en?: string | null
  title_de?: string | null
  title_fr?: string | null
  title_ru?: string | null
  description_tr?: string | null
  description_en?: string | null
  description_de?: string | null
  description_fr?: string | null
  description_ru?: string | null
  file_url: string
  file_name: string
  storage_path: string
  file_size?: number | null
  file_type?: string | null
}

export async function createDocument(data: DocumentPayload) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('documents').insert({
    ...data,
    uploaded_at: new Date().toISOString(),
    created_by: user?.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/belgeler')
  revalidatePath('/resident/belgeler')
  return { success: true }
}

export async function updateDocument(
  id: string,
  data: DocumentPayload,
  oldStoragePath?: string
) {
  const supabase = await createClient()

  if (oldStoragePath) {
    await supabase.storage.from('documents').remove([oldStoragePath])
  }

  const { error } = await supabase.from('documents').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/belgeler')
  revalidatePath('/resident/belgeler')
  return { success: true }
}

export async function deleteDocument(id: string) {
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (doc?.storage_path) {
    await supabase.storage.from('documents').remove([doc.storage_path])
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/belgeler')
  revalidatePath('/resident/belgeler')
  return { success: true }
}

export async function bulkUpsertBudgetItems(
  rows: Array<{
    id?: string
    category: string
    sort_order: number
    plan_2023_2024?: number | null
    actual_2023_2024?: number | null
    plan_2024_2025?: number | null
    actual_2024_2025?: number | null
    plan_2025_2026?: number | null
    expense_categories: string[]
    category_en?: string | null
    description_tr?: string | null
    description_en?: string | null
  }>
) {
  if (!rows.length) return { error: 'Aktarılacak kayıt yok.' }
  const supabase = await createClient()
  const now = new Date().toISOString()

  const toUpdate = rows.filter(r => r.id)
  const toInsert = rows.filter(r => !r.id)

  for (const { id, ...data } of toUpdate) {
    const { error } = await supabase
      .from('budget_items')
      .update({ ...data, updated_at: now })
      .eq('id', id!)
    if (error) return { error: `Güncelleme hatası: ${error.message}` }
  }

  if (toInsert.length) {
    const { error } = await supabase
      .from('budget_items')
      .insert(toInsert.map(r => ({ ...r, updated_at: now })))
    if (error) return { error: `Ekleme hatası: ${error.message}` }
  }

  revalidatePath('/admin/raporlar')
  return { success: true, count: rows.length }
}

// ─── Planlama (Yıllık Planlama) ────────────────────────────────────────────────

// Bir önceki (en son kapanan) dönemin gerçekleşen giderleri — yeni plan baz tutarı için
const { budgetStart: PLAN_BASE_PERIOD_START, budgetEnd: PLAN_BASE_PERIOD_END } =
  getPeriod(BUDGET_BASE_PERIOD_ID)

type PlanHeaderPayload = {
  period: string
  start_date?: string | null
  end_date?: string | null
  default_rate: number
}

// Belirtilen dönemdeki giderleri budget_item_id'ye göre toplayıp baz tutarları döndürür
async function computeBaseByBudgetItem(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, number>> {
  const { data: expenses } = await supabase
    .from('expenses')
    .select('budget_item_id, amount, date')
    .gte('date', PLAN_BASE_PERIOD_START)
    .lte('date', PLAN_BASE_PERIOD_END)
  const map = new Map<string, number>()
  for (const e of expenses ?? []) {
    if (!e.budget_item_id) continue
    map.set(e.budget_item_id, (map.get(e.budget_item_id) ?? 0) + Number(e.amount))
  }
  return map
}

// Yeni plan oluşturur ve budget_items'tan kalemleri tohumlar (baz = geçen yıl gerçekleşen)
export async function createPlan(data: PlanHeaderPayload) {
  const supabase = await createClient()
  const { data: plan, error } = await supabase
    .from('plans')
    .insert({
      period: data.period.trim(),
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      default_rate: data.default_rate,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  const [{ data: budgetItems }, baseMap] = await Promise.all([
    supabase.from('budget_items').select('*').order('sort_order'),
    computeBaseByBudgetItem(supabase),
  ])

  const rows = (budgetItems ?? []).map((b, i) => ({
    plan_id: plan.id,
    source_budget_item_id: b.id,
    category: b.category,
    category_en: b.category_en,
    sort_order: b.sort_order ?? i + 1,
    base_amount: baseMap.get(b.id) ?? 0,
    method: 'rate',
    rate: data.default_rate,
    planned_amount: null,
    status: 'active',
    is_new: false,
    description_tr: b.description_tr ?? null,
    description_en: b.description_en ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (rows.length > 0) {
    const { error: itemsError } = await supabase.from('plan_items').insert(rows)
    if (itemsError) return { error: itemsError.message }
  }

  revalidatePath('/admin/planlama')
  return { success: true, id: plan.id as string }
}

export async function updatePlan(id: string, data: PlanHeaderPayload) {
  const supabase = await createClient()
  // eski varsayılan oranı al (override edilmemiş kalemleri yeni orana çekmek için)
  const { data: current } = await supabase.from('plans').select('default_rate').eq('id', id).maybeSingle()
  const oldRate = current?.default_rate != null ? Number(current.default_rate) : null

  const { error } = await supabase
    .from('plans')
    .update({
      period: data.period.trim(),
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      default_rate: data.default_rate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  // Varsayılan TÜFE değiştiyse, hâlâ eski varsayılana eşit (elle override edilmemiş)
  // oran kalemlerini yeni orana güncelle. Personel gibi özel oranlar korunur.
  if (oldRate != null && oldRate !== data.default_rate) {
    await supabase
      .from('plan_items')
      .update({ rate: data.default_rate, updated_at: new Date().toISOString() })
      .eq('plan_id', id)
      .eq('method', 'rate')
      .eq('rate', oldRate)
  }

  revalidatePath('/admin/planlama')
  return { success: true }
}

export async function deletePlan(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('plans').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/planlama')
  return { success: true }
}

// Baz tutarları güncel 2025-2026 gerçekleşenden yeniden hesaplar
export async function refreshPlanBase(planId: string) {
  const supabase = await createClient()
  const [{ data: items }, baseMap] = await Promise.all([
    supabase.from('plan_items').select('id, source_budget_item_id').eq('plan_id', planId),
    computeBaseByBudgetItem(supabase),
  ])
  for (const it of items ?? []) {
    if (!it.source_budget_item_id) continue
    await supabase
      .from('plan_items')
      .update({ base_amount: baseMap.get(it.source_budget_item_id) ?? 0, updated_at: new Date().toISOString() })
      .eq('id', it.id)
  }
  revalidatePath('/admin/planlama')
  return { success: true }
}

type PlanItemPayload = {
  category: string
  category_en?: string | null
  base_amount?: number | null
  method: 'rate' | 'manual'
  rate?: number | null
  planned_amount?: number | null
  status?: 'active' | 'excluded' | 'merged'
  optional?: boolean
  is_new?: boolean
  description_tr?: string | null
  description_en?: string | null
  sort_order?: number
}

export async function createPlanItem(planId: string, data: PlanItemPayload) {
  const supabase = await createClient()
  // yeni kalem en sona
  const { data: maxRow } = await supabase
    .from('plan_items')
    .select('sort_order')
    .eq('plan_id', planId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('plan_items').insert({
    plan_id: planId,
    source_budget_item_id: null,
    category: data.category.trim(),
    category_en: data.category_en ?? null,
    sort_order: data.sort_order ?? nextSort,
    base_amount: data.base_amount ?? null,
    method: data.method,
    rate: data.rate ?? null,
    planned_amount: data.planned_amount ?? null,
    status: data.status ?? 'active',
    optional: data.optional ?? false,
    is_new: data.is_new ?? true,
    description_tr: data.description_tr ?? null,
    description_en: data.description_en ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/planlama')
  return { success: true }
}

export async function updatePlanItem(id: string, data: Partial<PlanItemPayload>) {
  const supabase = await createClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['category', 'category_en', 'base_amount', 'method', 'rate', 'planned_amount', 'status', 'optional', 'is_new', 'description_tr', 'description_en', 'sort_order'] as const) {
    if (data[k] !== undefined) patch[k] = k === 'category' ? String(data[k]).trim() : data[k]
  }
  const { error } = await supabase.from('plan_items').update(patch).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/planlama')
  return { success: true }
}

export async function deletePlanItem(id: string) {
  const supabase = await createClient()
  // bu kaleme birleştirilmiş çocukları önce serbest bırak
  await supabase.from('plan_items').update({ merged_into: null, status: 'active' }).eq('merged_into', id)
  const { error } = await supabase.from('plan_items').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/planlama')
  return { success: true }
}

// Kalemleri hedef kaleme birleştirir (çocuklar status='merged', merged_into=target)
export async function mergePlanItems(targetId: string, childIds: string[]) {
  const supabase = await createClient()
  const ids = childIds.filter(id => id !== targetId)
  if (ids.length === 0) return { error: 'Birleştirilecek kalem yok.' }
  const { error } = await supabase
    .from('plan_items')
    .update({ status: 'merged', merged_into: targetId, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/admin/planlama')
  return { success: true }
}

export async function unmergePlanItem(childId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('plan_items')
    .update({ status: 'active', merged_into: null, updated_at: new Date().toISOString() })
    .eq('id', childId)
  if (error) return { error: error.message }
  revalidatePath('/admin/planlama')
  return { success: true }
}

// ─── Ek Ödemeler (aidat dışı, ör. ASKİ su bağlantısı) ─────────────────────────
// Ödemeler special_charge_payments tablosunda tutulur ve her biri bir Gelir kaydına
// (income_id) bağlıdır. Aidat tabloları/hesapları etkilenmez.

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'Oturum bulunamadı.' }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { supabase, user, error: 'Bu işlem için yönetici yetkisi gerekli.' }
  return { supabase, user, error: null }
}

function revalidateSpecialCharges() {
  revalidatePath('/admin/ek-odemeler')
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin')
  revalidatePath('/[locale]/resident', 'page')
}

export async function addSpecialChargePayment(data: {
  charge_id: string
  apartment_no: string
  amount_paid: number
  payment_date: string
  resident_name?: string
  serial_no?: string
  note?: string
}) {
  const { supabase, user, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  if (!(data.amount_paid > 0)) return { error: 'Tutar 0’dan büyük olmalı.' }

  const { data: charge, error: cErr } = await supabase
    .from('special_charges').select('title, income_category').eq('id', data.charge_id).maybeSingle()
  if (cErr || !charge) return { error: cErr?.message ?? 'Ödeme tanımı bulunamadı.' }

  const namePart = data.resident_name ? ` · ${data.resident_name}` : ''
  const siraPrefix = data.serial_no ? `Defter Sıra No: ${data.serial_no} · ` : ''
  const notePart = data.note ? ` · ${data.note}` : ''

  const { data: incomeRow, error: incErr } = await supabase
    .from('income')
    .insert({
      date: data.payment_date,
      title: `${data.resident_name || `Daire ${data.apartment_no}`} - ${charge.title}`,
      description: `${siraPrefix}Daire ${data.apartment_no}${namePart} · ${charge.title}${notePart}`,
      category: charge.income_category,
      amount: data.amount_paid,
      apartment_no: data.apartment_no,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()
  if (incErr || !incomeRow) return { error: incErr?.message ?? 'Gelir kaydı oluşturulamadı.' }

  const { error } = await supabase.from('special_charge_payments').insert({
    charge_id: data.charge_id,
    apartment_no: data.apartment_no,
    amount_paid: data.amount_paid,
    payment_date: data.payment_date,
    note: data.note || null,
    income_id: incomeRow.id,
  })
  if (error) {
    await supabase.from('income').delete().eq('id', incomeRow.id)
    return { error: error.message }
  }

  revalidateSpecialCharges()
  return { success: true }
}

// Ödemeyi siler. Gelir kaydından oluşturulduysa (removeIncome=true) gelir de silinir;
// eşleştirmeyi geri almak için removeIncome=false → gelir kalır, yalnızca bağlantı kopar.
export async function deleteSpecialChargePayment(id: string, removeIncome: boolean) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }

  const { data: existing } = await supabase
    .from('special_charge_payments').select('income_id').eq('id', id).maybeSingle()
  const income_id = existing?.income_id as string | null

  if (removeIncome && income_id) {
    const { error } = await supabase.from('income').delete().eq('id', income_id) // CASCADE ödemeyi de siler
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('special_charge_payments').delete().eq('id', id)
    if (error) return { error: error.message }
  }

  revalidateSpecialCharges()
  return { success: true }
}

// Gelirler'e daha önce "normal gelir" olarak girilmiş bir kaydı ek ödemeye bağlar.
// Gelir tutarı ve tarihi aynen korunur; yalnızca kategori ve daire no güncellenir.
export async function linkIncomeToSpecialCharge(incomeId: string, chargeId: string, apartmentNo: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  if (!apartmentNo) return { error: 'Daire seçin.' }

  const [{ data: income }, { data: charge }, { data: aidatLink }] = await Promise.all([
    supabase.from('income').select('id, date, amount').eq('id', incomeId).maybeSingle(),
    supabase.from('special_charges').select('income_category').eq('id', chargeId).maybeSingle(),
    supabase.from('payments').select('id').eq('income_id', incomeId).maybeSingle(),
  ])
  if (!income) return { error: 'Gelir kaydı bulunamadı.' }
  if (!charge) return { error: 'Ödeme tanımı bulunamadı.' }
  if (aidatLink) return { error: 'Bu gelir bir aidat ödemesine bağlı; ek ödemeye bağlanamaz.' }

  const { error } = await supabase.from('special_charge_payments').insert({
    charge_id: chargeId,
    apartment_no: apartmentNo,
    amount_paid: Number(income.amount),
    payment_date: income.date,
    income_id: incomeId,
  })
  if (error) {
    if (error.code === '23505') return { error: 'Bu gelir zaten bir ek ödemeye bağlı.' }
    return { error: error.message }
  }

  await supabase.from('income')
    .update({ category: charge.income_category, apartment_no: apartmentNo })
    .eq('id', incomeId)

  revalidateSpecialCharges()
  return { success: true }
}

// Birim borcunu değiştirir (0 = muaf).
export async function updateSpecialChargeItem(chargeId: string, apartmentNo: string, amountDue: number, note?: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  if (!(amountDue >= 0)) return { error: 'Tutar negatif olamaz.' }
  const { error } = await supabase.from('special_charge_items').upsert(
    { charge_id: chargeId, apartment_no: apartmentNo, amount_due: amountDue, note: note || null },
    { onConflict: 'charge_id,apartment_no' }
  )
  if (error) return { error: error.message }
  revalidateSpecialCharges()
  return { success: true }
}

// ─── Ek Ödemeler: kuruma yapılan ödemeler (ör. ASKİ) + dekontlar ─────────────
// Dosya istemciden 'documents' bucket'ına (dekontlar/ klasörü) yüklenir; burada yalnızca yolu kaydedilir.

function validReceiptPath(path: string | null | undefined) {
  return !path || (path.startsWith(RECEIPT_PREFIX) && !path.includes('..'))
}

export async function addSpecialChargeDisbursement(data: {
  charge_id: string
  date: string
  title: string
  recipient?: string
  amount: number
  fee?: number
  reference?: string
  receipt_path?: string | null
  receipt_name?: string | null
}) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  if (!data.title.trim()) return { error: 'Açıklama zorunlu.' }
  if (!(data.amount > 0)) return { error: 'Tutar 0’dan büyük olmalı.' }
  if (!((data.fee ?? 0) >= 0)) return { error: 'Masraf negatif olamaz.' }
  if (!validReceiptPath(data.receipt_path)) return { error: 'Geçersiz dosya yolu.' }

  const { error } = await supabase.from('special_charge_disbursements').insert({
    charge_id: data.charge_id,
    date: data.date,
    title: data.title.trim(),
    recipient: data.recipient?.trim() || null,
    amount: data.amount,
    fee: data.fee ?? 0,
    reference: data.reference?.trim() || null,
    receipt_path: data.receipt_path || null,
    receipt_name: data.receipt_name || null,
  })
  if (error) {
    if (data.receipt_path) await supabase.storage.from(RECEIPT_BUCKET).remove([data.receipt_path])
    if (error.code === '23505') return { error: 'Bu dekont numarası zaten kayıtlı.' }
    return { error: error.message }
  }
  revalidateSpecialCharges()
  revalidatePath('/[locale]/resident/odemeler', 'page')
  return { success: true }
}

// Dekontu ekler/değiştirir; eski dosya silinir.
export async function setSpecialChargeDisbursementReceipt(id: string, receiptPath: string, receiptName: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  if (!receiptPath || !validReceiptPath(receiptPath)) return { error: 'Geçersiz dosya yolu.' }
  const { data: existing } = await supabase
    .from('special_charge_disbursements').select('receipt_path').eq('id', id).maybeSingle()
  if (!existing) return { error: 'Kayıt bulunamadı.' }
  const { error } = await supabase.from('special_charge_disbursements')
    .update({ receipt_path: receiptPath, receipt_name: receiptName }).eq('id', id)
  if (error) return { error: error.message }
  if (existing.receipt_path && existing.receipt_path !== receiptPath) {
    await supabase.storage.from(RECEIPT_BUCKET).remove([existing.receipt_path])
  }
  revalidateSpecialCharges()
  revalidatePath('/[locale]/resident/odemeler', 'page')
  return { success: true }
}

export async function deleteSpecialChargeDisbursement(id: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  const { data: existing } = await supabase
    .from('special_charge_disbursements').select('receipt_path').eq('id', id).maybeSingle()
  const { error } = await supabase.from('special_charge_disbursements').delete().eq('id', id)
  if (error) return { error: error.message }
  if (existing?.receipt_path) await supabase.storage.from(RECEIPT_BUCKET).remove([existing.receipt_path])
  revalidateSpecialCharges()
  revalidatePath('/[locale]/resident/odemeler', 'page')
  return { success: true }
}

// ─── Aidat ↔ Gelirler mutabakatı: düzeltme işlemleri ──────────────────────────

type PaymentRow = {
  id: string; apartment_no: string; resident_name: string | null; month: number; year: number
  amount_paid: number; payment_date: string | null; income_id: string | null; serial_no: string | null
}

async function loadPayment(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from('payments')
    .select('id, apartment_no, resident_name, month, year, amount_paid, payment_date, income_id, serial_no')
    .eq('id', id).maybeSingle()
  return data as PaymentRow | null
}

// Aidat tablosu esas alınır → bağlı gelir kaydı ödemeye eşitlenir (tutar, tarih, daire, kategori).
export async function reconSyncIncomeFromPayment(paymentId: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  const p = await loadPayment(supabase, paymentId)
  if (!p?.income_id) return { error: 'Ödemeye bağlı gelir kaydı yok.' }
  if (!(Number(p.amount_paid) > 0)) return { error: 'Ödeme tutarı 0 veya negatif; gelire yansıtılamaz.' }
  const { error } = await supabase.from('income').update(aidatIncomeFields(p)).eq('id', p.income_id)
  if (error) return { error: error.message }
  revalidateAidat()
  return { success: true }
}

// Gelirler esas alınır → aidat kaydının tutarı/tarihi gelire eşitlenir; gelirin daire/kategori bilgisi düzeltilir.
export async function reconSyncPaymentFromIncome(paymentId: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  const p = await loadPayment(supabase, paymentId)
  if (!p?.income_id) return { error: 'Ödemeye bağlı gelir kaydı yok.' }
  const { data: inc } = await supabase.from('income').select('amount, date').eq('id', p.income_id).maybeSingle()
  if (!inc) return { error: 'Gelir kaydı bulunamadı.' }
  const { error } = await supabase.from('payments')
    .update({ amount_paid: Number(inc.amount), payment_date: inc.date }).eq('id', p.id)
  if (error) return { error: error.message }
  await supabase.from('income').update({ category: 'Aidat', apartment_no: p.apartment_no }).eq('id', p.income_id)
  revalidateAidat()
  return { success: true }
}

// Gelirsiz ödemeye gelir kaydı oluşturur.
export async function reconCreateIncomeForPayment(paymentId: string) {
  const { supabase, user, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  const p = await loadPayment(supabase, paymentId)
  if (!p) return { error: 'Ödeme bulunamadı.' }
  if (p.income_id) return { error: 'Bu ödemenin zaten gelir kaydı var.' }
  if (!(Number(p.amount_paid) > 0)) return { error: 'Ödeme tutarı 0 veya negatif; gelir oluşturulamaz.' }
  const { data: row, error } = await supabase
    .from('income').insert({ ...aidatIncomeFields(p), created_by: user?.id ?? null }).select('id').single()
  if (error || !row) return { error: error?.message ?? 'Gelir oluşturulamadı.' }
  const { error: uErr } = await supabase.from('payments').update({ income_id: row.id }).eq('id', p.id)
  if (uErr) {
    await supabase.from('income').delete().eq('id', row.id)
    return { error: uErr.message }
  }
  revalidateAidat()
  return { success: true }
}

// Bağlantısız bir "Aidat" gelirini gelirsiz bir ödemeye bağlar (tutarlar farklıysa sonra eşitlenebilir).
export async function reconLinkIncomeToPayment(incomeId: string, paymentId: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  const p = await loadPayment(supabase, paymentId)
  if (!p) return { error: 'Ödeme bulunamadı.' }
  if (p.income_id) return { error: 'Bu ödemenin zaten gelir kaydı var.' }
  const { data: taken } = await supabase.from('payments').select('id').eq('income_id', incomeId).maybeSingle()
  if (taken) return { error: 'Bu gelir başka bir ödemeye bağlı.' }
  const { error } = await supabase.from('payments').update({ income_id: incomeId }).eq('id', p.id)
  if (error) return { error: error.message }
  await supabase.from('income').update({ category: 'Aidat', apartment_no: p.apartment_no }).eq('id', incomeId)
  revalidateAidat()
  return { success: true }
}

// Bağlantısız "Aidat" gelirinden aidat ödemesi oluşturur (ay/yıl gelir tarihinden).
export async function reconCreatePaymentFromIncome(incomeId: string, apartmentNo: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  if (!apartmentNo) return { error: 'Daire seçin.' }
  const [{ data: inc }, { data: taken }] = await Promise.all([
    supabase.from('income').select('id, date, amount, title').eq('id', incomeId).maybeSingle(),
    supabase.from('payments').select('id').eq('income_id', incomeId).maybeSingle(),
  ])
  if (!inc) return { error: 'Gelir kaydı bulunamadı.' }
  if (taken) return { error: 'Bu gelir zaten bir ödemeye bağlı.' }

  const [y, m] = (inc.date as string).split('-').map(Number)
  const period = periodOfPayment(y, m)
  if (!period) return { error: `${inc.date} tarihi hiçbir aidat dönemine düşmüyor.` }
  const { data: sett } = await supabase.from('apartment_settings')
    .select('annual_due').eq('apartment_no', apartmentNo).eq('period_id', period.id).maybeSingle()
  const annual = Number(sett?.annual_due ?? 0)
  const amount = Number(inc.amount)

  const { error } = await supabase.from('payments').insert({
    apartment_no: apartmentNo,
    month: m,
    year: y,
    amount_due: annual > 0 ? annual : amount,
    amount_paid: amount,
    payment_status: annual > 0 && amount < annual ? 'partial' : 'paid',
    payment_date: inc.date,
    note: 'Mutabakat: gelir kaydından oluşturuldu',
    income_id: incomeId,
    period_id: period.id,
  })
  if (error) return { error: error.message }
  await supabase.from('income').update({ category: 'Aidat', apartment_no: apartmentNo }).eq('id', incomeId)
  revalidateAidat()
  return { success: true }
}

// Yanlışlıkla "Aidat" kategorisine girilmiş (aidat olmayan) geliri başka kategoriye taşır.
export async function reconRecategorizeIncome(incomeId: string, category: string) {
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return { error: authErr }
  if (!category || isAidatCat(category)) return { error: 'Geçerli bir kategori seçin.' }
  const { data: taken } = await supabase.from('payments').select('id').eq('income_id', incomeId).maybeSingle()
  if (taken) return { error: 'Bu gelir bir aidat ödemesine bağlı; kategorisi değiştirilemez.' }
  const { error } = await supabase.from('income').update({ category }).eq('id', incomeId)
  if (error) return { error: error.message }
  revalidateAidat()
  return { success: true }
}
