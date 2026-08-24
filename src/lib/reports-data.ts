import { createClient } from './supabase/server'
import { plannedByBudgetItem, type PlanItemCalc } from './plan-calc'
import { ACTIVE_PERIOD } from './periods'

// Aktif dönemin (2026-2027) Yıllık İşletme Planı'ndan budget_item id → planlanan tutar
// eşlemesini döndürür. Raporlar sayfasındaki İşletme Planı tablosunun "2026-2027
// Planlanan" sütununu besler. Plan yoksa boş nesne döner.
export async function getActivePlanPlannedMap(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, number>> {
  const { data: plans } = await supabase
    .from('plans')
    .select('id, start_date')
    .eq('start_date', ACTIVE_PERIOD.budgetStart)
    .limit(1)
  const plan = plans?.[0]
  if (!plan) return {}

  const { data: items } = await supabase
    .from('plan_items')
    .select('id, source_budget_item_id, base_amount, method, rate, planned_amount, status, merged_into')
    .eq('plan_id', plan.id)

  return plannedByBudgetItem((items ?? []) as PlanItemCalc[])
}
