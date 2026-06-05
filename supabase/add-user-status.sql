-- Kullanıcı durumu, email ve son giriş için profiles tablosunu genişlet
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

-- Mevcut tüm kullanıcıları onaylı yap
UPDATE public.profiles SET status = 'approved';
