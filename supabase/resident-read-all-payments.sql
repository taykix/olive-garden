-- Saydamlık ilkesi gereği tüm giriş yapmış kullanıcılar (sakin ve admin)
-- tüm dairelerin ödeme ve aidat ayarlarını okuyabilir.
-- Admin sayfaları layout koruması ile zaten ayrışıyor.

CREATE POLICY "payments: authenticated read all"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "apartment_settings: authenticated read all"
  ON public.apartment_settings FOR SELECT
  TO authenticated
  USING (true);
