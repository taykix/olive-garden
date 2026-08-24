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

// Aidat taksiti: belirli ayda yıllık aidatın "fraction" oranı tahakkuk eder.
// Örn. { month: 8, year: 2026, fraction: 0.2 } → Ağustos'ta yıllığın %20'si beklenir.
// Oran kullanıldığından yarım aidatlı daireler otomatik olarak taksitin yarısını öder.
export interface Installment {
  month: number
  year: number
  fraction: number
}

export interface PeriodDef {
  id: string // örn. 'p2026-2027' — apartment_settings.period_id ile eşleşir
  label: string // örn. '2026–2027'
  months: PeriodMonth[] // aidat tablosunda gösterilecek aylar (kronolojik)
  budgetStart: string // 'YYYY-MM-DD' — gider/bütçe filtresi başlangıcı
  budgetEnd: string // 'YYYY-MM-DD' — gider/bütçe filtresi bitişi
  active: boolean // aktif dönem (aynı anda yalnızca bir tane)
  installments?: Installment[] // aidat taksit takvimi (yoksa tüm yıllık peşin beklenir)
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
    // Genel kurul kararı: 4 taksit — Ağu 10.000 / Eki 15.000 / Oca 15.000 / May 10.000
    // (tam aidat 50.000 üzerinden; oranlar: %20 / %30 / %30 / %20)
    installments: [
      { month: 8,  year: 2026, fraction: 0.2 },
      { month: 10, year: 2026, fraction: 0.3 },
      { month: 1,  year: 2027, fraction: 0.3 },
      { month: 5,  year: 2027, fraction: 0.2 },
    ],
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

// ─── Aidat taksit / tahakkuk hesabı ────────────────────────────────────────────

// Bugüne (asOf) kadar tahakkuk etmiş taksit oranı toplamı (0..1). Taksit takvimi yoksa
// 1 döner (tüm yıllık peşin beklenir). Bir taksit, ait olduğu ayın 1'inde tahakkuk eder.
export function accruedFraction(period: PeriodDef, asOf: Date = new Date()): number {
  if (!period.installments?.length) return 1
  return period.installments.reduce(
    (f, it) => (asOf >= new Date(it.year, it.month - 1, 1) ? f + it.fraction : f),
    0
  )
}

// Verilen yıllık aidat için bugüne kadar beklenen (tahakkuk eden) tutar.
export function expectedDueToDate(annualDue: number, period: PeriodDef, asOf?: Date): number {
  return Math.round(annualDue * accruedFraction(period, asOf))
}

// Şu an geçerli (son tahakkuk etmiş) taksit; hiçbiri başlamadıysa null.
export function currentInstallment(period: PeriodDef, asOf: Date = new Date()): Installment | null {
  if (!period.installments?.length) return null
  let cur: Installment | null = null
  for (const it of period.installments) {
    if (asOf >= new Date(it.year, it.month - 1, 1)) cur = it
  }
  return cur
}

export interface DuesStatus {
  expected: number       // bugüne kadar beklenen aidat (taksit takvimine göre)
  overdue: number        // güncel kalan = expected + devir − ödenen (>0 ise geride)
  yearRemaining: number  // yıl sonu kalan = yıllık + devir − ödenen
  behind: boolean        // taksit takvimine göre geride mi
  credit: boolean        // yıllık borcun ötesinde fazla ödeme (gerçek alacak) var mı
}

// Bir dairenin taksit takvimine göre güncel aidat durumunu hesaplar.
export function duesStatus(
  annualDue: number,
  previousBalance: number,
  totalPaid: number,
  period: PeriodDef,
  asOf?: Date
): DuesStatus {
  const expected = expectedDueToDate(annualDue, period, asOf)
  const overdue = expected + previousBalance - totalPaid
  const yearRemaining = annualDue + previousBalance - totalPaid
  return {
    expected,
    overdue,
    yearRemaining,
    behind: overdue > 0.01,
    credit: yearRemaining < -0.01,
  }
}
