#!/usr/bin/env bash
# Seedance referanslarını orijinal drone videosundan yeniden üretir.
# Gerekli: ffmpeg, python3 (yt-dlp geçici sanal ortama kurulur), www.instagram.com ağ erişimi.
#   docs/hero-video/build-refs.sh <çıktı-klasörü>
set -euo pipefail
OUT="${1:?Kullanım: $0 <çıktı-klasörü>}"; mkdir -p "$OUT/dl"
python3 -m venv "$OUT/venv" && "$OUT/venv/bin/pip" install -q yt-dlp
"$OUT/venv/bin/yt-dlp" --no-playlist -f "bv*+ba/b" -o "$OUT/dl/reel.%(ext)s" "https://www.instagram.com/reel/CyRAZERMGVP/"
REEL="$OUT/dl/reel.mp4"   # 56,4 sn, 480x854 dikey, kesintisiz drone uçuşu (site sakininin çekimi, izinli)

# Havuzdan yükselip denize dönen kesintisiz bölüm: 13–52 sn → 15 sn (≈2,6x)
ffmpeg -y -hide_banner -loglevel error -ss 13 -t 39 -i "$REEL" -an \
  -vf "setpts=PTS/2.6,fps=30,format=yuv420p" -c:v libx264 -preset slow -crf 18 -movflags +faststart "$OUT/og_orbit_sea_15s.mp4"
V="$OUT/og_orbit_sea_15s.mp4"
ffmpeg -y -hide_banner -loglevel error -ss 0    -i "$V" -frames:v 1 -q:v 2 "$OUT/og_s1_start.jpg"
ffmpeg -y -hide_banner -loglevel error -ss 6.5  -i "$V" -frames:v 1 -q:v 2 "$OUT/og_s2_high.jpg"
ffmpeg -y -hide_banner -loglevel error -ss 12   -i "$V" -frames:v 1 -q:v 2 "$OUT/og_s3_sea.jpg"
ffmpeg -y -hide_banner -loglevel error -sseof -0.1 -i "$V" -frames:v 1 -q:v 2 "$OUT/og_s4_end.jpg"
ls -lh "$OUT"/og_*
