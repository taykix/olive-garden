'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from './server'

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
    .select('role')
    .eq('id', user.id)
    .single()

  revalidatePath('/', 'layout')
  redirect(profile?.role === 'admin' ? '/admin' : '/resident')
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
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('payments').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
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
  }
) {
  const supabase = await createClient()
  const { error } = await supabase.from('payments').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  revalidatePath('/admin')
  return { success: true }
}

export async function deletePayment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/odemeler')
  revalidatePath('/admin')
  return { success: true }
}

// ─── Announcements ───────────────────────────────────────────────────────────

export async function createAnnouncement(data: {
  title: string
  content: string
  published?: boolean
}) {
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
  data: { title: string; content: string; published?: boolean }
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
