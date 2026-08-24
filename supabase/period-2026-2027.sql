-- ─── 2026-2027 dönemine geçiş ─────────────────────────────────────────────────
-- apartment_settings tablosuna "dönem" boyutu ekler. Böylece her dönemin
-- daire-daire aidat/bakiye ayarları AYRI saklanır ve eski dönem arşiv olarak korunur.
--
-- Bu dosyayı Supabase → SQL Editor'da BİR KEZ çalıştırın. Yıkıcı değildir:
-- yalnızca sütun ekler ve mevcut satırları eski döneme (p2025-2026) etiketler.

-- 1) period_id sütununu ekle. Geçici default ile mevcut TÜM satırlar eski döneme
--    (p2025-2026) etiketlenir.
alter table public.apartment_settings
  add column if not exists period_id text not null default 'p2025-2026';

-- 2) Birincil anahtarı (apartment_no) → (apartment_no, period_id) yap.
--    Böylece aynı daire için birden fazla döneme ait ayar tutulabilir.
alter table public.apartment_settings
  drop constraint if exists apartment_settings_pkey;
alter table public.apartment_settings
  add constraint apartment_settings_pkey primary key (apartment_no, period_id);

-- 3) Geçici default'u kaldır — bundan sonra her yazma işlemi dönemi AÇIKÇA belirtmeli
--    (uygulama bunu otomatik gönderir; yanlış döneme sessiz kayıt önlenir).
alter table public.apartment_settings
  alter column period_id drop default;

-- 4) Dönem bazlı sorgular için indeks.
create index if not exists apt_settings_period_idx
  on public.apartment_settings (period_id);

-- 5) payments tablosuna da dönem boyutu ekle. Dönemlerin ayları çakışabildiğinden
--    (örn. Ağustos 2026 hem eski dönemin son ayı hem yeni dönemin ilk ayı),
--    dönem ayrımı ay aralığına göre DEĞİL, açık period_id'ye göre yapılır.
alter table public.payments
  add column if not exists period_id text not null default 'p2025-2026';
--    Mevcut tüm ödemeler eski döneme (p2025-2026) etiketlenir. Yeni ödemeler
--    uygulama tarafından aktif dönemle etiketlenir; geçici default'u kaldırıyoruz.
alter table public.payments
  alter column period_id drop default;

create index if not exists payments_period_id_idx on public.payments (period_id);
