#!/usr/bin/env bash
# Ana sayfa arka plan videosunu web için hazırlar.
#
#   scripts/process-hero-video.sh <girdi-video> [başlangıç-sn] [süre-sn]
#
# Çıktılar (public/videos/):
#   hero.mp4         H.264, sessiz, 1280 px genişlik, hızlı başlatma (faststart)
#   hero-poster.jpg  ilk kare — video yüklenene kadar / hareket azaltıldığında gösterilir
#
# WebM/VP9 üretilmiyor: bu videoda MP4'ten büyük ve daha düşük kaliteli çıktı.
# Girdi döngü için hazır olmalı (sonu başına yumuşak geçişli; bkz. docs/hero-video/README.md).
#
# Dikey (Instagram reel, 9:16) videolarda kırpma yapılmaz; sayfa object-cover ile
# ekrana sığdırır. Yatay ekranda dikey videonun ortası görünür.
set -euo pipefail

IN="${1:?Kullanım: $0 <girdi-video> [başlangıç-sn] [süre-sn]}"
START="${2:-0}"
DUR="${3:-}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/videos"
mkdir -p "$OUT"

TRIM=(-ss "$START")
[[ -n "$DUR" ]] && TRIM+=(-t "$DUR")

# Uzun kenar en fazla 1280 px, kenarlar çift sayı (H.264 gereği).
# Kare hızı kaynağınki kalır (en fazla 30); 24 fps'yi 30'a çevirmek takılma yapar.
VF="scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',format=yuv420p"

ffmpeg -y -hide_banner -loglevel error "${TRIM[@]}" -i "$IN" -an -vf "$VF" -fpsmax 30 \
  -c:v libx264 -preset slow -crf 27 -profile:v high -movflags +faststart "$OUT/hero.mp4"

ffmpeg -y -hide_banner -loglevel error -i "$OUT/hero.mp4" -frames:v 1 -q:v 4 "$OUT/hero-poster.jpg"

ls -lh "$OUT"/hero.mp4 "$OUT"/hero-poster.jpg
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of default=nw=1 "$OUT/hero.mp4"
