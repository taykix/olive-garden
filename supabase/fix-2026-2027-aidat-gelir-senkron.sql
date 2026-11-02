-- ─── 2026-2027: Aidat tablosunu Gelirler'e (deftere) eşitle ──────────────────
-- Neden: Eski sürümde Gelirler'de bir aidat geliri düzenlenince aidat tablosu
-- güncellenmiyordu. Bu yüzden bağlı kayıtlar arasında tutar/tarih farkları oluştu.
-- Defter = Gelirler esas alınır. Supabase → SQL Editor'da BİR KEZ çalıştırın.
--
-- Düzeltilecek 5 kayıt (02.11.2026 itibarıyla):
--   F-1  Eylül  (Defter 194)  tutar  10.000 → 5.000
--   F-3  Eylül  (Defter 195)  tutar   5.000 → 10.000
--   D-1  Eylül  (Defter 182)  tarih  02.09  → 25.08
--   B-4  Eylül  (Defter 183)  tarih  06.09  → 05.09
--   B-5  Ağustos(Defter 223)  tarih  01.08  → 03.08
--
-- Her satır yalnızca beklenen eski değerdeyse güncellenir; tekrar çalıştırmak zararsızdır.

begin;

update public.payments set amount_paid = 5000
 where id = '94c50927-45d2-44f9-8f28-e1f14efa01b0' and apartment_no = 'F-1' and amount_paid = 10000;

update public.payments set amount_paid = 10000
 where id = 'da4ec9d4-f4d6-467f-8f08-1711c9c69ee8' and apartment_no = 'F-3' and amount_paid = 5000;

-- Tarih farkları: bağlı gelirin tarihi ödemeye yazılır
update public.payments p set payment_date = i.date
  from public.income i
 where i.id = p.income_id
   and p.period_id = 'p2026-2027'
   and p.apartment_no in ('D-1', 'B-4', 'B-5')
   and p.payment_date is distinct from i.date;

-- Kontrol: bu dönemde bağlı kayıtlar arasında hiçbir fark kalmamalı (0 satır dönmeli)
select p.apartment_no, p.month, p.amount_paid, i.amount, p.payment_date, i.date
  from public.payments p join public.income i on i.id = p.income_id
 where p.period_id = 'p2026-2027'
   and (abs(p.amount_paid - i.amount) > 0.009 or p.payment_date is distinct from i.date);

commit;
