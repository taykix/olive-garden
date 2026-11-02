import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcile, type RIncome, type RPayment } from '../src/lib/reconcile.ts'

const known = ['F-1', 'F-2', 'F-3', 'A-5']
const P = (id: string, apt: string, amt: number, inc: string | null, date = '2026-08-10'): RPayment =>
  ({ id, apartment_no: apt, resident_name: null, month: 8, year: 2026, amount_paid: amt, payment_date: date, income_id: inc })
const I = (id: string, amt: number, cat = 'Aidat', apt: string | null = null, title = 'x', date = '2026-08-10'): RIncome =>
  ({ id, date, title, description: null, category: cat, amount: amt, apartment_no: apt })

const pays = [
  P('p1', 'F-1', 10000, 'i1'),   // gelir sonradan 12.000'e düzenlenmiş
  P('p2', 'F-3', 10000, null),   // gelirsiz (CSV aktarımı)
  P('p3', 'A-5', 10000, 'i3'),   // sorunsuz
  P('p4', 'F-2', 5000, 'i4'),    // gelirin kategorisi değiştirilmiş
  P('p5', 'F-1', 0, null),       // 0 tutar — sorun değil
]
const incs = [
  I('i1', 12000, 'Aidat', 'F-1'),
  I('i2', 10000, 'Aidat', null, 'Mehmet F-3 aidat'), // gelirsiz ödemeyle eşleşmeli
  I('i3', 10000, 'Aidat', 'A-5'),
  I('i4', 5000, 'Diğer', 'F-2'),
  I('i5', 7000, 'Aidat', null, 'bilinmeyen'),         // daire tahmin edilemez
  I('i6', 999, 'Kira Geliri'),                         // ilgisiz
]

test('reconcile: tüm sorun türlerini bulur ve eşleştirme önerir', () => {
  const r = reconcile(pays, incs, { knownApartments: known })
  const kinds = r.issues.map(i => `${i.kind}:${i.apartment_no}`).sort()
  assert.deepEqual(kinds, ['amount_mismatch:F-1', 'category_changed:F-2', 'no_income:F-3', 'orphan_income:F-3', 'orphan_income:null'])
  assert.equal(r.byApartment.find(a => a.apartment_no === 'F-3')!.diff, 0)
  assert.equal(r.byApartment.find(a => a.apartment_no === 'F-1')!.diff, -2000)
  assert.equal(r.issues.find(i => i.kind === 'no_income')!.suggestion!.incomeId, 'i2')
  assert.equal(r.issues.find(i => i.kind === 'orphan_income' && i.apartment_no === 'F-3')!.suggestion!.paymentId, 'p2')
})

test('reconcile: kapsam filtresi bağlantısız gelirleri dışlar', () => {
  const r = reconcile(pays, incs, { knownApartments: known, incomeInScope: i => i.id !== 'i5' })
  assert.ok(!r.issues.some(i => i.income?.id === 'i5'))
})
