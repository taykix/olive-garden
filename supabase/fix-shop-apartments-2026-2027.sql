-- ─── 2026-2027 dükkan/daire aidat düzeltmesi ──────────────────────────────────
-- Dükkanlar F-1 ve F-2'dir (yarım aidat: 25.000 ₺). F-3 ve F-4 dairedir (tam aidat: 50.000 ₺).
-- "Yeni Dönemi Başlat" daha önce yanlışlıkla F-2/F-3'ü dükkan saymıştı.
-- Supabase → SQL Editor'da BİR KEZ çalıştırın. Yalnızca 2026-2027 dönemini etkiler.

update public.apartment_settings
   set annual_due = 25000, updated_at = now()
 where period_id = 'p2026-2027' and apartment_no in ('F-1', 'F-2');

update public.apartment_settings
   set annual_due = 50000, updated_at = now()
 where period_id = 'p2026-2027' and apartment_no in ('F-3', 'F-4');
