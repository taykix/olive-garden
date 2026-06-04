import { TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { ExpenseForm } from '@/components/admin/expense-form'
import { EmptyState } from '@/components/shared/empty-state'
import { Expense } from '@/types'
import { ExpenseTable } from './expense-table'

export const dynamic = 'force-dynamic'

export default async function GiderlerPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false })

  const expenseList: Expense[] = data ?? []
  const total = expenseList.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Giderler</h1>
          <p className="text-gray-500 text-sm mt-1">Toplam: {formatCurrency(total)}</p>
        </div>
        <ExpenseForm />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">Veriler yüklenirken hata oluştu.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Gider Kayıtları ({expenseList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenseList.length === 0 ? (
            <EmptyState icon={TrendingDown} title="Henüz gider kaydı yok" description="Yeni bir gider eklemek için 'Gider Ekle' butonunu kullanın." />
          ) : (
            <ExpenseTable data={expenseList} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
