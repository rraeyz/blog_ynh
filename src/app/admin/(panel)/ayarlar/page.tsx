import Link from 'next/link'
import { getSettings } from '@/lib/state'
import { PROVIDERS } from '@/lib/ai'
import { FEATURE_SUGGESTION, MIN_PRESCORE } from '@/lib/writer'
import { changePasswordAction, saveSettingsAction } from '../../actions'
import { Notice } from '../../Notice'
import { ConfirmButton } from '../../ConfirmButton'

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const LESSON_DAYS = [['1', 'Pzt'], ['2', 'Sal'], ['3', 'Çar'], ['4', 'Per'], ['5', 'Cum'], ['6', 'Cmt'], ['0', 'Paz']]

// Sekmeler: her biri kendi formu; kaydedince yalnızca o sekmenin ayarları değişir
const SECTIONS = [
  ['site', 'Site'],
  ['yapay-zeka', 'Yapay zekâ'],
  ['haberler', 'Haberler'],
  ['egitim', 'Eğitim'],
  ['bulten', 'Bülten'],
  ['guvenlik', 'Yedek ve şifre'],
] as const

type Settings = Awaited<ReturnType<typeof getSettings>>

const Field = ({ label, id, hint, children }: { label: string; id?: string; hint?: React.ReactNode; children: React.ReactNode }) => (
  <div>
    <label className="label" htmlFor={id}>{label}</label>
    {children}
    {hint && <p className="hint">{hint}</p>}
  </div>
)

const Check = ({ name, checked, children }: { name: string; checked: boolean; children: React.ReactNode }) => (
  <label className="flex items-start gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={checked} className="mt-1" /> <span>{children}</span></label>
)

const Secret = ({ name, label, value, placeholder }: { name: string; label: string; value: string; placeholder: string }) => (
  <Field label={label} id={name}>
    <input id={name} name={name} type="password" autoComplete="off" className="input" placeholder={value ? 'kayıtlı (değiştirmek için yenisini yaz)' : placeholder} />
    {value && <label className="hint flex items-center gap-1"><input type="checkbox" name={`${name}Clear`} /> Kayıtlı anahtarı sil</label>}
  </Field>
)

