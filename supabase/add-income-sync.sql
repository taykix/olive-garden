-- Aidat/Ödeme senkronizasyonu için gerekli kolon eklemeleri

-- income tablosuna daire numarası kolonu (aidat kayıtlarının hangi daireye ait olduğunu bilmek için)
ALTER TABLE income ADD COLUMN IF NOT EXISTS apartment_no varchar;

-- payments tablosuna income bağlantısı (ON DELETE CASCADE: income silinince payment da silinir)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS income_id uuid REFERENCES income(id) ON DELETE CASCADE;

-- payments tablosuna defter sıra numarası
ALTER TABLE payments ADD COLUMN IF NOT EXISTS serial_no varchar;
