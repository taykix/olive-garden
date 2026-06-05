-- Olive Garden 2 - Row Level Security Policies
-- Run this AFTER schema.sql in Supabase SQL Editor

-- Helper function: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─── profiles ────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles: users can read own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "profiles: admins can read all"
  on public.profiles for select
  using (public.is_admin());

-- Users can update their own profile (limited fields)
create policy "profiles: users can update own"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── income ──────────────────────────────────────────────────────────────────
alter table public.income enable row level security;

-- Anyone authenticated can read income (public financial transparency)
create policy "income: authenticated can read"
  on public.income for select
  to authenticated
  using (true);

-- Only admins can insert/update/delete
create policy "income: admins can insert"
  on public.income for insert
  to authenticated
  with check (public.is_admin());

create policy "income: admins can update"
  on public.income for update
  to authenticated
  using (public.is_admin());

create policy "income: admins can delete"
  on public.income for delete
  to authenticated
  using (public.is_admin());

-- ─── expenses ────────────────────────────────────────────────────────────────
alter table public.expenses enable row level security;

create policy "expenses: authenticated can read"
  on public.expenses for select
  to authenticated
  using (true);

create policy "expenses: admins can insert"
  on public.expenses for insert
  to authenticated
  with check (public.is_admin());

create policy "expenses: admins can update"
  on public.expenses for update
  to authenticated
  using (public.is_admin());

create policy "expenses: admins can delete"
  on public.expenses for delete
  to authenticated
  using (public.is_admin());

-- ─── payments ────────────────────────────────────────────────────────────────
alter table public.payments enable row level security;

-- Only admins can read payment records (contains personal resident info)
create policy "payments: admins can read"
  on public.payments for select
  to authenticated
  using (public.is_admin());

create policy "payments: admins can insert"
  on public.payments for insert
  to authenticated
  with check (public.is_admin());

create policy "payments: admins can update"
  on public.payments for update
  to authenticated
  using (public.is_admin());

create policy "payments: admins can delete"
  on public.payments for delete
  to authenticated
  using (public.is_admin());

-- ─── announcements ───────────────────────────────────────────────────────────
alter table public.announcements enable row level security;

-- Authenticated users can read published announcements
create policy "announcements: authenticated can read published"
  on public.announcements for select
  to authenticated
  using (published = true);

-- Admins can read all (including drafts)
create policy "announcements: admins can read all"
  on public.announcements for select
  to authenticated
  using (public.is_admin());

-- Unauthenticated users can also read published announcements (for public page)
create policy "announcements: public can read published"
  on public.announcements for select
  to anon
  using (published = true);

create policy "announcements: admins can insert"
  on public.announcements for insert
  to authenticated
  with check (public.is_admin());

create policy "announcements: admins can update"
  on public.announcements for update
  to authenticated
  using (public.is_admin());

create policy "announcements: admins can delete"
  on public.announcements for delete
  to authenticated
  using (public.is_admin());

-- ─── Public read for income/expenses (for home page) ─────────────────────────
-- Allow anon read of aggregate data for public home page
create policy "income: anon can read"
  on public.income for select
  to anon
  using (true);

create policy "expenses: anon can read"
  on public.expenses for select
  to anon
  using (true);

-- ─── annual_works ─────────────────────────────────────────────────────────────
alter table public.annual_works enable row level security;

create policy "annual_works: authenticated can read"
  on public.annual_works for select
  to authenticated
  using (true);

create policy "annual_works: anon can read"
  on public.annual_works for select
  to anon
  using (true);

create policy "annual_works: admins can insert"
  on public.annual_works for insert
  to authenticated
  with check (public.is_admin());

create policy "annual_works: admins can update"
  on public.annual_works for update
  to authenticated
  using (public.is_admin());

create policy "annual_works: admins can delete"
  on public.annual_works for delete
  to authenticated
  using (public.is_admin());

-- ─── apartment_settings ───────────────────────────────────────────────────────
alter table public.apartment_settings enable row level security;

create policy "apartment_settings: admins all"
  on public.apartment_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Sakinler kendi dairelerinin ayarlarını okuyabilir (yıllık aidat, geçen dönem)
create policy "apartment_settings: residents read own"
  on public.apartment_settings for select
  to authenticated
  using (
    apartment_no = (select apartment_no from profiles where id = auth.uid())
  );

-- ─── payments: sakinler kendi dairelerini okuyabilir ──────────────────────────
create policy "payments: residents read own"
  on public.payments for select
  to authenticated
  using (
    apartment_no = (select apartment_no from profiles where id = auth.uid())
  );
