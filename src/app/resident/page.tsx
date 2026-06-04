import { TrendingUp, TrendingDown, Wallet, Megaphone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ResidentPage() {
  const supabase = await createClient()

  const [incomeRes, expenseRes, announcementsRes] = await Promise.all([
    supabase.from('income').select('amount'),
    supabase.from('expenses').select('amount'),
    supabase
      .from('announcements')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalIncome = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const balance = totalIncome - totalExpenses
  const announcements = announcementsRes.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Merhaba!</h1>
        <p className="text-gray-500 text-sm mt-1">Olive Garden 3 Site Yönetimi - Sakin Paneli</p>
      </div>

      {/* Financial summary */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Finansal Özet</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Toplam Gelir</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Toplam Gider</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Mevcut Bakiye</CardTitle>
              <Wallet className={`h-4 w-4 ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatCurrency(balance)}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Announcements */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-green-600" /> Duyurular
        </h2>
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-400">
              Henüz yayınlanmış duyuru bulunmamaktadır.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <Card key={a.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{a.content}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{formatDate(a.created_at)}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
