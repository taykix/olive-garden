/* eslint-disable @typescript-eslint/no-explicit-any */
// Aidat ↔ Gelirler senkronu ve mutabakat işlemleri — bellek içi sahte Supabase ile uçtan uca testler.
// Çalıştırma: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { db, reset } from './mock-supabase.ts'
import * as A from '../src/lib/supabase/actions.ts'
import { reconcile } from '../src/lib/reconcile.ts'
import { fetchAll } from '../src/lib/supabase/fetch-all.ts'

const base = () => reset({
  profiles: [{ id: 'admin-1', role: 'admin' }],
  apartment_settings: [
    { apartment_no: 'F-1', period_id: 'p2026-2027', annual_due: 25000 },
    { apartment_no: 'F-3', period_id: 'p2026-2027', annual_due: 50000 },
    { apartment_no: 'F-3', period_id: 'p2025-2026', annual_due: 40000 },
  ],
  income: [], payments: [], special_charges: [], special_charge_items: [], special_charge_payments: [],
})
const pay = (o: any = {}) => ({ apartment_no: 'F-1', month: 8, year: 2026, amount_due: 25000, amount_paid: 10000, payment_status: 'partial', payment_date: '2026-08-12', ...o })
const check = () => reconcile(db.payments as any, db.income as any, { knownApartments: ['F-1', 'F-3'] }).issues

test('createPayment: gelir kaydı oluşturur ve bağlar', async () => {
  base()
  assert.deepEqual(await A.createPayment(pay()), { success: true })
  assert.equal(db.income.length, 1)
  assert.equal(db.payments[0].income_id, db.income[0].id)
  assert.equal(db.income[0].category, 'Aidat')
  assert.equal(check().length, 0)
})

test('createPayment: 0 tutarlı ödeme gelirsiz kaydedilir (sorun sayılmaz)', async () => {
  base()
  assert.ok((await A.createPayment(pay({ amount_paid: 0, payment_status: 'unpaid' }))).success)
  assert.equal(db.income.length, 0); assert.equal(db.payments.length, 1)
  assert.equal(check().length, 0)
})

test('updateIncome: aidat gelirini düzenlemek aidat tablosunu da günceller (F-1 senaryosu)', async () => {
  base()
  await A.createPayment(pay())
  const inc = db.income[0]
  const r = await A.updateIncome(inc.id, { date: '2026-08-15', title: inc.title, amount: 12500, category: 'Diğer' })
  assert.ok(r.success, JSON.stringify(r))
  assert.equal(Number(db.payments[0].amount_paid), 12500)
  assert.equal(db.payments[0].payment_date, '2026-08-15')
  assert.equal(db.income[0].category, 'Aidat', 'bağlı gelirin kategorisi korunur')
  assert.equal(check().length, 0)
})

test('updateIncome: bağlantısız geliri sonradan Aidat yapmak engellenir', async () => {
  base()
  db.income.push({ id: 'i-x', date: '2026-08-01', title: 'x', category: 'Diğer', amount: 100 })
  assert.ok((await A.updateIncome('i-x', { date: '2026-08-01', title: 'x', amount: 100, category: 'Aidat' })).error)
})

test('updatePayment: daire/tutar değişikliği gelire yansır; 0 yapılınca gelir silinir, ödeme kalır', async () => {
  base()
  await A.createPayment(pay())
  const id = db.payments[0].id
  assert.ok((await A.updatePayment(id, { ...pay({ apartment_no: 'F-3', amount_paid: 15000 }) })).success)
  assert.equal(db.income[0].apartment_no, 'F-3')
  assert.equal(Number(db.income[0].amount), 15000)
  assert.equal(check().length, 0)
  assert.ok((await A.updatePayment(id, { ...pay({ apartment_no: 'F-3', amount_paid: 0 }) })).success)
  assert.equal(db.income.length, 0)
  assert.equal(db.payments.length, 1, 'ödeme CASCADE ile silinmemeli')
  assert.equal(db.payments[0].income_id, null)
})

test('updatePayment: gelirsiz ödemeye tutar girilince gelir oluşturulur', async () => {
  base()
  db.payments.push({ id: 'p-csv', ...pay({ amount_paid: 0 }), income_id: null })
  assert.ok((await A.updatePayment('p-csv', pay({ amount_paid: 5000 }))).success)
  assert.equal(db.income.length, 1)
  assert.equal(db.payments[0].income_id, db.income[0].id)
})

test('bulkImportData: Aidat kategorili satırlar reddedilir', async () => {
  base()
  const r = await A.bulkImportData([{ date: '2026-08-01', title: 'a', description: '', category: 'Aidat', amount: 1 }], [])
  assert.ok(r.error); assert.equal(db.income.length, 0)
})

test('mutabakat: tutar farkı iki yönde de düzeltilir', async () => {
  base()
  await A.createPayment(pay())
  db.income[0].amount = 12500                       // eski kodla sonradan düzenlenmiş gelir
  assert.equal(check()[0].kind, 'amount_mismatch')
  assert.ok((await A.reconSyncPaymentFromIncome(db.payments[0].id)).success)
  assert.equal(Number(db.payments[0].amount_paid), 12500)
  db.income[0].amount = 9000
  assert.ok((await A.reconSyncIncomeFromPayment(db.payments[0].id)).success)
  assert.equal(Number(db.income[0].amount), 12500)
  assert.equal(check().length, 0)
})

