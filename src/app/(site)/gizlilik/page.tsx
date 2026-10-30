import type { Metadata } from 'next'
import { getSettings } from '@/lib/state'

export const metadata: Metadata = {
  title: 'Gizlilik',
  description: 'Bu sitenin hangi bilgileri neden topladığı ve nerede sakladığı.',
}

// Uygulama mağazaları gizlilik sayfası ister. Kod değişince (yeni form, yeni hizmet) bu sayfa da güncellenmeli
export default async function PrivacyPage() {
  const settings = await getSettings()
  const contact = settings.kunyeUrl.replace(/^https?:\/\//, '')
  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="py-10 md:py-14">
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">Son güncelleme: 30 Ekim 2026</p>
        <h1 className="mt-5 text-4xl md:text-5xl font-semibold leading-[1.08]">Gizlilik</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          {settings.siteTitle} okumak için hesap açmanı istemez. Reklam, izleme çerezi ya da ziyaretçi analizi kullanmaz. Aşağıda, yalnızca senin gönderdiğin bilgilerin nereye gittiği yazıyor.
        </p>
      </header>
      <div className="space-y-8 text-zinc-700 dark:text-zinc-300 leading-7 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 dark:[&_h2]:text-white [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        <section>
          <h2>Bülten aboneliği</h2>
          <p>
            Abone olurken yazdığın e-posta adresi ve (yazdıysan) adın, bültenleri gönderen kardeş sitemizin{contact && <> ({contact})</>} abone listesine kaydedilir. Aboneliğin, sana gelen onay e-postasındaki bağlantıya tıklayınca başlar. Her bültenin sonunda abonelikten çıkma bağlantısı vardır; çıkınca adresin listeden silinir. Adresin başka biriyle paylaşılmaz, satılmaz.
          </p>
        </section>
        <section>
          <h2>Ders önerileri ve hata bildirimleri</h2>
          <p>
            Bu formlarda yalnızca yazdığın metin kaydedilir; adın ya da e-postan istenmez. Metin, öneriyi değerlendirmek ya da dersi düzeltmek için yapay zekâ hizmetine (OpenRouter üzerinden) gönderilebilir. Bu yüzden bu formlara kişisel bilgi yazma. Değerlendirilen öneri ve bildirimler silinir.
          </p>
        </section>
        <section>
          <h2>IP adresi</h2>
          <p>
            Formların kötüye kullanılmasını önlemek için IP adresin en fazla bir saat sunucunun belleğinde tutulur, veritabanına yazılmaz. Sitenin çalıştığı sunucu, her web sunucusu gibi güvenlik ve hata ayıklama için teknik erişim kayıtları (IP adresi, tarih, açılan sayfa) tutabilir.
          </p>
        </section>
        <section>
          <h2>Tarayıcında saklananlar</h2>
          <ul>
            <li><strong>Tema seçimin</strong> (açık, koyu, otomatik).</li>
            <li><strong>Okuduğun dersler:</strong> ders ilerleme çubuğu için. Yalnızca senin tarayıcında durur, sunucuya gönderilmez; tarayıcı verilerini silince kaybolur.</li>
          </ul>
          <p className="mt-2">Okurlar için çerez kullanılmaz; tek çerez, site yöneticisinin panel oturumudur.</p>
        </section>
        <section>
          <h2>Başka sitelerden yüklenenler</h2>
          <p>
            Bazı yazıların kapak görseli, görseli serbestçe kullanıma açan kurumların (NASA, ESA, ESO gibi) kendi sunucularından yüklenir; bu sunucular her görsel isteğinde olduğu gibi IP adresini görür. Yazı tipleri ve diğer her şey bu sitenin kendi sunucusundan gelir.
          </p>
        </section>
        <section>
          <h2>Yapay zekâ</h2>
          <p>
            Yazılar, dersler ve gökyüzü takvimi yapay zekâ yardımıyla hazırlanır; dayandığı kaynaklar her sayfanın sonunda yazar. Kapağında &quot;Temsili görsel&quot; yazan görseller yapay zekâyla üretilmiştir.
          </p>
        </section>
        <section>
          <h2>Hakların ve iletişim</h2>
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, hakkında tutulan bilgiyi öğrenmeyi, düzeltilmesini ya da silinmesini isteyebilirsin. Aboneliğini bültendeki bağlantıyla kendin sonlandırabilirsin; diğer istekler için{contact ? <> <a href={settings.kunyeUrl} className="text-violet-600 dark:text-violet-300 underline underline-offset-4">{contact}</a> adresindeki iletişim formunu</> : ' sitenin iletişim adresini'} kullan.
          </p>
        </section>
      </div>
    </div>
  )
}
