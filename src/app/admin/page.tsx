import { TrendingUp, TrendingDown, Wallet, Home, AlertCircle } from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [incomeRes, expenseRes, paymentsRes, settingsRes, announcementsRes] = await Promise.all([
    supabase.from('income').select('amount'),
    supabase.from('expenses').select('amount'),
    supabase.from('payments').select('apartment_no, resident_name, amount_paid'),
    supabase.from('apartment_settings').select('apartment_no, annual_due, previous_balance'),
    supabase.from('announcements').select('id, title, published, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  const totalIncome   = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const balance       = totalIncome - totalExpenses
  const announcements = announcementsRes.data ?? []

  // Build per-apartment remaining (mirrors odemeler page logic)
  type AptEntry = { resident_name: string; annual_due: number; previous_balance: number; total_paid: number }
  const aptMap = new Map<string, AptEntry>()

  for (const s of settingsRes.data ?? []) {
    aptMap.set(s.apartment_no, {
      resident_name:    '',
      annual_due:       Number(s.annual_due),
      previous_balance: Number(s.previous_balance),
      total_paid:       0,
    })
  }
  for (const p of paymentsRes.data ?? []) {
    if (!aptMap.has(p.apartment_no)) {
      aptMap.set(p.apartment_no, { resident_name: '', annual_due: 40000, previous_balance: 0, total_paid: 0 })
    }
    const e = aptMap.get(p.apartment_no)!
    e.total_paid += Number(p.amount_paid)
    if (!e.resident_name && p.resident_name) e.resident_name = p.resident_name
  }

  type AptDebt = { apartment_no: string; resident_name: string; remaining: number; partial: boolean }
  const debtApts: AptDebt[] = []
  for (const [apt_no, e] of aptMap) {
    const remaining = e.annual_due + e.previous_balance - e.total_paid
    if (remaining > 0.01) {
      debtApts.push({
        apartment_no: apt_no,
        resident_name: e.resident_name,
        remaining,
        partial: e.total_paid > 0,
      })
    }
  }
  debtApts.sort((a, b) => b.remaining - a.remaining)

  const partialCount = debtApts.filter(a => a.partial).length
  const unpaidCount  = debtApts.length - partialCount

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
          value={aptMap.size || [...new Set((paymentsRes.data ?? []).map(p => p.apartment_no))].length}
          icon={Home}
          iconClassName="text-purple-500"
          className="lg:col-span-1"
        />
        <StatCard
          title="Borçlu Daire"
          value={debtApts.length}
          icon={AlertCircle}
          iconClassName="text-red-500"
          description={`${unpaidCount} hiç ödemedi · ${partialCount} eksik`}
          className="lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unpaid apartments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Ödenmemiş / Eksik Ödemeler
              <span className="text-xs font-normal text-gray-400 ml-1">
                ({unpaidCount} hiç ödemedi, {partialCount} eksik)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {debtApts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 px-4">Tüm ödemeler tamamlanmış.</p>
            ) : (
              <div className="max-h-64 overflow-auto">
                {debtApts.map((a) => (
                  <div key={a.apartment_no} className="flex items-center justify-between text-sm px-4 py-2 border-b last:border-0 hover:bg-gray-50/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link
                        href={`/admin/odemeler/${a.apartment_no}`}
                        className="font-mono font-semibold text-green-700 hover:underline shrink-0"
                      >
                        {a.apartment_no}
                      </Link>
                      {a.resident_name && (
                        <span className="text-gray-400 text-xs truncate">{a.resident_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-semibold text-red-600">{formatCurrency(a.remaining)}</span>
                      <Badge
                        variant={a.partial ? 'secondary' : 'destructive'}
                        className="text-xs"
                      >
                        {a.partial ? 'Eksik' : 'Ödenmedi'}
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
