import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Income } from '@/types'
import { IncomeTable } from '@/app/admin/gelirler/income-table'

export const dynamic = 'force-dynamic'

export default async function ResidentGelirlerPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('income').select('*').order('date', { ascending: false })
  const incomeList: Income[] = data ?? []
  const total = incomeList.reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gelirler</h1>
        <p className="text-gray-500 text-sm mt-1">Toplam: {formatCurrency(total)}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Gelir Kayıtları ({incomeList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {incomeList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Henüz gelir kaydı yok.</p>
          ) : (
            <IncomeTable data={incomeList} readOnly />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
