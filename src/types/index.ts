export type UserRole = 'admin' | 'resident'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  apartment_no: string | null
  created_at: string
}

export interface Income {
  id: string
  date: string
  title: string
  description: string | null
  category: string | null
  amount: number
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
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
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
