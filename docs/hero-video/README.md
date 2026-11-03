# Ana sayfa arka plan videosu — devam notu

Bu not, bir önceki oturumda yarım kalan işi yeni oturumun sürdürebilmesi için yazıldı.

## Hedef

Ana sayfanın tam ekran üst bölümünde (hero) sessiz, döngülü, 16:9 bir drone videosu.
Kaynak: site sakininin kendi drone çekimi (Instagram reel `CyRAZERMGVP`), kullanım izni alındı.
Kaynak dikey ve düşük çözünürlüklü (480×854) olduğu için video Seedance ile yatay olarak yeniden üretiliyor.

## Şu ana kadar yapılanlar

- `src/components/shared/hero-video.tsx` ve `src/app/[locale]/page.tsx`: video arka plan altyapısı hazır
  (`/videos/hero.webm`, `/videos/hero.mp4`, `/videos/hero-poster.jpg` dosyalarını bekliyor; yoksa fotoğraf görünür).
- `scripts/process-hero-video.sh`: üretilen videoyu web için sıkıştırır (sessiz, MP4 + WebM + kapak → `public/videos/`).
- Bu altyapı yalnızca `claude/tender-rubin-qx7qlk` dalında; video eklenmeden main'e alınmayacak.
- İlk Seedance denemesi (ModelArk Playground, 2.5, 480p) başarısız oldu: 3,7 ve 8. saniyelerde keskin kesmeler,
  havuza geri dönüş yok, sağ altta "AI generated" damgası. Damga kırpma/bulanıklaştırma ile **silinmeyecek**;
  çözüm API'den `watermark: false` ile üretmek (sağlayıcının kendi seçeneği).

## Yeni oturumda yapılacaklar

1. `ARK_API_KEY` ortam değişkeninin var olduğunu kontrol et (değerini yazdırma).
   API adresi: `https://ark.ap-southeast.bytepluses.com/api/v3` (ağ erişimi açık; anahtarsız istek 401 döner).
2. Referansları üret: `docs/hero-video/build-refs.sh <scratchpad>/refs`
   - `og_orbit_sea_15s.mp4` → video referansı (havuzdan yükselip denize dönen kesintisiz uçuş, 15 sn)
   - `og_s1_start.jpg`, `og_s2_high.jpg`, `og_s3_sea.jpg`, `og_s4_end.jpg` → görsel referanslar (sırasıyla image1–4)
3. Seedance video üretim görevini API ile oluştur: `POST /contents/generations/tasks`, sonra görevi sorgula ve videoyu indir.
   - Model: Seedance 2.5 (konsolda görünen model kimliğini kullan; kullanıcının hesabında etkin olan "Dreamina-Seedance-2.5").
   - Ayarlar: 16:9, **480p** (ilk deneme), 15 sn, sessiz, 1 adet, **`watermark: false`**.
   - Prompt: `docs/hero-video/prompt.txt`. Referans adları (`@video1`, `@image1`–`@image4`) Playground'a göre yazıldı;
     API referansları farklı adlandırıyorsa prompt'u ona göre uyarla.
   - Görseller base64 ile gönderilebilir. API video referansı için herkese açık URL isterse,
     **kullanıcıya sormadan** videoyu hiçbir yere yükleme.
   - İstek alanlarının adlarını (ör. `watermark`, çözünürlük, süre, oran) BytePlus ModelArk belgelerinden doğrula;
     bunlar üçüncü taraf entegrasyon belgelerinden çıkarıldı.
4. Sonucu kontrol et: keskin kesme var mı (`ffmpeg -vf "select='gt(scene,0.2)',showinfo"`), damga var mı,
   havuzun şekli doğru mu, deniz görünüyor mu. Kareleri kullanıcıya gönder.
5. Kullanıcı onaylarsa 1080p üret, sonu ile başı arasına yumuşak geçiş ekleyerek döngü kur,
   `scripts/process-hero-video.sh` ile işle, ana sayfada kontrol et, main'e al ve Vercel yayınını doğrula.

## Maliyet (ModelArk fiyat tablosu, video referanslı)

- Seedance 2.5: 0,0064–0,0070 USD / 1.000 token. 480p 15 sn ≈ 288.000 token ≈ 1,85 USD.
- 1080p yaklaşık 5 katı (tahmin).
