// Aidat tablosu (payments) ↔ Gelirler (income) mutabakatı — saf mantık, test edilebilir.
//
// Normalde her aidat ödemesi (amount_paid > 0) tam olarak bir "Aidat" gelir kaydına
// income_id ile bağlıdır ve tutar/tarih/daire aynıdır. Bu modül sapmaları bulur.

export interface RPayment {
  id: string
  apartment_no: string
  resident_name: string | null
  month: number
  year: number
  amount_paid: number
  payment_date: string | null
  income_id: string | null
}

export interface RIncome {
  id: string
  date: string
  title: string
  description: string | null
  category: string | null
  amount: number
  apartment_no: string | null
}

export type IssueKind =
  | 'amount_mismatch'   // bağlı, ama tutarlar farklı (çoğunlukla gelir sonradan düzenlenmiş)
  | 'apt_mismatch'      // bağlı, ama gelirdeki daire no farklı
  | 'category_changed'  // bağlı, ama gelir kategorisi artık "Aidat" değil
  | 'date_mismatch'     // bağlı, ama ödeme tarihi ≠ gelir tarihi
  | 'no_income'         // ödeme var (> 0), gelir kaydı yok
  | 'orphan_income'     // "Aidat" kategorili gelir var, bağlı ödeme yok

export interface Issue {
  kind: IssueKind
  apartment_no: string | null
  payment?: RPayment
  income?: RIncome
  diff: number          // aidat tablosu − gelirler (bu sorunun toplamlara etkisi)
  suggestion?: { paymentId?: string; incomeId?: string; apartment_no?: string | null }
}

export interface AptSummary {
  apartment_no: string
  aidatTotal: number    // aidat tablosundaki toplam ödeme
  incomeTotal: number   // bu daireye ait Gelirler toplamı (bağlı + tahmin edilen bağlantısız)
  diff: number
  issues: Issue[]
}

const EPS = 0.009

// Ünvan/açıklama metninden daire numarası tahmini: "A-5", "a 5", "Daire B7" …
export function guessApartmentFromText(text: string, known: string[]): string | null {
  const re = /\b([A-Fa-f])\s*[-–/]?\s*(\d{1,2})\b/g
  for (const m of text.matchAll(re)) {
    const apt = `${m[1].toUpperCase()}-${Number(m[2])}`
    if (known.includes(apt)) return apt
  }
  return null
}

export function isAidatCategory(c: string | null | undefined): boolean {
  return (c ?? '').trim().toLocaleLowerCase('tr') === 'aidat'
}

export function reconcile(
  payments: RPayment[],
  incomes: RIncome[],
  opts: { knownApartments: string[]; incomeInScope?: (i: RIncome) => boolean }
): { issues: Issue[]; byApartment: AptSummary[] } {
  const incomeById = new Map(incomes.map(i => [i.id, i]))
  const linkedIncomeIds = new Set<string>()
  const issues: Issue[] = []

  // Daire başına toplamlar
  const aidat = new Map<string, number>()
  const inc = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)

  const orphanPayments: RPayment[] = []

  for (const p of payments) {
    const paid = Number(p.amount_paid)
    add(aidat, p.apartment_no, paid)

    const income = p.income_id ? incomeById.get(p.income_id) : undefined
    if (!income) {
      if (Math.abs(paid) > EPS) {
        orphanPayments.push(p)
        issues.push({ kind: 'no_income', apartment_no: p.apartment_no, payment: p, diff: paid })
      }
      continue
    }

    linkedIncomeIds.add(income.id)
    const amt = Number(income.amount)
    add(inc, p.apartment_no, amt)

    if (Math.abs(amt - paid) > EPS) {
      issues.push({ kind: 'amount_mismatch', apartment_no: p.apartment_no, payment: p, income, diff: paid - amt })
    }
    if (income.apartment_no && income.apartment_no !== p.apartment_no) {
      issues.push({ kind: 'apt_mismatch', apartment_no: p.apartment_no, payment: p, income, diff: 0 })
    }
    if (!isAidatCategory(income.category)) {
      issues.push({ kind: 'category_changed', apartment_no: p.apartment_no, payment: p, income, diff: 0 })
    }
    if (p.payment_date && p.payment_date !== income.date) {
      issues.push({ kind: 'date_mismatch', apartment_no: p.apartment_no, payment: p, income, diff: 0 })
    }
  }

  // Bağlantısız "Aidat" gelirleri
  const usedSuggestions = new Set<string>()
  for (const i of incomes) {
    if (linkedIncomeIds.has(i.id) || !isAidatCategory(i.category)) continue
    if (opts.incomeInScope && !opts.incomeInScope(i)) continue
    const apt = (i.apartment_no && opts.knownApartments.includes(i.apartment_no))
      ? i.apartment_no
      : guessApartmentFromText(`${i.title} ${i.description ?? ''}`, opts.knownApartments)
    const amt = Number(i.amount)
    if (apt) add(inc, apt, amt)

    // Aynı daire + aynı tutarda gelirsiz bir ödeme varsa eşleştirme öner
    const match = apt
      ? orphanPayments.find(p => p.apartment_no === apt && Math.abs(Number(p.amount_paid) - amt) <= EPS && !usedSuggestions.has(p.id))
      : undefined
    if (match) usedSuggestions.add(match.id)

    issues.push({
      kind: 'orphan_income',
      apartment_no: apt,
      income: i,
      diff: -amt,
      suggestion: { paymentId: match?.id, apartment_no: apt },
    })
  }

  // Gelirsiz ödemelere karşı öneri (ters yön)
  for (const is of issues) {
    if (is.kind !== 'no_income') continue
    const pair = issues.find(o => o.kind === 'orphan_income' && o.suggestion?.paymentId === is.payment!.id)
    if (pair) is.suggestion = { incomeId: pair.income!.id }
  }

  const apts = new Set<string>([...aidat.keys(), ...inc.keys()])
  const byApartment: AptSummary[] = [...apts].map(apt => {
    const a = aidat.get(apt) ?? 0
    const b = inc.get(apt) ?? 0
    return { apartment_no: apt, aidatTotal: a, incomeTotal: b, diff: a - b, issues: issues.filter(x => x.apartment_no === apt) }
  })

  return { issues, byApartment }
}
