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

// Ünvan/açıklama metninden daire numarası tahmini (ortak yardımcı)
export { guessApartmentFromText as guessApartment } from './reconcile'
