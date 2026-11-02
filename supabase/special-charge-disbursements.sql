-- ─── Ek Ödemeler: kuruma yapılan ödemeler (ör. ASKİ'ye) + dekontlar ──────────
-- Sakinlerden toplanan ek ödemenin kuruma (ASKİ) nasıl ödendiğini dekontlarıyla
-- birlikte saydam biçimde gösterir. Aidat ve Gelirler/Giderler tutarları ETKİLENMEZ;
-- gider kaydı varsa expense_id ile yalnızca referans verilir.
--
-- Supabase → SQL Editor'da BİR KEZ çalıştırın. Tekrar çalıştırmak güvenlidir.
-- Önkoşul: supabase/special-charges.sql daha önce çalıştırılmış olmalı.

-- 1) Çok dilli başlık/açıklama (boşsa Türkçe gösterilir)
alter table public.special_charges add column if not exists title_i18n jsonb;
alter table public.special_charges add column if not exists description_i18n jsonb;

-- 2) Kuruma yapılan ödemeler
create table if not exists public.special_charge_disbursements (
  id            uuid primary key default gen_random_uuid(),
  charge_id     uuid not null references public.special_charges(id) on delete cascade,
  date          date not null,
  title         text not null,                       -- Türkçe açıklama (dekonttaki)
  title_i18n    jsonb,                               -- {"en": "...", "de": "...", ...}
  recipient     text,                                -- alıcı (ör. ASKİ)
  amount        numeric(12,2) not null check (amount > 0),   -- kuruma geçen tutar
  fee           numeric(12,2) not null default 0 check (fee >= 0), -- banka masrafı (komisyon + BSMV)
  reference     text,                                -- dekont/işlem no
  receipt_path  text,                                -- 'documents' bucket içindeki yol
  receipt_name  text,
  expense_id    uuid references public.expenses(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (charge_id, reference)
);

create index if not exists special_charge_disbursements_charge_idx
  on public.special_charge_disbursements (charge_id, date);

-- RLS: saydamlık — giriş yapan herkes okur, yalnızca yönetici yazar
alter table public.special_charge_disbursements enable row level security;

drop policy if exists "special_charge_disbursements: authenticated read" on public.special_charge_disbursements;
create policy "special_charge_disbursements: authenticated read"
  on public.special_charge_disbursements for select to authenticated using (true);
drop policy if exists "special_charge_disbursements: admins all" on public.special_charge_disbursements;
create policy "special_charge_disbursements: admins all"
  on public.special_charge_disbursements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3) ASKİ başlığının çevirileri
update public.special_charges set
  title_i18n = '{"en": "ASKİ Sewer Connection", "de": "ASKİ-Kanalanschluss", "fr": "Raccordement aux égouts ASKİ", "ru": "Подключение к канализации ASKİ"}'::jsonb,
  description_i18n = '{"en": "Per-unit amount based on the official ASKİ tariff plus an equal share of the installation cost.", "de": "Betrag je Einheit nach dem offiziellen ASKİ-Tarif zuzüglich eines gleichen Anteils an den Installationskosten.", "fr": "Montant par logement selon le tarif officiel ASKİ, plus une part égale du coût d''installation.", "ru": "Сумма на каждую единицу по официальному тарифу ASKİ плюс равная доля стоимости монтажа."}'::jsonb
where slug = 'aski-2026' and title_i18n is null;

-- 4) 02.11.2026 tarihli iki Akbank EFT dekontu (alıcı: Aydın Su ve Kanalizasyon İdaresi)
--    Gider kaydı: "Aski Kanalizasyon Altyapı ve Bağlantı Ücreti" 498.626,58 ₺ (= iki tutarın toplamı)
--    Dekont dosyaları yönetici panelinden (Ek Ödemeler) yüklenir.
insert into public.special_charge_disbursements
  (charge_id, date, title, title_i18n, recipient, amount, fee, reference, expense_id)
select c.id, d.date, d.title, d.title_i18n::jsonb, 'Aydın Su ve Kanalizasyon İdaresi (ASKİ)',
       d.amount, d.fee, d.reference,
       (select id from public.expenses where id = '0b1a0657-2af7-413b-b635-d2bf7388615f')
from public.special_charges c
cross join (values
  ('2026-11-02'::date, '11051377 sicil no''lu 3674 ada 1 parsel — Altyapı Ücreti',
   '{"en": "Parcel 3674/1 (reg. no. 11051377) — Infrastructure fee", "de": "Flurstück 3674/1 (Reg.-Nr. 11051377) — Infrastrukturgebühr", "fr": "Parcelle 3674/1 (n° 11051377) — Frais d''infrastructure", "ru": "Участок 3674/1 (рег. № 11051377) — плата за инфраструктуру"}',
   255866.58, 16.76, '22020714/393103'),
  ('2026-11-02'::date, '11051377 sicil no''lu 3674 ada 1 parsel — Kanal Bağlantı Ücreti',
   '{"en": "Parcel 3674/1 (reg. no. 11051377) — Sewer connection fee", "de": "Flurstück 3674/1 (Reg.-Nr. 11051377) — Kanalanschlussgebühr", "fr": "Parcelle 3674/1 (n° 11051377) — Frais de raccordement aux égouts", "ru": "Участок 3674/1 (рег. № 11051377) — плата за подключение к канализации"}',
   242760.00, 16.76, '22020714/397263')
) as d(date, title, title_i18n, amount, fee, reference)
where c.slug = 'aski-2026'
on conflict (charge_id, reference) do nothing;
