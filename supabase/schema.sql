-- Olive Garden 2 Site Yönetimi - Database Schema
-- Run this in Supabase SQL Editor

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  role        text not null default 'resident' check (role in ('admin', 'resident')),
  apartment_no text,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'resident')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── income ──────────────────────────────────────────────────────────────────
create table if not exists public.income (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  title       text not null,
  description text,
  category    text,
  amount      numeric(12, 2) not null check (amount > 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── expenses ────────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  title        text not null,
  description  text,
  category     text,
  amount       numeric(12, 2) not null check (amount > 0),
  document_url text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ─── payments ────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  apartment_no   text not null,
  resident_name  text,
  month          integer not null check (month between 1 and 12),
  year           integer not null check (year >= 2000),
  amount_due     numeric(12, 2) not null check (amount_due > 0),
  amount_paid    numeric(12, 2) not null default 0 check (amount_paid >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'unpaid', 'partial')),
  payment_date   date,
  note           text,
  created_at     timestamptz not null default now()
);

-- ─── announcements ───────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null,
  published  boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
create index if not exists income_date_idx on public.income (date desc);
create index if not exists expenses_date_idx on public.expenses (date desc);
create index if not exists payments_period_idx on public.payments (year desc, month desc);
create index if not exists payments_status_idx on public.payments (payment_status);
create index if not exists announcements_published_idx on public.announcements (published, created_at desc);

