import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/state'
import { seedCurriculum, upcomingStage } from '@/lib/lessons'
import { requirementsOf, stageDone, TRACKS, type Track } from '@/lib/curriculum'
import { Notice } from '../../Notice'
import { ConfirmButton } from '../../ConfirmButton'
import { addStageAction, approveStageAction, deleteStageAction, requestLessonAction, retryLessonAction, runLessonAction } from '../../actions'

const DAY_NAMES = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi']

export default async function EducationAdminPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  await seedCurriculum()
  const [settings, rows, drafts, failed, proposals, request, upcoming, writtenCount] = await Promise.all([
    getSettings(),
    prisma.stage.findMany({ where: { approved: true }, orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { lessons: { select: { status: true } } } }),
    prisma.lesson.findMany({ where: { status: 'draft' }, orderBy: { updatedAt: 'desc' }, include: { series: { select: { title: true } } } }),
    prisma.lesson.findMany({ where: { status: 'failed' }, orderBy: { updatedAt: 'desc' }, include: { series: { select: { title: true } } } }),
    prisma.stage.findMany({ where: { approved: false }, orderBy: { createdAt: 'desc' } }),
    prisma.lesson.findFirst({ where: { status: 'planned', series: { position: { lt: 0 } } }, orderBy: { position: 'asc' }, select: { title: true } }),
    upcomingStage(),
    prisma.lesson.count({ where: { writtenAt: { not: null } } }),
  ])
  const days = settings.lessonWeekdays.split(',').filter(Boolean).map((d) => DAY_NAMES[Number(d)]).join(', ')
  const stages = rows.map((s) => ({ ...s, pending: s.lessons.filter((l) => l.status === 'planned').length }))
  const byKey = new Map(stages.map((s) => [s.key, s]))
  const state = (s: (typeof stages)[number]) => {
    if (s.planned && s.lessons.length === 0) return { label: 'Atlandı', waiting: [] }
    if (stageDone(s)) return { label: 'Bitti', waiting: [] }
    if (s.planned) return { label: 'Yürüyor', waiting: [] }
    const waiting = requirementsOf(s, stages).filter((key) => { const r = byKey.get(key); return r && !stageDone(r) })
    return { label: waiting.length ? 'Bekliyor' : 'Sırada', waiting }
  }
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <h1 className="text-xl font-bold mb-2">Eğitim</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Sıradaki ders {days ? `her ${days}` : 'hiçbir gün (Ayarlar → Eğitim)'} günlük işten sonra üç aşamada hazırlanır: web&apos;de araştırılır (en az 3
        doğrulanmış kaynak yoksa yazılmaz), notlardan yazılır, sonra notlarla karşılaştırılarak denetlenir. Denetim ciddi sorun bulmazsa{' '}
        {settings.lessonAutoPublish ? <b>kendiliğinden yayımlanır</b> : <>burada <b>taslak</b> olarak bekler</>}; bulursa bulgularıyla taslak kalır.
      </p>
      <p className="text-sm text-zinc-500 mb-4">
        Önce istekler yazılır, sonra hatlar sırayla: <b>Uygulama</b> ilk turunda her iki dersten biri, sonra her dört dersten biri; kalan dersler
        Astronomi → Temel bilim → Astronomi → Temel bilim → Kavram döner. Her hat bloklarını sırayla işler; blok sırası gelince araştırılıp derslere
        bölünür. Önkoşulu bitmemiş blok bekler, önce onu bekleten blok yazılır. Haftada bir, önemli haberlerde geçen ama listede olmayan kavramlar
        aşağıda önerilir; onaylamadan yazılmaz.
      </p>
      <div className="card mb-6 text-sm space-y-1">
        <p><b>Sıradaki:</b> {request ? <>istek · {request.title}</> : upcoming ? <>{TRACKS[upcoming.track as Track] ?? upcoming.track} · {upcoming.title}</> : 'yazılacak ders yok'}</p>
        <p><b>Yazım:</b> {settings.lessonModel} · <b>Yardımcı:</b> {settings.lessonHelperModel} · <b>OpenRouter anahtarı:</b> {settings.imageApiKey ? 'girilmiş' : 'yok (Ayarlar → Yapay zekâ)'}</p>
        <p className="text-zinc-500">Bir ders üç model çağrısı ve 10&apos;a kadar web araması kullanır (yazım Sonnet, gerisi Haiku); harcanan token dersin sayfasında görünür.</p>
        {writtenCount === 0 && settings.lessonAutoPublish && <p className="text-amber-700 dark:text-amber-300">İlk dersleri yayımlanmadan görmek için Ayarlar → Eğitim&apos;de otomatik yayını kapat; kaliteyi ve maliyeti gördükten sonra aç.</p>}
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        <form action={runLessonAction}><button className="btn-primary">Sıradaki dersi şimdi yaz</button></form>
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

      {proposals.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold mb-2">Haberlerden önerilen kavramlar</h2>
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1 min-w-0"><b>{p.title}</b><span className="block text-xs text-zinc-500">{p.summary}</span></span>
                <form action={approveStageAction}><input type="hidden" name="id" value={p.id} /><button className="btn-primary">Onayla</button></form>
                <form action={deleteStageAction}><input type="hidden" name="id" value={p.id} /><ConfirmButton question="Öneri silinsin mi?" className="btn">Sil</ConfirmButton></form>
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
        <div className="space-y-3">
          {(Object.keys(TRACKS) as Track[]).map((track) => {
            const list = stages.filter((s) => s.track === track)
            return (
              <details key={track} className="card" open={track !== 'kavram'}>
                <summary className="cursor-pointer font-medium">
                  {TRACKS[track]} <span className="text-xs font-normal text-zinc-500">· {list.filter(stageDone).length} / {list.length} blok bitti</span>
                </summary>
                <ol className="mt-3 divide-y divide-zinc-200/70 dark:divide-ink-line text-sm">
                  {list.map((s) => {
                    const { label, waiting } = state(s)
                    const published = s.lessons.filter((l) => l.status === 'published').length
                    return (
                      <li key={s.id} className="flex items-center gap-3 py-2">
                        <span className="w-10 shrink-0 text-xs text-zinc-500">{s.position}</span>
                        <Link href={`/admin/egitim/blok/${s.id}`} className="flex-1 min-w-0 hover:underline">
                          {s.title}
                          {waiting.length > 0 && <span className="block text-xs text-zinc-500">önkoşul: {waiting.join(', ')}</span>}
                        </Link>
                        <span className="shrink-0 text-xs text-zinc-500">{s.lessons.length > 0 && `${published}/${s.lessons.length} · `}{label}</span>
                      </li>
                    )
                  })}
                </ol>
              </details>
            )
          })}
        </div>
        <form action={addStageAction} className="card space-y-3 mt-4">
          <p className="font-medium text-sm">Blok ekle (hattın sonuna; sırasını bloğun sayfasından değiştirirsin)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <select name="track" aria-label="Hat" className="input">{Object.entries(TRACKS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <input name="title" required placeholder="Seri adı (kavramda kavramın adı)" className="input sm:col-span-2" />
          </div>
          <select name="level" aria-label="Aşama" defaultValue="temel" className="input">
            <option value="temel">Temel</option>
            <option value="orta">Orta</option>
            <option value="ileri">İleri</option>
          </select>
          <textarea name="summary" rows={2} placeholder="Önerilen dersler ve kapsam: ders listesi buna göre çıkarılır" className="input" />
          <button className="btn">Ekle</button>
          <p className="hint">Var olan bir serinin adını yazarsan blok o seriye eklenir. Kavramda aşama yok sayılır.</p>
        </form>
      </section>
    </>
  )
}
