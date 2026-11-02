'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApartmentCombobox } from '@/components/shared/apartment-combobox'
import {
  reconCreateIncomeForPayment,
  reconCreatePaymentFromIncome,
  reconLinkIncomeToPayment,
  reconRecategorizeIncome,
  reconSyncIncomeFromPayment,
  reconSyncPaymentFromIncome,
} from '@/lib/supabase/actions'

type Result = { error?: string; success?: boolean }

function useRun() {
  const [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<Result>, ok: string) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res.error) toast.error(res.error)
    else toast.success(ok)
  }
  return { busy, run }
}

const btn = 'h-7 px-2 text-xs'

// Bağlı ama farklı kayıtlar (tutar / tarih / daire / kategori)
export function LinkedFix({ paymentId }: { paymentId: string }) {
  const { busy, run } = useRun()
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      <Button size="sm" variant="outline" className={btn} disabled={busy}
        title="Aidat tablosundaki tutar doğru: gelir kaydını ona eşitle"
        onClick={() => run(() => reconSyncIncomeFromPayment(paymentId), 'Gelir kaydı aidat tablosuna eşitlendi.')}>
        Aidat doğru → geliri düzelt
      </Button>
      <Button size="sm" variant="outline" className={btn} disabled={busy}
        title="Gelirlerdeki tutar doğru: aidat tablosunu ona eşitle"
        onClick={() => run(() => reconSyncPaymentFromIncome(paymentId), 'Aidat kaydı gelire eşitlendi.')}>
        Gelir doğru → aidatı düzelt
      </Button>
    </div>
  )
}

// Gelir kaydı olmayan ödeme
export function NoIncomeFix({ paymentId, suggestedIncomeId }: { paymentId: string; suggestedIncomeId?: string }) {
  const { busy, run } = useRun()
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {suggestedIncomeId && (
        <Button size="sm" className={btn} disabled={busy}
          onClick={() => run(() => reconLinkIncomeToPayment(suggestedIncomeId, paymentId), 'Önerilen gelir kaydıyla eşleştirildi.')}>
          Önerilen gelirle eşleştir
        </Button>
      )}
      <Button size="sm" variant="outline" className={btn} disabled={busy}
        onClick={() => run(() => reconCreateIncomeForPayment(paymentId), 'Gelir kaydı oluşturuldu.')}>
        Gelir kaydı oluştur
      </Button>
    </div>
  )
}

// Ödemeye bağlı olmayan "Aidat" geliri
export function OrphanIncomeFix({
  incomeId, suggestedPaymentId, suggestedApt, apartments,
}: {
  incomeId: string; suggestedPaymentId?: string; suggestedApt: string | null; apartments: string[]
}) {
  const { busy, run } = useRun()
  const [apt, setApt] = useState(suggestedApt ?? '')
  return (
    <div className="flex flex-wrap items-center gap-1 justify-end">
      {suggestedPaymentId && (
        <Button size="sm" className={btn} disabled={busy}
          onClick={() => run(() => reconLinkIncomeToPayment(incomeId, suggestedPaymentId), 'Gelir, aidat ödemesine bağlandı.')}>
          Önerilen ödemeye bağla
        </Button>
      )}
      <div className="w-20"><ApartmentCombobox apartments={apartments} value={apt} onChange={setApt} placeholder="Daire" /></div>
      <Button size="sm" variant="outline" className={btn} disabled={busy || !apt}
        onClick={() => run(() => reconCreatePaymentFromIncome(incomeId, apt), `${apt} için aidat ödemesi oluşturuldu.`)}>
        Aidat ödemesi oluştur
      </Button>
      <Button size="sm" variant="ghost" className={btn} disabled={busy}
        title="Bu gelir aslında aidat değil: kategorisini 'Diğer' yap"
        onClick={() => run(() => reconRecategorizeIncome(incomeId, 'Diğer'), "Kategori 'Diğer' yapıldı.")}>
        Aidat değil
      </Button>
    </div>
  )
}
