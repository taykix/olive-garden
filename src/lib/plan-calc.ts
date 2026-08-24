// ─── Planlama (İşletme Planı) tutar hesabı ─────────────────────────────────────
// plan_items kalemlerinin "planlanan" tutarını hesaplar. planning-table.tsx içindeki
// aynı mantığın paylaşılabilir sürümüdür; Raporlar sayfası budget_items ile eşlemek
// için kullanır.

export interface PlanItemCalc {
  id: string
  source_budget_item_id: string | null
  base_amount: number | null
  method: string // 'rate' | 'manual'
  rate: number | null
  planned_amount: number | null
  status: string // 'active' | 'excluded' | 'merged'
  merged_into: string | null
}

function effectiveBase(item: PlanItemCalc, all: PlanItemCalc[]): number {
  if (item.status === 'merged') return 0
  const children = all.filter((c) => c.merged_into === item.id && c.status === 'merged')
  return (item.base_amount ?? 0) + children.reduce((s, c) => s + (c.base_amount ?? 0), 0)
}

export function plannedAmount(item: PlanItemCalc, all: PlanItemCalc[]): number {
  if (item.status === 'excluded' || item.status === 'merged') return 0
  if (item.method === 'manual') return item.planned_amount ?? 0
  return Math.round(effectiveBase(item, all) * (1 + (item.rate ?? 0) / 100))
}

// budget_item id → planlanan tutar eşlemesi (aynı budget item'a bağlı kalemler toplanır)
export function plannedByBudgetItem(items: PlanItemCalc[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const it of items) {
    if (!it.source_budget_item_id) continue
    const amt = plannedAmount(it, items)
    if (amt === 0) continue
    map[it.source_budget_item_id] = (map[it.source_budget_item_id] ?? 0) + amt
  }
  return map
}