const DaySelect = ({ name, value }: { name: string; value: number }) => (
  <select id={name} name={name} defaultValue={value} className="input">
    {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
  </select>
)

function Section({ section, s }: { section: string; s: Settings }) {
  if (section === 'site') return (
    <>
      <Field label="Site adı" id="siteTitle"><input id="siteTitle" name="siteTitle" defaultValue={s.siteTitle} className="input" /></Field>
      <Field label="Açıklama" id="siteDescription" hint="Ana sayfada büyük başlık olarak görünür."><input id="siteDescription" name="siteDescription" defaultValue={s.siteDescription} className="input" /></Field>
      <Field label="Sitenin adresi" id="siteUrl" hint={<>Bültendeki &quot;Devamını oku&quot; linkleri ve RSS bu adresi kullanır.</>}>
        <input id="siteUrl" name="siteUrl" defaultValue={s.siteUrl} placeholder="https://blog.rraeyz.me" className="input" />
      </Field>
    </>
  )
  if (section === 'yapay-zeka') return (
    <>
      <p className="hint">Haberleri yazan model burada. Dersler, görseller ve gökyüzü takvimi aşağıdaki OpenRouter anahtarını kullanır.</p>
      <Field label="Haberleri yazan sağlayıcı" id="aiProvider">
        <select id="aiProvider" name="aiProvider" defaultValue={s.aiProvider} className="input">
          {Object.entries(PROVIDERS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="Model" id="aiModel" hint="Sağlayıcının model adı (ör. OpenRouter'da anthropic/claude-haiku-5.5, Gemini'de gemini-3.5-flash-lite).">
        <input id="aiModel" name="aiModel" defaultValue={s.aiModel} className="input" placeholder="boşsa: Claude → claude-opus-5-5, DeepSeek → deepseek-chat" />
      </Field>
      <Secret name="aiApiKey" label="API anahtarı" value={s.aiApiKey} placeholder="" />
      <Field label="API adresi (yalnızca özel sağlayıcı)" id="aiBaseUrl" hint="OpenAI uyumlu bir sunucunun adresi; sonuna /chat/completions eklenir.">
        <input id="aiBaseUrl" name="aiBaseUrl" defaultValue={s.aiBaseUrl} className="input" placeholder="https://.../v1" />
      </Field>
      <Secret name="imageApiKey" label="OpenRouter API anahtarı (dersler, görseller, gökyüzü takvimi)" value={s.imageApiKey} placeholder="openrouter.ai → Keys; boşsa bunlar çalışmaz" />
      <Field label="Aylık token sınırı" id="monthlyTokenLimit" hint="0 = sınırsız. Aşılınca otomatik yazı ve ders üretimi ay sonuna kadar durur. Görsel ve web araması ücretleri buna sayılmaz; harcama sınırını OpenRouter'daki anahtar ayarından koy.">
        <input id="monthlyTokenLimit" name="monthlyTokenLimit" type="number" min={0} defaultValue={s.monthlyTokenLimit} className="input" />
      </Field>
    </>
  )
  if (section === 'haberler') return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Günde kaç yazı" id="postsPerDay"><input id="postsPerDay" name="postsPerDay" type="number" min={0} max={20} defaultValue={s.postsPerDay} className="input" /></Field>
        <Field label="En az kaçı astronomi/uzay" id="spacePerDay" hint="O gün yeterli uzay haberi yoksa diğer konulardan tamamlanır.">
          <input id="spacePerDay" name="spacePerDay" type="number" min={0} max={20} defaultValue={s.spacePerDay} className="input" />
        </Field>
        <Field label="En fazla kaçı astronomi/uzay" id="spaceMaxPerDay" hint="Fazlası başka konuların en önemli haberleriyle değişir.">
          <input id="spaceMaxPerDay" name="spaceMaxPerDay" type="number" min={0} max={20} defaultValue={s.spaceMaxPerDay} className="input" />
        </Field>
        <Field label="Günlük iş saati" id="dailyHour" hint="Türkiye saati.">
          <select id="dailyHour" name="dailyHour" defaultValue={s.dailyHour} className="input">
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
          </select>
        </Field>
      </div>
      <Field label="İlgi alanları" id="interests" hint={<>Model her gün bekleyen haberlerin başlık ve özetine bakıp en önemlilerini seçer ve hepsine ön puan verir. Burada yazdığın konular öncelik alır (baştaki en çok); sıradan bir haber yalnızca konusu uyuyor diye seçilmez. Ön puanı {MIN_PRESCORE} ve altı olanlar hemen atlanır.</>}>
        <textarea id="interests" name="interests" defaultValue={s.interests} rows={3} className="input" />
      </Field>
      <Check name="autoPublish" checked={s.autoPublish}>Yazıları onaysız yayımla (kapalıyken taslak olarak bekler)</Check>
      <Check name="autoFeature" checked={s.autoFeature}>Önem puanı {FEATURE_SUGGESTION}/10 ve üstü olan yazıyı yayımlanınca kendiliğinden öne çıkar (öne çıkanlarda en fazla 10; en eskisi düşer)</Check>
      <Check name="skyEnabled" checked={s.skyEnabled}>Gökyüzü takvimi: her hafta önümüzdeki 5 haftanın Türkiye&apos;den gözlenebilir gökyüzü olayları araştırılır (aylık takvim /gokyuzu, ana sayfa, bülten). Yardımcı modelle haftada birkaç sent.</Check>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Haberin ne kadarı okunsun?" id="readMode">
          <select id="readMode" name="readMode" defaultValue={s.readMode} className="input">
            <option value="abstract">Yalnızca beslemedeki özet (ucuz)</option>
            <option value="full">Tam metin (haber sayfası ya da arXiv HTML)</option>
          </select>
        </Field>
        <Field label="Haber başına en fazla karakter" id="maxInputChars" hint="Kabaca 4 karakter ≈ 1 token; önerilen 16000.">
          <input id="maxInputChars" name="maxInputChars" type="number" min={500} defaultValue={s.maxInputChars} className="input" />
        </Field>
      </div>
      <Field label="Görsel modeli" id="imageModel" hint="Serbest lisanslı kaynak görseli olmayan yazılara OpenRouter'da temsili kapak çizer (görsel başına ~0,01 $). openrouter.ai/models?output_modalities=image">
        <input id="imageModel" name="imageModel" defaultValue={s.imageModel} className="input" />
      </Field>
    </>
  )
  if (section === 'egitim') return (
    <>
      <p className="hint">
        Seçili günlerde günlük işten sonra sıradaki ders üç aşamada hazırlanır: web&apos;de araştırma, notlardan ders yazımı, notlarla karşılaştırmalı
        denetim. Ders başına yaklaşık 0,4-0,6 $ (yazım Sonnet, gerisi Haiku); hepsi Haiku ile 0,1-0,2 $. Müfredat ve istekler Eğitim sayfasında.
      </p>
      <Field label="Yazım modeli" id="lessonModel" hint="Okurun gördüğü ders metnini yazar; kalite en çok buna bağlı (ör. anthropic/claude-sonnet-5.5; en ucuzu anthropic/claude-haiku-5.5).">
        <input id="lessonModel" name="lessonModel" defaultValue={s.lessonModel} className="input" />
      </Field>
      <Field label="Yardımcı model" id="lessonHelperModel" hint="Web araştırması, ders planı, denetim ve gökyüzü takvimi. Maliyetin çoğu araştırmanın okuduğu sayfalardan geldiği için ucuz bir model (ör. anthropic/claude-haiku-5.5).">
        <input id="lessonHelperModel" name="lessonHelperModel" defaultValue={s.lessonHelperModel} className="input" />
      </Field>
      <div>
        <p className="label">Ders yazılan günler</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {LESSON_DAYS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5"><input type="checkbox" name="lessonDay" value={value} defaultChecked={s.lessonWeekdays.split(',').includes(value)} /> {label}</label>
          ))}
        </div>
        <p className="hint">Hiçbiri seçili değilse ders yazılmaz.</p>
      </div>
      <Check name="lessonAutoPublish" checked={s.lessonAutoPublish}>Dersleri kendiliğinden yayımla: denetim sorun bulmazsa ders hemen yayımlanır; sorun bulursa notlarıyla birlikte taslak olarak seni bekler</Check>
    </>
  )
  if (section === 'bulten') return (
    <>
      <Field label="Künye adresi" id="kunyeUrl"><input id="kunyeUrl" name="kunyeUrl" defaultValue={s.kunyeUrl} placeholder="https://rraeyz.me" className="input" /></Field>
      <Secret name="kunyeToken" label="Künye API anahtarı" value={s.kunyeToken} placeholder="Künye → Ayarlar → Güvenlik → API anahtarı" />
      <Field label="Abone etiketi" id="newsletterTag"><input id="newsletterTag" name="newsletterTag" defaultValue={s.newsletterTag} className="input" placeholder="boşsa tüm onaylı abonelere" /></Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Haftalık bülten günü" id="digestWeekday" hint="Son 7 günün en önemli 7 yazısı, haftanın dersleri ve gökyüzü takvimi."><DaySelect name="digestWeekday" value={s.digestWeekday} /></Field>
        <Field label="Astronomi özeti günü" id="astroDigestWeekday" hint="Yalnızca uzay ve fizik yazıları, gökyüzü ve dersler; ör. pazartesi dersinden önce pazar."><DaySelect name="astroDigestWeekday" value={s.astroDigestWeekday} /></Field>
      </div>
      <Check name="autoNewsletter" checked={s.autoNewsletter}>Bültenleri onaysız gönder (kapalıyken taslak olarak Bültenler sayfasında bekler)</Check>
      <Check name="astroDigest" checked={s.astroDigest}>Haftanın astronomi özetini de hazırla (abonelere haftada bir e-posta daha gider)</Check>
    </>
  )
  return null
}

