-- Planlama: opsiyonel (Genel kurulda oylanacak) kalem işareti
-- planning.sql'i daha önce çalıştırdıysanız bu delta'yı bir kez çalıştırın.
alter table public.plan_items
  add column if not exists optional boolean not null default false;
