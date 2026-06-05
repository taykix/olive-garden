-- Duyurulara İngilizce ve Almanca çeviri alanları eklendi
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS title_en   text,
  ADD COLUMN IF NOT EXISTS content_en text,
  ADD COLUMN IF NOT EXISTS title_de   text,
  ADD COLUMN IF NOT EXISTS content_de text;
