import { setRequestLocale } from 'next-intl/server'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export default async function SozlesmePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="min-h-screen bg-[#f8faf5]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Image src="/images/olive-branch.png" alt="" width={36} height={36} className="opacity-80" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Olive Garden 3</h1>
            <p className="text-xs text-gray-400">Didim Akbük · Site Yönetimi</p>
          </div>
        </div>

        <Link href="/register" className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline mb-8">
          <ArrowLeft className="h-3.5 w-3.5" />
          Kayıt formuna dön
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

          {/* Başlık */}
          <div className="border-b border-gray-100 pb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Kullanım Koşulları ve KVKK Aydınlatma Metni</h2>
            <p className="text-xs text-gray-400">Son güncelleme: Haziran 2026</p>
          </div>

          {/* Bölüm 1 */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">1. Taraflar ve Kapsam</h3>
            <p>
              Bu platform, <strong>Olive Garden 3 Site Yönetimi</strong> ("Yönetim") tarafından
              Olive Garden 3 sitesi sakinlerine yönelik finansal şeffaflık ve iletişim amacıyla
              işletilmektedir. Siteye kayıt olarak bu koşulları kabul etmiş sayılırsınız.
            </p>
            <p>
              Platform yalnızca <strong>Olive Garden 3 sitesi sakinleri ve mülk sahipleri</strong> tarafından kullanılabilir.
              Yönetici onayı olmadan sisteme erişim sağlanamaz.
            </p>
          </section>

          {/* Bölüm 2 */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">2. Kullanım Koşulları</h3>
            <ul className="list-disc list-inside space-y-1.5 text-gray-600">
              <li>Platformu yalnızca site yönetimine ilişkin meşru amaçlarla kullanabilirsiniz.</li>
              <li>Hesap bilgilerinizi üçüncü kişilerle paylaşmamalısınız.</li>
              <li>Platformdaki finansal veriler bilgilendirme amaçlıdır; bağlayıcı belge niteliği taşımaz.</li>
              <li>Sistemi kötüye kullanmak, başka sakinlerin verilerine izinsiz erişmeye çalışmak yasaktır.</li>
              <li>Yönetim, önceden bildirim yaparak platform üzerinde değişiklik yapma hakkını saklı tutar.</li>
            </ul>
          </section>

          {/* Bölüm 3 — KVKK */}
          <section className="space-y-3 bg-amber-50 border border-amber-100 rounded-xl p-5">
            <h3 className="text-base font-semibold text-gray-900">
              3. KVKK Aydınlatma Metni
              <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">6698 Sayılı Kanun</span>
            </h3>

            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-800 mb-1">Veri Sorumlusu</p>
                <p className="text-gray-600">
                  Olive Garden 3 Site Yönetimi — Akbük Mh, 5726 Sok. No:1, 09270 Didim/Aydın, Türkiye
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">İşlenen Kişisel Veriler</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Ad, soyad</li>
                  <li>E-posta adresi</li>
                  <li>Daire numarası</li>
                  <li>Aidat ödeme bilgileri</li>
                  <li>Sisteme giriş tarihi ve saati</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">İşleme Amaçları</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Site yönetimine ilişkin hizmetlerin sunulması</li>
                  <li>Aidat takibi ve ödeme bildirimlerinin yapılması</li>
                  <li>Duyuruların iletilmesi</li>
                  <li>Sisteme erişimin kimlik doğrulaması yoluyla güvence altına alınması</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">Hukuki Dayanak</p>
                <p className="text-gray-600">
                  KVKK m. 5/2-c (sözleşmenin kurulması veya ifasıyla doğrudan ilgi) ve
                  m. 5/2-f (meşru menfaat).
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">Verilerin Aktarılması</p>
                <p className="text-gray-600">
                  Kişisel verileriniz üçüncü kişilere satılmaz veya ticari amaçla paylaşılmaz.
                  Yalnızca platformun altyapısını sağlayan <strong>Supabase</strong> (bulut veritabanı hizmeti)
                  ve <strong>Resend</strong> (e-posta iletim hizmeti) ile teknik zorunluluk çerçevesinde paylaşılır.
                  Her iki hizmet de GDPR uyumlu çalışmaktadır.
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">Saklama Süresi</p>
                <p className="text-gray-600">
                  Verileriniz, üyeliğiniz aktif olduğu süre boyunca saklanır. Hesabınızın silinmesi
                  durumunda kişisel verileriniz sistemden kaldırılır; finansal kayıtlar ise mevzuatın
                  gerektirdiği süre boyunca anonim biçimde muhafaza edilebilir.
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">Haklarınız (KVKK m. 11)</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                  <li>Verilerinize erişim talep etme</li>
                  <li>Hatalı verilerin düzeltilmesini isteme</li>
                  <li>Belirli koşullar altında silinmesini talep etme</li>
                  <li>İşlemeye itiraz etme</li>
                </ul>
                <p className="text-gray-600 mt-2">
                  Bu haklarınızı kullanmak için site yönetimiyle iletişim formundan iletişime geçebilirsiniz.
                </p>
              </div>
            </div>
          </section>

          {/* Bölüm 4 */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">4. Güvenlik</h3>
            <p className="text-gray-600">
              Verileriniz endüstri standardı şifreleme yöntemleriyle korunmaktadır. Şifreniz
              asla düz metin olarak saklanmaz. Hesabınızın güvenliği için güçlü bir şifre
              seçmenizi ve kimseyle paylaşmamanızı tavsiye ederiz.
            </p>
          </section>

          {/* Bölüm 5 */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">5. Değişiklikler</h3>
            <p className="text-gray-600">
              Bu metin gerektiğinde güncellenebilir. Önemli değişiklikler platform üzerinden
              duyurulacaktır.
            </p>
          </section>

          <div className="border-t border-gray-100 pt-6 text-xs text-gray-400 text-center">
            © 2026 Olive Garden 3 Site Yönetimi · Didim Akbük, Türkiye
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/register" className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Kayıt formuna dön
          </Link>
        </div>
      </div>
    </div>
  )
}
