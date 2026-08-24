import { TrendingUp, TrendingDown, Wallet, Home, AlertCircle } from 'lucide-react'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { getPeriod, getTreasuryRange, PERIODS, ACTIVE_PERIOD } from '@/lib/periods'
import { PeriodSelector } from '@/components/shared/period-selector'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const period = getPeriod(periodParam)
  const isActivePeriod = period.id === ACTIVE_PERIOD.id
  const periodOptions = PERIODS.map(p => ({ id: p.id, label: `${p.label} — ${p.active ? 'Aktif' : 'Arşiv'}` }))
  const { start: periodStart, end: periodEnd } = getTreasuryRange(period)

  const supabase = await createClient()

  const [incomeRes, expenseRes, paymentsRes, settingsRes, announcementsRes] = await Promise.all([
    supabase.from('income').select('date, amount'),
    supabase.from('expenses').select('date, amount'),
    supabase.from('payments').select('apartment_no, resident_name, amount_paid').eq('period_id', period.id),
    supabase.from('apartment_settings').select('apartment_no, annual_due, previous_balance').eq('period_id', period.id),
    supabase.from('announcements').select('id, title, published, created_at').order('created_at', { ascending: false }).limit(5),
  ])

  // Dönem aralığı [periodStart, periodEnd) ; devir = dönem başından ÖNCEki net (geçen dönemlerden devreden para)
  const inPeriod = (d: string) => d >= periodStart && d < periodEnd
  const beforePeriod = (d: string) => d < periodStart
  const periodIncome  = (incomeRes.data ?? []).filter(r => inPeriod(r.date)).reduce((s, r) => s + Number(r.amount), 0)
  const periodExpense = (expenseRes.data ?? []).filter(r => inPeriod(r.date)).reduce((s, r) => s + Number(r.amount), 0)
  const carryIncome   = (incomeRes.data ?? []).filter(r => beforePeriod(r.date)).reduce((s, r) => s + Number(r.amount), 0)
  const carryExpense  = (expenseRes.data ?? []).filter(r => beforePeriod(r.date)).reduce((s, r) => s + Number(r.amount), 0)
  const carriedBalance = carryIncome - carryExpense           // geçen dönemden devreden bakiye
  const balance        = carriedBalance + periodIncome - periodExpense  // mevcut bakiye (devir dahil)
  const announcements  = announcementsRes.data ?? []

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Yönetim Paneli
            <span className="ml-2 text-base font-normal text-gray-400">{period.label}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">Olive Garden 3 Site Yönetimi</p>
        </div>
        <PeriodSelector options={periodOptions} value={period.id} />
      </div>

      {!isActivePeriod && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Arşiv dönemi görüntüleniyor ({period.label}). Rakamlar bu döneme aittir.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Devreden Bakiye"
          value={formatCurrency(carriedBalance)}
          icon={Wallet}
          iconClassName={carriedBalance >= 0 ? 'text-teal-500' : 'text-orange-500'}
          description="Geçen dönemden"
        />
        <StatCard
          title="Dönem Geliri"
          value={formatCurrency(periodIncome)}
          icon={TrendingUp}
          iconClassName="text-green-500"
        />
        <StatCard
          title="Dönem Gideri"
          value={formatCurrency(periodExpense)}
          icon={TrendingDown}
          iconClassName="text-red-500"
        />
        <StatCard
          title="Mevcut Bakiye"
          value={formatCurrency(balance)}
          icon={Wallet}
          iconClassName={balance >= 0 ? 'text-blue-500' : 'text-orange-500'}
          description="Devir dahil"
        />
        <StatCard
          title="Daire Sayısı"
          value={aptMap.size || [...new Set((paymentsRes.data ?? []).map(p => p.apartment_no))].length}
          icon={Home}
          iconClassName="text-purple-500"
        />
        <StatCard
          title="Borçlu Daire"
          value={debtApts.length}
          icon={AlertCircle}
          iconClassName="text-red-500"
          description={`${unpaidCount} hiç ödemedi · ${partialCount} eksik`}
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