export default async function SettingsPage({ searchParams }: { searchParams: { mesaj?: string; bolum?: string } }) {
  const s = await getSettings()
  const section = SECTIONS.some(([key]) => key === searchParams.bolum) ? searchParams.bolum! : 'site'
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-4">Ayarlar</h1>
      <nav aria-label="Ayar bölümleri" className="flex flex-wrap gap-2 mb-6 text-sm">
        {SECTIONS.map(([key, label]) => (
          <Link key={key} href={`/admin/ayarlar?bolum=${key}`} aria-current={key === section ? 'page' : undefined} className={key === section ? 'btn-primary' : 'btn'}>{label}</Link>
        ))}
      </nav>

      {section !== 'guvenlik' ? (
        // key: sekme değişince form yeniden kurulsun; yoksa React aynı sıradaki kutuyu tutar ve önceki sekmenin değeri görünür (Kaydet'le yazılır)
        <form key={section} action={saveSettingsAction} className="card space-y-5">
          <input type="hidden" name="section" value={section} />
          <Section section={section} s={s} />
          <button className="btn-primary">Kaydet</button>
        </form>
      ) : (
        <>
          <section className="card space-y-4">
            <h2 className="font-semibold">Yedekleme</h2>
            <p className="text-sm text-stone-500">
              Tam yedek: ayarlar, kaynaklar, makaleler, yazılar, bültenler, dersler ve yapay zekâ kapakları. API anahtarlarını da içerir; dosyayı güvenli bir
              yerde sakla, kimseyle paylaşma. Yönetici şifresi yedeğe girmez.
            </p>
            <a href="/api/admin/yedek" className="btn-primary" download>Tam yedeği indir</a>
            <form action="/api/admin/yedek" method="post" encType="multipart/form-data" className="flex flex-col sm:flex-row gap-2 pt-2">
              <input name="file" type="file" accept="application/json,.json" required aria-label="Yedek dosyası" className="input" />
              <ConfirmButton question="Yedek yüklensin mi? Mevcut kaynaklar, makaleler, yazılar, bültenler, dersler ve ayarlar yedektekilerle DEĞİŞTİRİLİR." className="btn whitespace-nowrap">Yedekten yükle</ConfirmButton>
            </form>
            <p className="hint">Sunucudaki günlük otomatik veritabanı yedekleri ayrıca YunoHost tarafında tutulur (son 7 gün).</p>
          </section>
          <form action={changePasswordAction} className="card space-y-4 mt-6">
            <h2 className="font-semibold">Şifre değiştir</h2>
            <input name="current" type="password" placeholder="Mevcut şifre" aria-label="Mevcut şifre" autoComplete="current-password" className="input" required />
            <input name="password" type="password" minLength={10} placeholder="Yeni şifre (en az 10 karakter)" aria-label="Yeni şifre" autoComplete="new-password" className="input" required />
            <button className="btn">Şifreyi değiştir</button>
          </form>
        </>
      )}
    </>
  )
}
