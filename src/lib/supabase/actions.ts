'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from './server'
import { createAdminClient } from './admin'

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
  const { error } = await supabase.from('income').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin')
  return { success: true }
}

export async function deleteIncome(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('income').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin/odemeler')
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
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { serial_no, ...paymentData } = data

  // income tablosuna Aidat kaydı ekle
  const TR_MONTHS = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  const incomeDate = data.payment_date
    ?? `${data.year}-${String(data.month).padStart(2, '0')}-01`
  const monthName = TR_MONTHS[data.month] ?? ''
  const namePart = data.resident_name ? ` · ${data.resident_name}` : ''
  const incomeTitle = data.resident_name
    ? `${data.resident_name} - Aidat Ödemesi`
    : `Daire ${data.apartment_no} - Aidat Ödemesi`
  const siraPrefix = serial_no ? `Defter Sıra No: ${serial_no} · ` : ''
  const incomeDescription = `${siraPrefix}Daire ${data.apartment_no}${namePart} · ${monthName} ${data.year} Aidat Ödemesi`

  const { data: incomeRow, error: incomeError } = await supabase
    .from('income')
    .insert({
      date: incomeDate,
      title: incomeTitle,
      description: incomeDescription ?? null,
      category: 'Aidat',
      amount: data.amount_paid ?? 0,
      apartment_no: data.apartment_no,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  const income_id = incomeError ? null : (incomeRow?.id as string)

  const { error } = await supabase.from('payments').insert({
    ...paymentData,
    serial_no: serial_no ?? null,
    income_id,
  })
  if (error) {
    if (income_id) await supabase.from('income').delete().eq('id', income_id)
    return { error: error.message }
  }

  revalidatePath('/admin/odemeler')
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin')
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

  // Mevcut income_id'yi al
  const { data: existing } = await supabase
    .from('payments')
    .select('income_id')
    .eq('id', id)
    .maybeSingle()

  const income_id = existing?.income_id as string | null

  if (income_id) {
    const TR_MONTHS = ['','Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
    const incomeDate = data.payment_date
      ?? `${data.year}-${String(data.month).padStart(2, '0')}-01`
    const monthName = TR_MONTHS[data.month] ?? ''
    const namePart = data.resident_name ? ` · ${data.resident_name}` : ''
    const incomeTitle = data.resident_name
      ? `${data.resident_name} - Aidat Ödemesi`
      : `Daire ${data.apartment_no} - Aidat Ödemesi`
    const siraPrefix = data.serial_no ? `Defter Sıra No: ${data.serial_no} · ` : ''
    const incomeDescription = `${siraPrefix}Daire ${data.apartment_no}${namePart} · ${monthName} ${data.year} Aidat Ödemesi`
    await supabase.from('income').update({
      date: incomeDate,
      title: incomeTitle,
      description: incomeDescription,
      amount: data.amount_paid ?? 0,
    }).eq('id', income_id)
  }

  const { error } = await supabase.from('payments').update({
    ...data,
    serial_no: data.serial_no ?? null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  revalidatePath('/admin/gelirler')
  revalidatePath('/admin')
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
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('apartment_settings')
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'apartment_no' })
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  return { success: true }
}

export async function bulkUpsertApartmentSettings(
  rows: Array<{ apartment_no: string; annual_due: number; previous_balance: number }>
) {
  if (!rows.length) return { success: true }
  const supabase = await createClient()
  const { error } = await supabase
    .from('apartment_settings')
    .upsert(
      rows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: 'apartment_no' }
    )
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  return { success: true }
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
  }>
) {
  if (!rows.length) return { error: 'İçe aktarılacak kayıt yok.' }
  const supabase = await createClient()
  const { error } = await supabase.from('payments').insert(rows)
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
