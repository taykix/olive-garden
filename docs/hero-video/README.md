# Ana sayfa arka plan videosu — devam notu

Bu not, bir önceki oturumda yarım kalan işi yeni oturumun sürdürebilmesi için yazıldı.

## Hedef

Ana sayfanın tam ekran üst bölümünde (hero) sessiz, döngülü, 16:9 bir drone videosu.
Kaynak: site sakininin kendi drone çekimi (Instagram reel `CyRAZERMGVP`), kullanım izni alındı.
Kaynak dikey ve düşük çözünürlüklü (480×854) olduğu için video Seedance ile yatay olarak yeniden üretiliyor.

## Şu ana kadar yapılanlar

- `src/components/shared/hero-video.tsx` ve `src/app/[locale]/page.tsx`: video arka plan altyapısı hazır
  (`/videos/hero.mp4`, `/videos/hero-poster.jpg`; yoksa fotoğraf görünür).
- `scripts/process-hero-video.sh`: üretilen videoyu web için sıkıştırır (sessiz, MP4 + WebM + kapak → `public/videos/`).
- Bu altyapı yalnızca `claude/tender-rubin-qx7qlk` dalında; video eklenmeden main'e alınmayacak.
- İlk Seedance denemesi (ModelArk Playground, 2.5, 480p) başarısız oldu: 3,7 ve 8. saniyelerde keskin kesmeler,
  havuza geri dönüş yok, sağ altta "AI generated" damgası. Damga kırpma/bulanıklaştırma ile **silinmeyecek**;
  çözüm API'den `watermark: false` ile üretmek (sağlayıcının kendi seçeneği).

## Güncel durum (döngü denemesi)

- Yeni referans: `refs/og_drone_15s.mp4` (kullanıcının yüklediği, ilk ve son karesi neredeyse aynı → doğal döngü).
  API video referansını yalnızca web URL olarak kabul ediyor (base64 → 400); kullanıcı Drive'a herkese açık yükledi:
  `https://drive.usercontent.google.com/download?id=1pSK2hi3kzGn_A9IzUjVz8ADq8hG-wTKU&export=download`
- Görsel referanslar: `og_loop_s1_start_end.jpg` (0 sn = son kare), `og_loop_s2_high.jpg` (6 sn), `og_loop_s3_sea.jpg` (11,5 sn).
- API'de ilk/son kare modu referans video ile birlikte kullanılamıyor; döngü prompt ile (son kare = [Image 1])
  ve sonradan sonu-başı yumuşak geçişle kuruluyor.
- Model kimliği: `dreamina-seedance-2-5-260628`. Prompt'ta referanslar `[Video 1]`, `[Image 1]`… olarak yazıldı.

## Sonuç (3 Kasım 2026)

- 480p deneme `cgt-20261103231101-b5b3e` (seed 35579): kesme yok, damga yok, kullanıcı onayladı.
- 1080p `cgt-20261103231714-z28yb` (aynı seed, ~1,46 M token ≈ 9,3–10,2 USD): kesme yok, damga yok.
  Son kare ilk kareye yakın ama biraz kaymış; döngü için ilk 1 sn son 1 sn'nin üstüne bindirildi (xfade, 14,04 sn):
  `ffmpeg -i hero_1080p.mp4 -filter_complex "[0]split[x][y];[x]trim=start=1,setpts=PTS-STARTPTS[a];[y]trim=end=1,setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=1:offset=13.041667,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -crf 12 hero_1080p_loop.mp4`
- `scripts/process-hero-video.sh hero_1080p_loop.mp4` → `public/videos/hero.mp4` (1280×720, 24 fps, 2,8 MB) + kapak.
- `src/proxy.ts` eşleyicisi `.mp4/.webm` dosyalarını dil yönlendirmesinden hariç tutuyor (yoksa video 404 dönüyordu).

## Yeni oturumda yapılacaklar (ilk oturumun planı — tamamlandı)

1. `ARK_API_KEY` ortam değişkeninin var olduğunu kontrol et (değerini yazdırma).
   API adresi: `https://ark.ap-southeast.bytepluses.com/api/v3` (ağ erişimi açık; anahtarsız istek 401 döner).
2. Referanslar hazır: `docs/hero-video/refs/` (sitede yayınlanmaz, `public/` dışında).
   - `og_orbit_sea_15s.mp4` → video referansı (havuzdan yükselip denize dönen kesintisiz uçuş, 15 sn, 480×854)
   - `og_s1_start.jpg`, `og_s2_high.jpg`, `og_s3_sea.jpg`, `og_s4_end.jpg` → görsel referanslar (sırasıyla image1–4)
   - Instagram ağ erişimi kapalı; `build-refs.sh` yalnızca erişim açılırsa ve referanslar yeniden üretilecekse kullanılır.
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
