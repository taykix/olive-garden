-- ─── Düzeltme: Ağustos 2026 ödemeleri yeni döneme aittir ──────────────────────
-- Yeni yönetim dönemi 1 Ağustos 2026'da başlar. İlk migration mevcut TÜM ödemeleri
-- eski döneme (p2025-2026) etiketlemişti; oysa Ağustos 2026 ve sonrası yeni döneme
-- (p2026-2027) aittir. Bu betik onları düzeltir ve yeni dönem ayarlarını yeniden
-- tohumlanmak üzere temizler (devir bakiyeleri doğru paid toplamıyla yeniden hesaplanır).
--
-- Supabase → SQL Editor'da BİR KEZ çalıştırın, sonra uygulamada
-- "Yeni Dönemi Başlat" butonuna tekrar basın.

-- 1) Ağustos 2026 ve sonrası ödemeleri yeni döneme taşı.
update public.payments
set period_id = 'p2026-2027'
where (year = 2026 and month >= 8) or year >= 2027;

-- 2) Hatalı devir bakiyeleriyle oluşturulmuş yeni dönem aidat ayarlarını sil.
--    (Ağustos ödemeleri yanlışlıkla eski döneme sayıldığı için devir tutarları eksikti.)
--    Silindikten sonra "Yeni Dönemi Başlat" yeniden oluşturacak — DOĞRU tutarlarla.
delete from public.apartment_settings where period_id = 'p2026-2027';
