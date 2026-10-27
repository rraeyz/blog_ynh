import { getSettings } from '@/lib/state'
import { PROVIDERS } from '@/lib/ai'
import { changePasswordAction, saveSettingsAction } from '../../actions'
import { Notice } from '../../Notice'
import { ConfirmButton } from '../../ConfirmButton'

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

export default async function SettingsPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const s = await getSettings()
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-4">Ayarlar</h1>
      <form action={saveSettingsAction} className="space-y-6">
        <fieldset className="card space-y-4">
          <legend className="font-semibold px-1">Site</legend>
          <div><label className="label" htmlFor="siteTitle">Site adı</label><input id="siteTitle" name="siteTitle" defaultValue={s.siteTitle} className="input" /></div>
          <div><label className="label" htmlFor="siteDescription">Açıklama</label><input id="siteDescription" name="siteDescription" defaultValue={s.siteDescription} className="input" /></div>
          <div>
            <label className="label" htmlFor="siteUrl">Sitenin adresi</label>
            <input id="siteUrl" name="siteUrl" defaultValue={s.siteUrl} placeholder="https://blog.rraeyz.me" className="input" />
            <p className="hint">Bültendeki &quot;Devamını oku&quot; linkleri ve RSS bu adresi kullanır.</p>
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="font-semibold px-1">Yapay zekâ</legend>
          <div>
            <label className="label" htmlFor="aiProvider">Sağlayıcı</label>
            <select id="aiProvider" name="aiProvider" defaultValue={s.aiProvider} className="input">
              {Object.entries(PROVIDERS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="aiModel">Model</label>
            <input id="aiModel" name="aiModel" defaultValue={s.aiModel} className="input" placeholder="boşsa: Claude → claude-opus-5-5, DeepSeek → deepseek-chat" />
            <p className="hint">Sağlayıcının model adı. Ucuz bir model (ör. claude-haiku-5-5) token maliyetini çok düşürür; kaliteyi deneyerek karşılaştır.</p>
          </div>
          <div>
            <label className="label" htmlFor="aiApiKey">API anahtarı</label>
            <input id="aiApiKey" name="aiApiKey" type="password" autoComplete="off" className="input" placeholder={s.aiApiKey ? 'kayıtlı (değiştirmek için yenisini yaz)' : ''} />
            {s.aiApiKey && <label className="hint flex items-center gap-1"><input type="checkbox" name="aiApiKeyClear" /> Kayıtlı anahtarı sil</label>}
          </div>
          <div>
            <label className="label" htmlFor="aiBaseUrl">API adresi (yalnızca özel sağlayıcı)</label>
            <input id="aiBaseUrl" name="aiBaseUrl" defaultValue={s.aiBaseUrl} className="input" placeholder="https://.../v1" />
            <p className="hint">OpenAI uyumlu bir sunucunun adresi; sonuna /chat/completions eklenir.</p>
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="font-semibold px-1">Okuma ve bütçe</legend>
          <div>
            <label className="label" htmlFor="readMode">Makalenin ne kadarı okunsun?</label>
            <select id="readMode" name="readMode" defaultValue={s.readMode} className="input">
              <option value="abstract">Yalnızca özet (ucuz)</option>
              <option value="full">Tam metin (arXiv HTML sürümü varsa; pahalı)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="maxInputChars">Makale başına en fazla karakter</label>
            <input id="maxInputChars" name="maxInputChars" type="number" min={500} defaultValue={s.maxInputChars} className="input" />
            <p className="hint">Kabaca 4 karakter ≈ 1 token. Tam metinde bütçeyi bu sınır belirler.</p>
          </div>
          <div>
            <label className="label" htmlFor="monthlyTokenLimit">Aylık token sınırı</label>
            <input id="monthlyTokenLimit" name="monthlyTokenLimit" type="number" min={0} defaultValue={s.monthlyTokenLimit} className="input" />
            <p className="hint">0 = sınırsız. Aşılınca otomatik yazı üretimi ay sonuna kadar durur.</p>
          </div>
          <div>
            <label className="label" htmlFor="interests">İlgi alanları</label>
            <textarea id="interests" name="interests" defaultValue={s.interests} rows={2} className="input" placeholder="büyük dil modelleri, robotik, tıpta yapay zekâ" />
            <p className="hint">Doluysa her gün yeni makalelerin başlıklarından bunlara en uygun olanları model seçer; boşsa en yeniler alınır.</p>
          </div>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="font-semibold px-1">Otomasyon</legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label" htmlFor="postsPerDay">Günde kaç yazı</label><input id="postsPerDay" name="postsPerDay" type="number" min={0} max={20} defaultValue={s.postsPerDay} className="input" /></div>
            <div>
              <label className="label" htmlFor="dailyHour">Günlük iş saati</label>
              <select id="dailyHour" name="dailyHour" defaultValue={s.dailyHour} className="input">
                {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
              </select>
              <p className="hint">Her gün bu saatte kaynaklar taranır ve yeni yazılar hazırlanır (Türkiye saati).</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoPublish" defaultChecked={s.autoPublish} /> Yazıları onaysız yayımla (kapalıyken taslak olarak bekler)</label>
          <div>
            <label className="label" htmlFor="digestWeekday">Haftalık bülten günü</label>
            <select id="digestWeekday" name="digestWeekday" defaultValue={s.digestWeekday} className="input">
              {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoNewsletter" defaultChecked={s.autoNewsletter} /> Haftalık bülteni onaysız gönder (kapalıyken taslak olarak bekler)</label>
        </fieldset>

        <fieldset className="card space-y-4">
          <legend className="font-semibold px-1">Künye (abone listesi ve e-posta)</legend>
          <div><label className="label" htmlFor="kunyeUrl">Künye adresi</label><input id="kunyeUrl" name="kunyeUrl" defaultValue={s.kunyeUrl} placeholder="https://rraeyz.me" className="input" /></div>
          <div>
            <label className="label" htmlFor="kunyeToken">Künye API anahtarı</label>
            <input id="kunyeToken" name="kunyeToken" type="password" autoComplete="off" className="input" placeholder={s.kunyeToken ? 'kayıtlı (değiştirmek için yenisini yaz)' : 'Künye → Ayarlar → Güvenlik → API anahtarı'} />
            {s.kunyeToken && <label className="hint flex items-center gap-1"><input type="checkbox" name="kunyeTokenClear" /> Kayıtlı anahtarı sil</label>}
          </div>
          <div>
            <label className="label" htmlFor="newsletterTag">Abone etiketi</label>
            <input id="newsletterTag" name="newsletterTag" defaultValue={s.newsletterTag} className="input" placeholder="boşsa tüm onaylı abonelere" />
          </div>
        </fieldset>

        <button className="btn-primary">Kaydet</button>
      </form>

      <section className="card space-y-4 mt-8">
        <h2 className="font-semibold">Yedekleme</h2>
        <p className="text-sm text-stone-500">
          Tam yedek: ayarlar, kaynaklar, makaleler, yazılar ve bültenler. Yapay zekâ ve Künye API anahtarlarını da içerir; dosyayı güvenli bir yerde sakla, kimseyle paylaşma.
          Yönetici şifresi yedeğe girmez.
        </p>
        <a href="/api/admin/yedek" className="btn-primary" download>Tam yedeği indir</a>
        <form action="/api/admin/yedek" method="post" encType="multipart/form-data" className="flex flex-col sm:flex-row gap-2 pt-2">
          <input name="file" type="file" accept="application/json,.json" required aria-label="Yedek dosyası" className="input" />
          <ConfirmButton question="Yedek yüklensin mi? Mevcut kaynaklar, makaleler, yazılar, bültenler ve ayarlar yedektekilerle DEĞİŞTİRİLİR." className="btn whitespace-nowrap">Yedekten yükle</ConfirmButton>
        </form>
        <p className="hint">Sunucudaki günlük otomatik veritabanı yedekleri ayrıca YunoHost tarafında tutulur (son 7 gün).</p>
      </section>

      <form action={changePasswordAction} className="card space-y-4 mt-8">
        <h2 className="font-semibold">Şifre değiştir</h2>
        <input name="current" type="password" placeholder="Mevcut şifre" aria-label="Mevcut şifre" autoComplete="current-password" className="input" required />
        <input name="password" type="password" minLength={10} placeholder="Yeni şifre (en az 10 karakter)" aria-label="Yeni şifre" autoComplete="new-password" className="input" required />
        <button className="btn">Şifreyi değiştir</button>
      </form>
    </>
  )
}
