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
