-- Supabase SQL Editor'da çalıştırın
alter table public.expenses
  add column if not exists budget_item_id uuid references public.budget_items(id) on delete set null;
