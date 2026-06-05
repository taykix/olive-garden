-- Geri ödeme / fazla aidat iadelerini kayıt altına alabilmek için
-- amount_paid >= 0 kısıtlaması kaldırılıyor.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_paid_check;
