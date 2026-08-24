export type UserRole = 'admin' | 'resident'
export type UserStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  status: UserStatus
  apartment_no: string | null
  email: string | null
  last_sign_in_at: string | null
  created_at: string
}

export interface Income {
  id: string
  date: string
  title: string
  description: string | null
  category: string | null
  amount: number
  apartment_no: string | null
  created_by: string | null
  created_at: string
}

export interface Expense {
  id: string
  date: string
  title: string
  description: string | null
  category: string | null
  amount: number
  document_url: string | null
  budget_item_id: string | null
  created_by: string | null
  created_at: string
}

export type PaymentStatus = 'paid' | 'unpaid' | 'partial'

export interface Payment {
  id: string
  apartment_no: string
  resident_name: string | null
  month: number
  year: number
  amount_due: number
  amount_paid: number
  payment_status: PaymentStatus
  payment_date: string | null
  note: string | null
  income_id: string | null
  serial_no: string | null
  period_id: string | null
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  title_en: string | null
  content_en: string | null
  title_de: string | null
  content_de: string | null
  title_fr: string | null
  content_fr: string | null
  title_ru: string | null
  content_ru: string | null
  published: boolean
  created_by: string | null
  created_at: string
}

export interface DashboardStats {
  totalIncome: number
  totalExpenses: number
  balance: number
  apartmentCount: number
  unpaidCount: number
}

export interface MonthlyReport {
  year: number
  month: number
  totalIncome: number
  totalExpenses: number
  balance: number
}

export interface AnnualWork {
  id: string
  year: number
  title: string
  description: string | null
  status: 'planned' | 'in_progress' | 'completed'
  estimated_cost: number | null
  actual_cost: number | null
  contractor: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface ImportedRow {
  date: string
  title: string
  description: string
  category: string
  amount: number
}

export interface BudgetItem {
  id: string
  category: string
  category_en: string | null
  sort_order: number
  plan_2023_2024: number | null
  actual_2023_2024: number | null
  plan_2024_2025: number | null
  actual_2024_2025: number | null
  plan_2025_2026: number | null
  expense_categories: string[]
  description_tr: string | null
  description_en: string | null
  created_at: string
  updated_at: string
}

// ─── Planlama ─────────────────────────────────────────────────────────────────

export interface Plan {
  id: string
  period: string
  start_date: string | null
  end_date: string | null
  default_rate: number
  created_at: string
  updated_at: string
}

export type PlanMethod = 'rate' | 'manual'
export type PlanItemStatus = 'active' | 'excluded' | 'merged'

export interface PlanItem {
  id: string
  plan_id: string
  source_budget_item_id: string | null
  category: string
  category_en: string | null
  sort_order: number
  base_amount: number | null
  method: PlanMethod
  rate: number | null
  planned_amount: number | null
  status: PlanItemStatus
  optional: boolean
  is_new: boolean
  merged_into: string | null
  description_tr: string | null
  description_en: string | null
  created_at: string
  updated_at: string
}

export interface SiteDocument {
  id: string
  title_tr: string
  title_en: string | null
  title_de: string | null
  title_fr: string | null
  title_ru: string | null
  description_tr: string | null
  description_en: string | null
  description_de: string | null
  description_fr: string | null
  description_ru: string | null
  file_url: string
  file_name: string
  storage_path: string
  file_size: number | null
  file_type: string | null
  uploaded_at: string
  created_by: string | null
  created_at: string
}

export interface ApartmentSettings {
  apartment_no: string
  annual_due: number
  previous_balance: number  // + = geçen dönem borcu, - = alacak (fazla ödeme)
  notes: string | null
  updated_at: string
}
