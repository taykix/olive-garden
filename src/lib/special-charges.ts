// Ek ödemeler (aidat dışı) için ortak yardımcılar — sunucu ve istemci tarafında kullanılabilir.

// Ticari birimler (dükkanlar). F blokta F-1 ve F-2 dükkan, F-3 ve sonrası dairedir.
export const SHOP_UNITS = ['F-1', 'F-2']

export function isShop(apartmentNo: string): boolean {
  return SHOP_UNITS.includes(apartmentNo)
}

export type ChargeStatus = 'paid' | 'partial' | 'overdue' | 'pending' | 'exempt' | 'credit'

export function chargeStatus(amountDue: number, paid: number, dueDate: string, today = new Date()): ChargeStatus {
  if (amountDue <= 0) return paid > 0.01 ? 'credit' : 'exempt'
  const remaining = amountDue - paid
  if (remaining < -0.01) return 'credit'
  if (remaining < 0.01) return 'paid'
  const isLate = today.toISOString().slice(0, 10) > dueDate
  if (isLate) return 'overdue'
  return paid > 0.01 ? 'partial' : 'pending'
}

// Ünvan/açıklama metninden daire numarası tahmini: "A-5", "a 5", "Daire B7", "F-12" …
export function guessApartment(text: string, known: string[]): string | null {
  const re = /\b([A-Fa-f])\s*[-–/]?\s*(\d{1,2})\b/g
  for (const m of text.matchAll(re)) {
    const apt = `${m[1].toUpperCase()}-${Number(m[2])}`
    if (known.includes(apt)) return apt
  }
  return null
}