-- ─── annual_works ─────────────────────────────────────────────────────────────
create table if not exists public.annual_works (
  id             uuid primary key default gen_random_uuid(),
  year           integer not null,
  title          text not null,
  description    text,
  status         text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  estimated_cost numeric(12, 2),
  actual_cost    numeric(12, 2),
  contractor     text,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists annual_works_year_idx on public.annual_works (year desc);

-- ─── apartment_settings ───────────────────────────────────────────────────────
-- Daire başına yıllık aidat bedeli ve geçen dönem bakiyesi
-- previous_balance: pozitif = geçen dönemden borç, negatif = alacak (fazla ödeme)
create table if not exists public.apartment_settings (
  apartment_no     text primary key,
  annual_due       numeric(12,2) not null default 40000 check (annual_due >= 0),
  previous_balance numeric(12,2) not null default 0,
  notes            text,
  updated_at       timestamptz not null default now()
);

create index if not exists apt_settings_apt_idx on public.apartment_settings (apartment_no);

-- ─── budget_items ─────────────────────────────────────────────────────────────
create table if not exists public.budget_items (
  id                 uuid primary key default gen_random_uuid(),
  category           text not null,
  category_en        text,
  sort_order         integer not null default 0,
  plan_2023_2024     numeric(12,2),
  actual_2023_2024   numeric(12,2),
  plan_2024_2025     numeric(12,2),
  actual_2024_2025   numeric(12,2),
  plan_2025_2026     numeric(12,2),
  expense_categories text[] not null default '{}',
  description_tr     text,
  description_en     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists budget_items_sort_idx on public.budget_items (sort_order asc);

-- Initial data — run once (skip if already populated)
insert into public.budget_items
  (sort_order, category, category_en,
   plan_2023_2024, actual_2023_2024,
   plan_2024_2025, actual_2024_2025,
   plan_2025_2026,
   expense_categories, description_tr, description_en)
values
  (1,  'KIRTASİYE VE YÖNETİM GİDERLERİ',         'ADMINISTRATIVE EXPENSES',                         12500,   14436,   19000,   12932,   18106,   ARRAY['Donanım / Malzeme','Banka Masrafları'],         'Planlanan tutarlar, bir önceki dönemin gerçekleşen tutarına %40 enflasyon oranı eklenerek belirlenmiştir.', 'The planned amounts were determined by adding a 40% inflation rate to the previous period''s actual amounts.'),
  (2,  'PERSONEL GİDERLERİ',                       'EMPLOYEE EXPENSES',                               250000,  239500,  360000,  366140,  637710,  ARRAY['Personel Maaşı'],                              'Çalışanın 10 aylık maliyeti, 45.000 TL maaş ve 18.771 TL SGK/damga vergisinden oluşmaktadır.',             'The employee''s 10-month cost consists of a 45,000 TL salary and 18,771 TL for SGK and stamp tax.'),
  (3,  'KIDEM TAZMİNATI FONU',                     'SEVERANCE PAY',                                   68000,   55000,   25000,   20003,   45000,   ARRAY['SGK'],                                         NULL, NULL),
  (4,  'BAKIM ONARIM VE TEMİZLİK GİDERLERİ',      'MAINTENANCE REPAIR AND CLEANING EXPENSES',        50000,   92876,   130000,  95994,   134392,  ARRAY['Genel Bakım','Boya / Tadilat'],                 '2025-2026 dönemi için %40 enflasyon oranı eklenmiştir.', NULL),
  (5,  'BAHÇE BAKIM GİDERLERİ',                    'GARDEN EXPENSES',                                 40000,   31333,   50000,   57420,   80390,   ARRAY['Bahçe / Tarım'],                               NULL, NULL),
  (6,  'HAVUZ KİMYASALLARI VE GİDERLERİ',         'POOL CHEMICALS AND EXPENSES',                     77500,   96958,   135000,  102600,  143640,  ARRAY['Havuz Bakımı'],                                NULL, NULL),
  (7,  'ELEKTRİK GİDERLERİ',                      'ELECTRIC EXPENSES',                               70000,   54000,   85000,   87675,   122745,  ARRAY['Elektrik'],                                    NULL, NULL),
  (8,  'DEMİRBAŞ MALZEME ALIMLARI',                'FIXED ASSET PURCHASES',                           15000,   9225,    15000,   0,       50000,   ARRAY['Donanım / Malzeme'],                           'Havuz pompası, dalgıç pompası ve çim biçme makinası; hasar tespiti sonrasında yenileme/onarım yapılacaktır.', 'Pool pump, submersible pump and lawnmower will be replaced or repaired after damage assessment.'),
  (9,  'HAVUZ KORKULUKLARI ONARIMI',               'POOL RAILING REPAIR',                             20000,   0,       0,       108000,  0,       ARRAY['Demir / Metal İşleri'],                        NULL, NULL),
  (10, 'ÇATI ONARIMI',                             'ROOF REPAIR',                                     10000,   45500,   20000,   76750,   0,       ARRAY['Genel Bakım'],                                 NULL, NULL),
  (11, 'DENGE DEPOSU SU KAÇAĞI ONARIMI',           'BALANCE TANK WATER LEAK REPAIR',                  45000,   118000,  0,       0,       0,       ARRAY['Kanalizasyon'],                                NULL, NULL),
  (12, 'E BLOK TEMEL DRENAJI TADİLATI',            'E BLOC WATER DRAINAGE CONSTRUCTION',              50000,   35000,   0,       0,       0,       ARRAY['Kanalizasyon'],                                NULL, NULL),
  (13, 'HAVUZ FİLTRESİ DEĞİŞİMİ',                 'POOL FILTER CHANGE',                              22500,   0,       25000,   0,       0,       ARRAY['Havuz Bakımı'],                                NULL, NULL),
  (14, 'ÖDENMEMİŞ SGK BORCU 4 AYLIK',             'UNPAID PREMIUM DEBT',                             NULL,    25600,   25600,   29302,   0,       ARRAY['SGK'],                                         NULL, NULL),
  (15, 'ÖNGÖRÜLMEYEN GİDERLER',                   'UNFORESEEN EXPENSES',                             NULL,    41000,   91000,   71500,   100100,  ARRAY['Diğer'],                                       'Demir aksam onarımı, drenaj ve bakım masrafları çıkarılarak belirlenmiştir.', 'Determined by subtracting ironwork, drainage and maintenance costs.'),
  (16, 'C-D BLOK DEMİR AKSAM ONARIMLARI',         'C-D BLOCK IRONWORK REPAIRS',                      0,       0,       0,       70000,   0,       ARRAY['Demir / Metal İşleri'],                        NULL, NULL),
  (17, 'C-D BLOK DRENAJ İŞİ',                     'C-D BLOCK DRAINAGE WORK',                         0,       0,       0,       260000,  0,       ARRAY['Kanalizasyon'],                                NULL, NULL),
  (18, 'A-B-E-F BLOK DEMİR AKSAM ONARIMLARI',     'A-B-E-F BLOCK IRONWORK REPAIRS',                  NULL,    NULL,    NULL,    0,       196000,  ARRAY['Demir / Metal İşleri'],                        'Geçen yıl 2 blok onarımı maliyeti ve %40 enflasyon esas alınarak hesaplanmıştır.', 'Estimated based on the cost of last year''s 2-block repair and 40% inflation rate.'),
  (19, 'ESKİ ÇALIŞAN PERSONELE İKİ MAAŞ YARDIM', 'ASSISTANCE OF TWO SALARIES TO FORMER EMPLOYEE',   NULL,    NULL,    NULL,    NULL,    50000,   ARRAY['Personel Maaşı'],                              NULL, NULL),
  (20, 'ÇOCUK PARKI TADİLATI',                    'CHILDREN''S PLAYGROUND RENOVATION',               NULL,    NULL,    NULL,    NULL,    50000,   ARRAY['Genel Bakım'],                                 'Mevcut ekipmanların bakım/onarımı ve güvenlik standartlarına uygun hale getirilmesi.', 'Maintenance and repair of existing equipment to meet safety standards.'),
  (21, 'HAVUZ AÇILIŞ MASRAF BÖLÜMÜ',              'SWIMMING POOL OPENING EXPENSE SECTION',           NULL,    NULL,    NULL,    NULL,    10000,   ARRAY['Diğer'],                                       'Havuz sezonu başında sosyal etkinlik bütçesi.', 'Social event budget for the beginning of the pool season.');
