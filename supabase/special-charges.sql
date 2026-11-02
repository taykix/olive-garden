-- ─── Ek Ödemeler (aidat dışı, tek seferlik tahsilatlar) ───────────────────────
-- Aidattan bağımsız, birim başına tahsil edilen ödemeler için (ör. ASKİ su bağlantısı).
-- Aidat tabloları (apartment_settings, payments) ve aidat hesapları ETKİLENMEZ.
--
-- Bu dosyayı Supabase → SQL Editor'da BİR KEZ çalıştırın. Tekrar çalıştırmak güvenlidir
-- (tablolar "if not exists", tohum veri "on conflict do nothing").

-- 1) Ödeme tanımı
create table if not exists public.special_charges (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique,                       -- tohum veri için sabit anahtar
  title            text not null,
  description      text,
  due_date         date not null,                     -- son ödeme tarihi
  income_category  text not null,                     -- Gelirler'de görünecek kategori
  created_at       timestamptz not null default now()
);

-- 2) Birim başına borç (0 = muaf)
create table if not exists public.special_charge_items (
  charge_id     uuid not null references public.special_charges(id) on delete cascade,
  apartment_no  text not null,
  amount_due    numeric(12,2) not null check (amount_due >= 0),
  note          text,
  primary key (charge_id, apartment_no)
);

-- 3) Yapılan ödemeler — her biri bir Gelir kaydına bağlıdır.
--    Gelir kaydı silinirse ödeme de silinir (aidattaki payments.income_id ile aynı mantık).
create table if not exists public.special_charge_payments (
  id            uuid primary key default gen_random_uuid(),
  charge_id     uuid not null references public.special_charges(id) on delete cascade,
  apartment_no  text not null,
  amount_paid   numeric(12,2) not null check (amount_paid > 0),
  payment_date  date not null,
  note          text,
  income_id     uuid unique references public.income(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists special_charge_payments_charge_idx
  on public.special_charge_payments (charge_id, apartment_no);

-- ─── RLS: saydamlık ilkesi — giriş yapan herkes okur, yalnızca yönetici yazar ──
alter table public.special_charges         enable row level security;
alter table public.special_charge_items    enable row level security;
alter table public.special_charge_payments enable row level security;

drop policy if exists "special_charges: authenticated read" on public.special_charges;
create policy "special_charges: authenticated read"
  on public.special_charges for select to authenticated using (true);
drop policy if exists "special_charges: admins all" on public.special_charges;
create policy "special_charges: admins all"
  on public.special_charges for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "special_charge_items: authenticated read" on public.special_charge_items;
create policy "special_charge_items: authenticated read"
  on public.special_charge_items for select to authenticated using (true);
drop policy if exists "special_charge_items: admins all" on public.special_charge_items;
create policy "special_charge_items: admins all"
  on public.special_charge_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "special_charge_payments: authenticated read" on public.special_charge_payments;
create policy "special_charge_payments: authenticated read"
  on public.special_charge_payments for select to authenticated using (true);
drop policy if exists "special_charge_payments: admins all" on public.special_charge_payments;
create policy "special_charge_payments: admins all"
  on public.special_charge_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Tohum: ASKİ su bağlantısı (son tarih 01.11.2026) ─────────────────────────
--   A, B, C, D, E blok daireler : 14.850 ₺
--   F blok daireler (F-3, F-4…)  : 14.025 ₺
--   Dükkanlar (F-1, F-2)         : 13.305 ₺
insert into public.special_charges (slug, title, description, due_date, income_category)
values (
  'aski-2026',
  'ASKİ Su Bağlantısı',
  'ASKİ resmi tarifesine göre birim başına hesaplanan tutar + eşit paylaştırılan tesisat maliyeti.',
  '2026-11-01',
  'Su / ASKİ'
)
on conflict (slug) do nothing;

insert into public.special_charge_items (charge_id, apartment_no, amount_due)
select c.id,
       a.apartment_no,
       case
         when a.apartment_no in ('F-1', 'F-2') then 13305
         when a.apartment_no like 'F-%'        then 14025
         else 14850
       end
from public.special_charges c
cross join (select distinct apartment_no from public.apartment_settings) a
where c.slug = 'aski-2026'
on conflict (charge_id, apartment_no) do nothing;
