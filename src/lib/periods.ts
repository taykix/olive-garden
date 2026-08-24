// ─── Yönetim Dönemleri (Period / Term) ─────────────────────────────────────────
//
// TÜM dönem bağlı hesapların TEK kaynağı. Aidat tabloları, bütçe planı ve dönem
// filtreleri buradan beslenir. Daha önce bu bilgi 5 ayrı dosyaya gömülüydü.
//
// Yeni bir döneme geçerken:
//   1. Yeni bir PeriodDef ekleyin (active: true).
//   2. Bir önceki dönemin active değerini false yapın (arşiv olarak kalır).
//   3. apartment_settings için ilgili SQL migration'ını çalıştırın.

export interface PeriodMonth {
  month: number // 1-12
  year: number
}

export interface PeriodDef {
  id: string // örn. 'p2026-2027' — apartment_settings.period_id ile eşleşir
  label: string // örn. '2026–2027'
  months: PeriodMonth[] // aidat tablosunda gösterilecek aylar (kronolojik)
  budgetStart: string // 'YYYY-MM-DD' — gider/bütçe filtresi başlangıcı
  budgetEnd: string // 'YYYY-MM-DD' — gider/bütçe filtresi bitişi
  active: boolean // aktif dönem (aynı anda yalnızca bir tane)
}

// Ardışık ay listesi üretir: (8, 2026, 12) → Ağu 2026 … Tem 2027
function buildMonths(startMonth: number, startYear: number, count: number): PeriodMonth[] {
  const out: PeriodMonth[] = []
  let m = startMonth
  let y = startYear
  for (let i = 0; i < count; i++) {
    out.push({ month: m, year: y })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

export const PERIODS: PeriodDef[] = [
  {
    id: 'p2025-2026',
    label: '2025–2026',
    // Eski dönem: Ekim 2025 – Temmuz 2026 (10 ay). Ağustos 2026 ve sonrası yeni
    // döneme aittir — yeni yönetim dönemi 1 Ağustos 2026'da başlar.
    months: buildMonths(10, 2025, 3).concat(buildMonths(1, 2026, 7)),
    budgetStart: '2025-09-27',
    budgetEnd: '2026-08-31',
    active: false,
  },
  {
    id: 'p2026-2027',
    label: '2026–2027',
    // Yeni dönem: 1 Ağustos 2026'dan itibaren, Ağustos 2026 – Temmuz 2027 (12 ay)
    months: buildMonths(8, 2026, 12),
    budgetStart: '2026-08-01',
    budgetEnd: '2027-07-31',
    active: true,
  },
]

// Aktif (güncel) dönem — aidat tabloları ve dönem filtreleri varsayılan bunu kullanır.
export const ACTIVE_PERIOD: PeriodDef = PERIODS.find((p) => p.active) ?? PERIODS[PERIODS.length - 1]

// Arşiv dönemleri (aktif olmayanlar), en yeniden eskiye.
export const ARCHIVED_PERIODS: PeriodDef[] = PERIODS.filter((p) => !p.active)

// Bütçe planı raporunun ("İşletme Planı") ve yeni plan baz tutarının dayandığı,
// en son kapanan dönem. budget_items sütunları (…_2025_2026) bu dönemle eşleşir.
export const BUDGET_BASE_PERIOD_ID = 'p2025-2026'

// Verilen id'ye karşılık dönemi döndürür; bulunamazsa aktif döneme düşer.
export function getPeriod(id?: string | null): PeriodDef {
  if (!id) return ACTIVE_PERIOD
  return PERIODS.find((p) => p.id === id) ?? ACTIVE_PERIOD
}

// Yönetim panelinin gelir/gider/bakiye hesabı için dönemin tarih aralığı.
// [start, end) — end BİR SONRAKİ dönemin başlangıcıdır (dışlayıcı), böylece dönemler
// çakışmaz ve devreden bakiye = önceki dönemin kapanış bakiyesi olur. Son (aktif)
// dönemde end açık uçludur. Not: bu, İşletme Planı'nın (budgetStart/budgetEnd,
// mali yıl Eyl–Ağu) kendi aralığından bağımsızdır.
export function getTreasuryRange(period: PeriodDef): { start: string; end: string } {
  const idx = PERIODS.findIndex((p) => p.id === period.id)
  const next = PERIODS[idx + 1]
  return { start: period.budgetStart, end: next ? next.budgetStart : '9999-12-31' }
}

// "YYYY-M" anahtar üreticisi — payments (year, month) ile eşleştirmede kullanılır.
export function monthKey(pm: PeriodMonth): string {
  return `${pm.year}-${pm.month}`
}

// Bir ödemenin (year, month) hangi döneme ait olduğunu bulur; hiçbiriyse null.
export function periodOfPayment(year: number, month: number): PeriodDef | null {
  return PERIODS.find((p) => p.months.some((m) => m.year === year && m.month === month)) ?? null
}
