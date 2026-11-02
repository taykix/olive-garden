-- ─── Aidat tablosu ↔ Gelirler tanı sorgusu (SALT OKUNUR — hiçbir şeyi değiştirmez) ───
-- Supabase → SQL Editor'da çalıştırın. Tek bir tablo döner; her satır bir uyumsuzluktur.
-- İlk satırlar (sorun = '0_satir_sayisi') 1000 satır sınırını kontrol eder: herhangi biri
-- 1000'i aşıyorsa eski sayfalar listeleri/toplamları SESSİZCE kesiyordu.
--
-- Dönemi değiştirmek için aşağıdaki 'p2026-2027' değerini 'p2025-2026' yapın.

with params as (select 'p2026-2027'::text as period_id),
p as (
  select pay.* from payments pay, params where pay.period_id = params.period_id
),
linked as (
  select p.id as payment_id, p.apartment_no, p.month, p.year, p.amount_paid, p.payment_date,
         i.id as income_id, i.amount, i.date as income_date, i.category, i.apartment_no as income_apt, i.title
  from p join income i on i.id = p.income_id
)
select * from (
  select '0_satir_sayisi' as sorun, null as daire,
         'payments (bu dönem): ' || (select count(*) from p)
         || ' · income (tümü): ' || (select count(*) from income)
         || ' · expenses (tümü): ' || (select count(*) from expenses) as detay,
         null::numeric as aidat_tutar, null::numeric as gelir_tutar, null::uuid as payment_id, null::uuid as income_id

  union all
  select '1_tutar_farkli', apartment_no,
         month || '/' || year || ' · gelir: ' || title,
         amount_paid, amount, payment_id, income_id
  from linked where abs(amount - amount_paid) > 0.009

  union all
  select '2_gelir_kaydi_yok', apartment_no,
         month || '/' || year || coalesce(' · ' || note, ''),
         amount_paid, null, id, null
  from p where income_id is null and abs(amount_paid) > 0.009

  union all
  select '3_bagli_gelir_silinmis', apartment_no,
         month || '/' || year, amount_paid, null, id, income_id
  from p where income_id is not null and not exists (select 1 from income i where i.id = p.income_id)

  union all
  select '4_kategori_degismis', apartment_no,
         month || '/' || year || ' · kategori: ' || coalesce(category, '(boş)'),
         amount_paid, amount, payment_id, income_id
  from linked where lower(coalesce(category, '')) <> 'aidat'

  union all
  select '5_daire_farkli', apartment_no,
         'gelirdeki daire: ' || income_apt,
         amount_paid, amount, payment_id, income_id
  from linked where income_apt is not null and income_apt <> apartment_no

  union all
  select '6_tarih_farkli', apartment_no,
         'ödeme: ' || payment_date || ' · gelir: ' || income_date,
         amount_paid, amount, payment_id, income_id
  from linked where payment_date is not null and payment_date <> income_date

  union all
  select '7_odemesiz_aidat_geliri', i.apartment_no,
         i.date || ' · ' || i.title,
         null, i.amount, null, i.id
  from income i
  where lower(coalesce(i.category, '')) = 'aidat'
    and not exists (select 1 from payments x where x.income_id = i.id)
) r
order by sorun, daire nulls first;
