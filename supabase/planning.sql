-- ─── Planlama (Yıllık Planlama) ───────────────────────────────────────────────
-- Admin, geçen yılın gerçekleşen giderlerini baz alarak gelecek dönemin
-- işletme planını hazırlar. Bu dosyayı Supabase SQL editöründe çalıştırın.

-- ─── plans (dönem başlığı) ────────────────────────────────────────────────────
create table if not exists public.plans (
  id            uuid primary key default gen_random_uuid(),
  period        text not null,                 -- örn. "2026-2027"
  start_date    date,
  end_date      date,
  default_rate  numeric(6,2) not null default 32.11,  -- varsayılan TÜFE oranı
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── plan_items (plan kalemleri) ──────────────────────────────────────────────
create table if not exists public.plan_items (
  id                    uuid primary key default gen_random_uuid(),
  plan_id               uuid not null references public.plans(id) on delete cascade,
  source_budget_item_id uuid references public.budget_items(id) on delete set null,
  category              text not null,
  category_en           text,
  sort_order            integer not null default 0,
  base_amount           numeric(12,2),                 -- geçen yıl gerçekleşen (snapshot)
  method                text not null default 'rate',  -- 'rate' | 'manual'
  rate                  numeric(6,2),                  -- 'rate' yönteminde artış %
  planned_amount        numeric(12,2),                 -- 'manual' yönteminde elle tutar
  status                text not null default 'active',-- 'active' | 'excluded' | 'merged'
  optional              boolean not null default false,-- true: Genel kurulda oylanacak opsiyonel kalem
  is_new                boolean not null default false,-- bu yıl eklenen yeni konu
  merged_into           uuid references public.plan_items(id) on delete set null,
  description_tr        text,
  description_en        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists plan_items_plan_idx on public.plan_items (plan_id, sort_order asc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.plans      enable row level security;
alter table public.plan_items enable row level security;

-- plans: herkes okur (ileride sakinlere de gösterilebilir), sadece admin yazar
create policy "plans: authenticated read"
  on public.plans for select to authenticated using (true);
create policy "plans: admins insert"
  on public.plans for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "plans: admins update"
  on public.plans for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "plans: admins delete"
  on public.plans for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "plan_items: authenticated read"
  on public.plan_items for select to authenticated using (true);
create policy "plan_items: admins insert"
  on public.plan_items for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "plan_items: admins update"
  on public.plan_items for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "plan_items: admins delete"
  on public.plan_items for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
