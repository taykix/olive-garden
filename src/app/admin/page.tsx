import { TrendingUp, TrendingDown, Wallet, Home, AlertCircle } from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, MONTHS } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [incomeRes, expenseRes, paymentsRes, announcementsRes] = await Promise.all([
    supabase.from('income').select('amount'),
    supabase.from('expenses').select('amount'),
    supabase.from('payments').select('apartment_no, resident_name, month, year, amount_due, payment_status').order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('announcements').select('id, title, published, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const totalIncome = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const balance = totalIncome - totalExpenses

  const payments = paymentsRes.data ?? []
  const unpaidPayments = payments.filter((p) => p.payment_status !== 'paid')
  const apartments = [...new Set(payments.map((p) => p.apartment_no))]

  const announcements = announcementsRes.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Yönetim Paneli</h1>
        <p className="text-gray-500 text-sm mt-1">Olive Garden 3 Site Yönetimi</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Toplam Gelir"
          value={formatCurrency(totalIncome)}
          icon={TrendingUp}
          iconClassName="text-green-500"
          className="lg:col-span-1"
        />
        <StatCard
          title="Toplam Gider"
          value={formatCurrency(totalExpenses)}
          icon={TrendingDown}
          iconClassName="text-red-500"
          className="lg:col-span-1"
        />
        <StatCard
          title="Mevcut Bakiye"
          value={formatCurrency(balance)}
          icon={Wallet}
          iconClassName={balance >= 0 ? 'text-blue-500' : 'text-orange-500'}
          className="lg:col-span-1"
        />
        <StatCard
          title="Daire Sayısı"
          value={apartments.length}
          icon={Home}
          iconClassName="text-purple-500"
          className="lg:col-span-1"
        />
        <StatCard
          title="Ödenmemiş"
          value={unpaidPayments.length}
          icon={AlertCircle}
          iconClassName="text-red-500"
          description="Ödeme bekleyen"
          className="lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unpaid payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Ödenmemiş / Eksik Ödemeler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unpaidPayments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Tüm ödemeler tamamlanmış.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {unpaidPayments.slice(0, 10).map((p) => (
                  <div key={`${p.apartment_no}-${p.month}-${p.year}`} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <div>
                      <span className="font-medium">Daire {p.apartment_no}</span>
                      {p.resident_name && <span className="text-gray-400 ml-2">({p.resident_name})</span>}
                      <span className="text-gray-400 ml-2">{MONTHS[p.month]} {p.year}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{formatCurrency(Number(p.amount_due))}</span>
                      <Badge variant={p.payment_status === 'partial' ? 'secondary' : 'destructive'} className="text-xs">
                        {p.payment_status === 'partial' ? 'Kısmi' : 'Ödenmedi'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent announcements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Son Duyurular</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Henüz duyuru yok.</p>
            ) : (
              <div className="space-y-2">
                {announcements.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <span className="font-medium text-gray-800 truncate max-w-[200px]">{a.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-400 text-xs">{formatDate(a.created_at)}</span>
                      <Badge variant={a.published ? 'default' : 'secondary'} className="text-xs">
                        {a.published ? 'Yayında' : 'Taslak'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