test('mutabakat: gelirsiz ödeme + ödemesiz aidat geliri eşleştirilir (F-3 senaryosu)', async () => {
  base()
  db.payments.push({ id: 'p-csv', ...pay({ apartment_no: 'F-3' }), income_id: null, period_id: 'p2026-2027' })
  db.income.push({ id: 'i-old', date: '2026-08-15', title: 'Veli F-3 aidat', category: 'Aidat', amount: 10000, apartment_no: null })
  const iss = check()
  const ni = iss.find(i => i.kind === 'no_income')!
  assert.equal(ni.suggestion?.incomeId, 'i-old')
  assert.ok((await A.reconLinkIncomeToPayment('i-old', 'p-csv')).success)
  assert.equal(db.income[0].apartment_no, 'F-3')
  // tarih farkı kalır (ödeme 12.08, gelir 15.08) → geliri esas al
  assert.deepEqual(check().map(i => i.kind), ['date_mismatch'])
  await A.reconSyncPaymentFromIncome('p-csv')
  assert.equal(check().length, 0)
  // aynı geliri ikinci kez bağlamak engellenir
  db.payments.push({ id: 'p2', ...pay({ apartment_no: 'F-3' }), income_id: null })
  assert.ok((await A.reconLinkIncomeToPayment('i-old', 'p2')).error)
})

test('mutabakat: gelirsiz ödemeye gelir oluşturma ve ödemesiz gelirden ödeme oluşturma', async () => {
  base()
  db.payments.push({ id: 'p-csv', ...pay({ apartment_no: 'F-3', payment_date: null }), income_id: null })
  assert.ok((await A.reconCreateIncomeForPayment('p-csv')).success)
  assert.equal(db.income[0].date, '2026-08-01')
  assert.ok((await A.reconCreateIncomeForPayment('p-csv')).error, 'ikinci kez oluşturulmaz')

  db.income.push({ id: 'i-orphan', date: '2026-10-05', title: 'x', category: 'Aidat', amount: 15000, apartment_no: null })
  assert.ok((await A.reconCreatePaymentFromIncome('i-orphan', 'F-3')).success)
  const np = db.payments.find(p => p.income_id === 'i-orphan')!
  assert.equal(np.period_id, 'p2026-2027'); assert.equal(np.month, 10); assert.equal(Number(np.amount_due), 50000)
  assert.equal(np.payment_status, 'partial')
  assert.equal(check().length, 0)

  db.income.push({ id: 'i-not', date: '2026-10-05', title: 'kira', category: 'Aidat', amount: 1, apartment_no: null })
  assert.ok((await A.reconRecategorizeIncome('i-not', 'Diğer')).success)
  assert.ok((await A.reconRecategorizeIncome('i-orphan', 'Diğer')).error, 'bağlı gelirin kategorisi değişmez')
})

test('deletePayment: gelir ile birlikte silinir', async () => {
  base()
  await A.createPayment(pay())
  await A.deletePayment(db.payments[0].id)
  assert.equal(db.payments.length, 0); assert.equal(db.income.length, 0)
})

test('ek ödeme: ödeme + gelir, gelir düzenlenince senkron, eşleştirme tekrarına izin yok', async () => {
  base()
  db.special_charges.push({ id: 'c1', title: 'ASKİ Su Bağlantısı', income_category: 'Su / ASKİ', due_date: '2026-11-01' })
  assert.ok((await A.addSpecialChargePayment({ charge_id: 'c1', apartment_no: 'F-1', amount_paid: 13305, payment_date: '2026-10-20' })).success)
  assert.equal(db.income[0].category, 'Su / ASKİ')
  await A.updateIncome(db.income[0].id, { date: '2026-10-21', title: 't', amount: 13000, category: 'Su / ASKİ' })
  assert.equal(Number(db.special_charge_payments[0].amount_paid), 13000)
  db.income.push({ id: 'i-w', date: '2026-10-01', title: 'F-3 ASKİ', category: 'Diğer', amount: 14025 })
  assert.ok((await A.linkIncomeToSpecialCharge('i-w', 'c1', 'F-3')).success)
  assert.equal(db.income.find(i => i.id === 'i-w')!.category, 'Su / ASKİ')
  assert.equal((await A.linkIncomeToSpecialCharge('i-w', 'c1', 'F-3')).error, 'Bu gelir zaten bir ek ödemeye bağlı.')
  await A.deleteSpecialChargePayment(db.special_charge_payments[0].id, true)
  assert.equal(db.income.some(i => i.category === 'Su / ASKİ' && i.apartment_no === 'F-1'), false)
})

test('fetchAll: 1000 satır sınırını aşan veriyi eksiksiz çeker', async () => {
  const rows = Array.from({ length: 2345 }, (_, i) => ({ n: i }))
  const { data } = await fetchAll<{ n: number }>(async (f, t) => ({ data: rows.slice(f, Math.min(t + 1, f + 1000)), error: null }))
  assert.equal(data.length, 2345)
})
