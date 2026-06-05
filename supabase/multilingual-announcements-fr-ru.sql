-- Duyurulara Fransızca ve Rusça çeviri alanları eklendi
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS title_fr   text,
  ADD COLUMN IF NOT EXISTS content_fr text,
  ADD COLUMN IF NOT EXISTS title_ru   text,
  ADD COLUMN IF NOT EXISTS content_ru text;
