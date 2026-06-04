import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { IncomeForm } from '@/components/admin/income-form'
import { EmptyState } from '@/components/shared/empty-state'
import { Income } from '@/types'
import { IncomeTable } from './income-table'

export const dynamic = 'force-dynamic'

export default async function GelirlerPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .order('date', { ascending: false })

  const incomeList: Income[] = data ?? []
  const total = incomeList.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gelirler</h1>
          <p className="text-gray-500 text-sm mt-1">Toplam: {formatCurrency(total)}</p>
        </div>
        <IncomeForm />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">Veriler yüklenirken hata oluştu.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Gelir Kayıtları ({incomeList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {incomeList.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Henüz gelir kaydı yok" description="Yeni bir gelir eklemek için 'Gelir Ekle' butonunu kullanın." />
          ) : (
            <IncomeTable data={incomeList} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
