import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/state'
import { Notice } from '../../Notice'
import { addSeriesAction, requestLessonAction, retryLessonAction, runLessonAction, seedSeriesAction } from '../../actions'

const DAY_NAMES = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi']

export default async function EducationAdminPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const [settings, series, drafts, failed] = await Promise.all([
    getSettings(),
    prisma.series.findMany({ orderBy: { position: 'asc' }, include: { lessons: { select: { status: true } } } }),
    prisma.lesson.findMany({ where: { status: 'draft' }, orderBy: { updatedAt: 'desc' }, include: { series: { select: { title: true } } } }),
    prisma.lesson.findMany({ where: { status: 'failed' }, orderBy: { updatedAt: 'desc' }, include: { series: { select: { title: true } } } }),
  ])
  const days = settings.lessonWeekdays.split(',').filter(Boolean).map((d) => DAY_NAMES[Number(d)]).join(', ')
  const count = (lessons: Array<{ status: string }>, status: string) => lessons.filter((l) => l.status === status).length
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-2">Eğitim</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Müfredattaki sıradaki ders {days ? `her ${days}` : 'hiçbir gün (Ayarlar → Eğitim)'} günlük işten sonra web&apos;de araştırılıp yazılır ve
        <b> taslak</b> olarak burada bekler; okuyup yayımlarsın. Yapay zekâ konu seçmez: önce istekleri, sonra müfredatı sırayla yazar; bir seri sırası
        gelince derslere bölünür, müfredat bitince çakışmayan yeni bir seri önerilir. En az 3 doğrulanmış kaynak bulamazsa dersi yazmaz.
      </p>
      <div className="card mb-6 text-sm space-y-1">
        <p><b>Model:</b> {settings.lessonModel} · <b>OpenRouter anahtarı:</b> {settings.imageApiKey ? 'girilmiş' : 'yok (Ayarlar → Görseller)'}</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        <form action={runLessonAction}><button className="btn-primary">Sıradaki dersi şimdi yaz</button></form>
        {series.length === 0 && <form action={seedSeriesAction}><button className="btn">Başlangıç müfredatını ekle</button></form>}
      </div>

      {drafts.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold mb-2">İnceleme bekleyen dersler</h2>
          <ul className="space-y-2">
            {drafts.map((l) => (
              <li key={l.id} className="card flex items-center gap-3">
                <span className="text-xs rounded px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Taslak</span>
                <Link href={`/admin/egitim/ders/${l.id}`} className="flex-1 hover:underline">{l.title}<span className="block text-xs text-zinc-500">{l.series.title}</span></Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {failed.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold mb-2">Yazılamayan dersler</h2>
          <ul className="space-y-2">
            {failed.map((l) => (
              <li key={l.id} className="card text-sm">
                <Link href={`/admin/egitim/ders/${l.id}`} className="font-medium hover:underline">{l.title}</Link>
                <span className="text-xs text-zinc-500"> · {l.series.title}</span>
                <p className="text-xs text-red-600 mt-1">{l.error}</p>
                <form action={retryLessonAction} className="mt-2"><input type="hidden" name="id" value={l.id} /><button className="btn">Yeniden sıraya al</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Ders iste</h2>
        <form action={requestLessonAction} className="card space-y-3">
          <input name="title" required placeholder="Ör. DAG'daki koronagraf nasıl çalışır?" className="input" />
          <textarea name="scope" rows={2} placeholder="Neler anlatılsın? (isteğe bağlı)" className="input" />
          <textarea name="sourceUrls" rows={2} placeholder="Varsa kaynak linkleri, satır başına bir tane: makale, alet belgesi, ders notu. Önce bunlar okunur." className="input" />
          <button className="btn-primary">Sıraya ekle</button>
          <p className="hint">İstekler müfredattan önce yazılır.</p>
        </form>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Müfredat</h2>
        {series.length === 0 ? (
          <p className="text-sm text-zinc-500">Henüz seri yok. Başlangıç müfredatını ekleyebilir ya da aşağıdan seri ekleyebilirsin; ilk ders yazılırken başlangıç müfredatı kendiliğinden eklenir.</p>
        ) : (
          <ol className="space-y-2">
            {series.map((s) => (
              <li key={s.id} className="card flex items-center gap-3 text-sm">
                <span className="w-8 text-zinc-500">{s.position}</span>
                <Link href={`/admin/egitim/seri/${s.id}`} className="flex-1 font-medium hover:underline">{s.title}</Link>
                <span className="text-xs text-zinc-500">
                  {s.planned ? `${count(s.lessons, 'published')} yayında · ${count(s.lessons, 'draft')} taslak · ${count(s.lessons, 'planned')} sırada` : 'sırası gelince derslere bölünecek'}
                </span>
              </li>
            ))}
          </ol>
        )}
        <form action={addSeriesAction} className="card space-y-3 mt-4">
          <p className="font-medium text-sm">Seri ekle</p>
          <input name="title" required placeholder="Ör. Kütleçekim Dalgaları" className="input" />
          <textarea name="summary" rows={2} placeholder="Kapsam: ders planı buna göre çıkarılır" className="input" />
          <button className="btn">Ekle</button>
        </form>
      </section>
    </>
  )
}
