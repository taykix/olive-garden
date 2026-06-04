import { CreditCard } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, MONTHS, PAYMENT_STATUS_LABELS } from '@/lib/utils'
import { PaymentForm } from '@/components/admin/payment-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { PaymentFilters } from '@/components/admin/payment-filters'
import { deletePayment } from '@/lib/supabase/actions'
import { Payment } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ apartment?: string; month?: string; year?: string; status?: string }>
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  paid: 'default',
  partial: 'secondary',
  unpaid: 'destructive',
}

export default async function OdemelerPage({ searchParams }: Props) {
  const filters = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('payments')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .order('apartment_no')

  if (filters.apartment) query = query.ilike('apartment_no', `%${filters.apartment}%`)
  if (filters.month && filters.month !== 'all') query = query.eq('month', Number(filters.month))
  if (filters.year && filters.year !== 'all') query = query.eq('year', Number(filters.year))
  if (filters.status && filters.status !== 'all') query = query.eq('payment_status', filters.status)

  const { data, error } = await query
  const paymentList: Payment[] = data ?? []

  const totalDue = paymentList.reduce((s, p) => s + Number(p.amount_due), 0)
  const totalPaid = paymentList.reduce((s, p) => s + Number(p.amount_paid), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aidat / Ödeme Takibi</h1>
          <p className="text-gray-500 text-sm mt-1">
            Toplam Borç: {formatCurrency(totalDue)} · Toplam Ödenen: {formatCurrency(totalPaid)}
          </p>
        </div>
        <PaymentForm />
      </div>

      <PaymentFilters />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md">Veriler yüklenirken hata oluştu.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-purple-500" />
            Ödeme Kayıtları ({paymentList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paymentList.length === 0 ? (
            <EmptyState icon={CreditCard} title="Kayıt bulunamadı" description="Filtrelerinizi değiştirin veya yeni bir ödeme kaydı ekleyin." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Daire</TableHead>
                    <TableHead>Sakin</TableHead>
                    <TableHead>Dönem</TableHead>
                    <TableHead className="text-right">Borç</TableHead>
                    <TableHead className="text-right">Ödenen</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Ödeme Tarihi</TableHead>
                    <TableHead>Not</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentList.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium whitespace-nowrap">{payment.apartment_no}</TableCell>
                      <TableCell className="text-sm text-gray-600">{payment.resident_name || <span className="text-gray-300">-</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{MONTHS[payment.month]} {payment.year}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(payment.amount_due))}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-green-600">
                        {formatCurrency(Number(payment.amount_paid))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[payment.payment_status]} className="text-xs">
                          {PAYMENT_STATUS_LABELS[payment.payment_status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                        {payment.payment_date ? formatDate(payment.payment_date) : <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                        {payment.note || <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <PaymentForm payment={payment} />
                          <DeleteConfirmDialog onConfirm={deletePayment.bind(null, payment.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
