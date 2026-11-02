/* eslint-disable @typescript-eslint/no-explicit-any */
// Bellek içi, Supabase sorgu oluşturucusunun bu projede kullanılan alt kümesi.
// FK davranışı: income silinince payments / special_charge_payments (income_id) CASCADE silinir.
type Row = Record<string, any>
export const db: Record<string, Row[]> = {}
let seq = 0
const uid = () => `id-${++seq}`
export function reset(tables: Record<string, Row[]>) {
  for (const k of Object.keys(db)) delete db[k]
  for (const [k, v] of Object.entries(tables)) db[k] = v.map(r => ({ ...r }))
}
const T = (n: string) => (db[n] ??= [])

function checkRow(table: string, r: Row) {
  if (table === 'income' && !(Number(r.amount) > 0)) return { message: 'violates check constraint "income_amount_check"' }
  if (table === 'special_charge_payments' && r.income_id && T(table).some(x => x !== r && x.income_id === r.income_id))
    return { message: 'duplicate key', code: '23505' }
  return null
}

class Q {
  filters: ((r: Row) => boolean)[] = []
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  payload: any; mode: 'many' | 'single' | 'maybe' = 'many'
  from = 0; to = Infinity; returning = false; onConflict?: string
  table: string
  constructor(table: string) { this.table = table }
  select() { if (this.op !== 'select') this.returning = true; return this }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  upsert(p: any, o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.onConflict = o?.onConflict; return this }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this }
  not(c: string, _op: string, _v: null) { this.filters.push(r => r[c] != null); return this }
  in(c: string, vs: any[]) { this.filters.push(r => vs.includes(r[c])); return this }
  gte(c: string, v: any) { this.filters.push(r => r[c] >= v); return this }
  order() { return this }
  limit(n: number) { this.to = n - 1; return this }
  range(a: number, b: number) { this.from = a; this.to = b; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'single'; return this }
  match(r: Row) { return this.filters.every(f => f(r)) }
  exec(): { data: any; error: any } {
    const rows = T(this.table)
    let out: Row[] = []
    if (this.op === 'select') out = rows.filter(r => this.match(r)).slice(this.from, this.to + 1)
    else if (this.op === 'insert' || this.op === 'upsert') {
      for (const p of [].concat(this.payload)) {
        const keys = this.onConflict?.split(',')
        const ex = keys && rows.find(r => keys.every(k => r[k] === (p as Row)[k]))
        if (ex) { Object.assign(ex, p); out.push(ex); continue }
        const r = { id: uid(), ...(p as Row) }
        rows.push(r)
        const e = checkRow(this.table, r); if (e) { rows.pop(); return { data: null, error: e } }
        out.push(r)
      }
    } else if (this.op === 'update') {
      for (const r of rows.filter(r => this.match(r))) {
        const before = { ...r }; Object.assign(r, this.payload)
        const e = checkRow(this.table, r); if (e) { Object.assign(r, before); return { data: null, error: e } }
        out.push(r)
      }
    } else if (this.op === 'delete') {
      const del = rows.filter(r => this.match(r))
      db[this.table] = rows.filter(r => !del.includes(r))
      if (this.table === 'income') for (const t of ['payments', 'special_charge_payments'])
        db[t] = T(t).filter(r => !del.some(d => d.id === r.income_id))
    }
    if (this.op !== 'select' && !this.returning) return { data: null, error: null }
    if (this.mode === 'many') return { data: out.map(r => ({ ...r })), error: null }
    if (out.length > 1) return { data: null, error: { message: 'multiple rows' } }
    if (!out.length) return this.mode === 'single' ? { data: null, error: { message: 'no rows' } } : { data: null, error: null }
    return { data: { ...out[0] }, error: null }
  }
  then(res: any, rej: any) { try { return Promise.resolve(this.exec()).then(res, rej) } catch (e) { return Promise.reject(e).then(res, rej) } }
}

const client = {
  from: (t: string) => new Q(t),
  auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
}
export async function createClient() { return client }
export function createAdminClient() { return client }
