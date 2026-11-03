-- ─── B-3'te yanlış görünen isim (Taylan Karakaya) ────────────────────────────
-- Yönetici Ek Ödemeler sayfasındaki "Sakin" sütunu, daire no atanmış profillerden
-- okunuyordu. Taylan Karakaya profiline yanlışlıkla 'B-3' atanmış. B-3 sakini: Güler Aydoğan.
-- Supabase → SQL Editor'da çalıştırın.

-- 1) Önce kontrol: B-3'e atanmış profiller
select id, full_name, email, role, status, apartment_no
  from public.profiles
 where apartment_no = 'B-3';

-- 2) Taylan Karakaya profilinden daire no'yu kaldır (yalnızca B-3 ise)
update public.profiles
   set apartment_no = null
 where apartment_no = 'B-3'
   and full_name ilike '%taylan%karakaya%';

-- 3) Tekrar kontrol: B-3'te Taylan Karakaya kalmamalı
select id, full_name, role, apartment_no
  from public.profiles
 where apartment_no = 'B-3';
