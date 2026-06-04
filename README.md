# Olive Garden 3 Site Yönetimi

Didim Akbük Olive Garden 3 sitesi için site yönetim platformu. Gelir/gider takibi, aidat yönetimi ve sakin duyuruları için tasarlanmıştır.

## Teknolojiler

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Supabase** (PostgreSQL + Authentication + RLS)
- **Vercel** uyumlu deployment

---

## Kurulum

### 1. Bağımlılıkları yükleyin

```bash
npm install
```

### 2. Supabase projesi oluşturun

1. [supabase.com](https://supabase.com) adresine gidin ve yeni bir proje oluşturun.
2. **Settings → API** bölümünden şu değerleri kopyalayın:
   - `Project URL`
   - `anon / public` key

### 3. Veritabanı şemasını kurun

Supabase Dashboard → **SQL Editor** içinde sırasıyla çalıştırın:

1. `supabase/schema.sql` — Tabloları ve trigger'ları oluşturur
2. `supabase/rls-policies.sql` — Row Level Security politikalarını kurar

### 4. Ortam değişkenlerini ayarlayın

```bash
cp .env.local.example .env.local
```

`.env.local` dosyasını açıp değerleri doldurun:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. İlk admin kullanıcısı oluşturun

Supabase Dashboard → **Authentication → Users** bölümünden yeni bir kullanıcı ekleyin, ardından SQL Editor'da rol atayın:

```sql
update public.profiles
set role = 'admin'
where id = 'kullanici-uuid-buraya';
```

### 6. Uygulamayı başlatın

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

---

## Sayfalar

| Sayfa | URL | Erişim |
|-------|-----|--------|
| Ana Sayfa | `/` | Herkese açık |
| Giriş | `/login` | Herkese açık |
| Admin Paneli | `/admin` | Sadece admin |
| Gelirler | `/admin/gelirler` | Sadece admin |
| Giderler | `/admin/giderler` | Sadece admin |
| Ödemeler | `/admin/odemeler` | Sadece admin |
| Duyurular | `/admin/duyurular` | Sadece admin |
| Raporlar | `/admin/raporlar` | Sadece admin |
| Sakin Paneli | `/resident` | Kayıtlı sakinler |

---

## Kullanıcı Rolleri

- **admin**: Tüm verileri okuyabilir, ekleyebilir, düzenleyebilir ve silebilir.
- **resident**: Yayımlanan duyuruları ve genel finansal özeti görebilir; veri düzenleyemez.

---

## Vercel'e Deploy Etme

1. Projenizi GitHub'a push edin.
2. [vercel.com](https://vercel.com) üzerinde yeni proje oluşturun ve repo'yu bağlayın.
3. **Environment Variables** bölümüne `.env.local` içindeki değerleri ekleyin.
4. Deploy edin.

> **Not:** Supabase projenizin **Authentication → URL Configuration** bölümüne Vercel URL'inizi (`Site URL` ve `Redirect URLs`) eklemeyi unutmayın.

---

## Proje Yapısı

```
src/
├── app/
│   ├── page.tsx              # Herkese açık ana sayfa
│   ├── login/page.tsx        # Giriş sayfası
│   ├── admin/                # Admin sayfaları
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Dashboard
│   │   ├── gelirler/page.tsx
│   │   ├── giderler/page.tsx
│   │   ├── odemeler/page.tsx
│   │   ├── duyurular/page.tsx
│   │   └── raporlar/page.tsx
│   └── resident/             # Sakin paneli
│       ├── layout.tsx
│       └── page.tsx
├── components/
│   ├── admin/                # Admin CRUD formları
│   └── shared/               # Paylaşılan bileşenler
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Tarayıcı istemcisi
│   │   ├── server.ts         # Sunucu istemcisi
│   │   └── actions.ts        # Server Actions (CRUD)
│   └── utils.ts
├── middleware.ts              # Auth yönlendirmesi
└── types/index.ts
supabase/
├── schema.sql
└── rls-policies.sql
```
