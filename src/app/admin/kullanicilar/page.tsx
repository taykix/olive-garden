import { createClient } from '@/lib/supabase/server'
import { approveUser, rejectUser } from '@/lib/supabase/actions'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Clock, CheckCircle2, XCircle, Home } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function KullanicilarPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status, apartment_no, last_sign_in_at, created_at')
    .order('created_at', { ascending: false })

  const all       = profiles ?? []
  const pending   = all.filter(p => p.status === 'pending')
  const approved  = all.filter(p => p.status === 'approved')
  const rejected  = all.filter(p => p.status === 'rejected')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-green-700" /> Kullanıcı Yönetimi
        </h1>
        <p className="text-gray-500 text-sm mt-1">{all.length} kayıtlı kullanıcı</p>
      </div>

      {/* ── Üyelik İstekleri ── */}
      <Card className={pending.length > 0 ? 'border-amber-200' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
            <Clock className="h-4 w-4" />
            Üyelik İstekleri ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Bekleyen üyelik isteği yok.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {pending.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{p.full_name || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.email || '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Home className="h-3 w-3" /> Daire: {p.apartment_no || '—'}
                      <span className="ml-2">· Kayıt: {formatDate(p.created_at)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={approveUser.bind(null, p.id)}>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Onayla
                      </Button>
                    </form>
                    <form action={rejectUser.bind(null, p.id)}>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 gap-1 h-8">
                        <XCircle className="h-3.5 w-3.5" /> Reddet
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Onaylı Kullanıcılar ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Onaylı Kullanıcılar ({approved.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {approved.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Onaylı kullanıcı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Ad Soyad</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">E-posta</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Daire</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Rol</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Son Giriş</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {approved.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.full_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{p.email || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-green-700 font-semibold">{p.apartment_no || '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={p.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {p.role === 'admin' ? 'Admin' : 'Üye'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {p.last_sign_in_at ? formatDate(p.last_sign_in_at) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.role !== 'admin' && (
                          <form action={rejectUser.bind(null, p.id)}>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 text-xs gap-1">
                              <XCircle className="h-3 w-3" /> Engelle
                            </Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Reddedilenler ── */}
      {rejected.length > 0 && (
        <Card className="border-red-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4" />
              Reddedilen / Engellenen ({rejected.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {rejected.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div>
                    <p className="font-medium text-gray-700 text-sm">{p.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{p.email || '—'} · Daire: {p.apartment_no || '—'}</p>
                  </div>
                  <form action={approveUser.bind(null, p.id)}>
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 gap-1 h-8">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Yeniden Onayla
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
