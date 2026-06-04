import Link from 'next/link'
import { TreePine, TrendingUp, TrendingDown, Wallet, Megaphone, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Announcement } from '@/types'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  const [incomeRes, expenseRes, announcementsRes] = await Promise.all([
    supabase.from('income').select('amount'),
    supabase.from('expenses').select('amount'),
    supabase
      .from('announcements')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const totalIncome = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const totalExpenses = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const balance = totalIncome - totalExpenses
  const announcements: Announcement[] = announcementsRes.data ?? []

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700 font-semibold">
            <TreePine className="h-6 w-6" />
            <span>Olive Garden 3</span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm" className="gap-1">
              <LogIn className="h-4 w-4" /> Giriş Yap
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-1.5 rounded-full text-sm font-medium">
            <TreePine className="h-4 w-4" />
            Olive Garden 3 Site Yönetimi
          </div>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight">
            Saydam & Güvenilir<br />
            <span className="text-green-600">Site Yönetimi</span>
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto text-lg">
            Didim Akbük Olive Garden 3 sitesi sakinlerine yönelik finansal bilgilerin şeffaf biçimde paylaşıldığı platform.
          </p>
        </section>

        {/* Financial Summary */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" /> Finansal Özet
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-green-100">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Toplam Gelir</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-100">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Toplam Gider</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card className={balance >= 0 ? 'border-blue-100' : 'border-orange-100'}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Mevcut Bakiye</CardTitle>
                <Wallet className={`h-4 w-4 ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(balance)}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Announcements */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-green-600" /> Son Duyurular
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
                <Card key={a.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{a.title}</h3>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.content}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="text-xs">{formatDate(a.created_at)}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="text-center py-8">
          <p className="text-gray-500 mb-3">Sakin veya yönetici misiniz?</p>
          <Link href="/login">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 gap-2">
              <LogIn className="h-4 w-4" />
              Hesabınızla Giriş Yapın
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t bg-white mt-8 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Olive Garden 3 Site Yönetimi · Didim Akbük
      </footer>
    </div>
  )
}
