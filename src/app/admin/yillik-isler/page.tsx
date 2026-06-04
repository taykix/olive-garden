import { Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { AnnualWorkForm } from '@/components/admin/annual-work-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { deleteAnnualWork } from '@/lib/supabase/actions'
import { AnnualWork } from '@/types'

export const dynamic = 'force-dynamic'

const statusColors: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
}
const statusLabels: Record<string, string> = {
  planned: 'Planlandı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
}

export default async function YillikIslerPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('annual_works')
    .select('*')
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })

  const works: AnnualWork[] = data ?? []

  // Group by year
  const byYear: Record<number, AnnualWork[]> = {}
  for (const w of works) {
    if (!byYear[w.year]) byYear[w.year] = []
    byYear[w.year].push(w)
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yıllık Yapım / Onarım İşleri</h1>
          <p className="text-gray-500 text-sm mt-1">{works.length} kayıt</p>
        </div>
        <AnnualWorkForm />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">Veriler yüklenirken hata oluştu.</p>}

      {works.length === 0 ? (
        <EmptyState icon={Wrench} title="Henüz yapım/onarım kaydı yok" description="Yeni bir iş eklemek için 'İş Ekle' butonunu kullanın." />
      ) : (
        <div className="space-y-8">
          {years.map((year) => (
            <div key={year}>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="bg-green-100 text-green-800 px-3 py-0.5 rounded-full text-sm">{year}</span>
                <span className="text-sm font-normal text-gray-400">
                  {byYear[year].length} iş ·{' '}
                  Toplam: {formatCurrency(byYear[year].reduce((s, w) => s + Number(w.actual_cost ?? w.estimated_cost ?? 0), 0))}
                </span>
              </h2>
              <div className="space-y-3">
                {byYear[year].map((w) => (
                  <Card key={w.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-gray-900">{w.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[w.status]}`}>
                              {statusLabels[w.status]}
                            </span>
                          </div>
                          {w.description && <p className="text-sm text-gray-500 mt-1">{w.description}</p>}
                          {w.contractor && <p className="text-xs text-gray-400 mt-1">Yüklenici: {w.contractor}</p>}
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            {w.estimated_cost != null && (
                              <span>Tahmini: {formatCurrency(Number(w.estimated_cost))}</span>
                            )}
                            {w.actual_cost != null && (
                              <span className="font-medium">Gerçek: {formatCurrency(Number(w.actual_cost))}</span>
                            )}
                          </div>
                          {w.notes && <p className="text-xs text-gray-400 mt-2 italic">{w.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <AnnualWorkForm work={w} />
                          <DeleteConfirmDialog onConfirm={deleteAnnualWork.bind(null, w.id)} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
