import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { parseSuggestion } from '@/lib/text'
import { TRACKS } from '@/lib/curriculum'
import { Notice } from '../../../../Notice'
import { analyzeSuggestionAction, approveSuggestionAction, rejectSuggestionAction } from '../../../../actions'

const DECISIONS = { var: 'Müfredatta zaten var', tek: 'Tek ders yeter', seri: 'Yeni seri', 'uygun-degil': 'Uygun değil' } as const

export default async function SuggestionAdminPage({ params, searchParams }: { params: { id: string }; searchParams: { mesaj?: string } }) {
  const suggestion = await prisma.suggestion.findUnique({ where: { id: Number(params.id) || 0 } })
  if (!suggestion) notFound()
  const plan = parseSuggestion(suggestion.analysis)
  const similar = plan ? await prisma.suggestion.findMany({ where: { id: { in: plan.similar, not: suggestion.id } }, select: { id: true, title: true } }) : []
  const stage = plan?.decision === 'var' && plan.key ? await prisma.stage.findUnique({ where: { key: plan.key }, select: { title: true, planned: true } }) : null
  const hidden = (
    <>
      <input type="hidden" name="id" value={suggestion.id} />
      <input type="hidden" name="similar" value={similar.map((s) => s.id).join(',')} />
    </>
  )
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <p className="text-sm mb-2"><Link href="/admin/egitim" className="hover:underline">← Eğitim</Link></p>
      <h1 className="text-xl font-bold">Okur önerisi: {suggestion.title}</h1>
      <p className="text-sm text-zinc-500 mb-4">{suggestion.createdAt.toLocaleDateString('tr-TR')}</p>
      {suggestion.detail && <p className="card text-sm mb-4 whitespace-pre-line">{suggestion.detail}</p>}

      <div className="flex flex-wrap gap-2 mb-6">
        <form action={analyzeSuggestionAction}><input type="hidden" name="id" value={suggestion.id} /><button className={plan ? 'btn' : 'btn-primary'}>{plan ? 'Yeniden değerlendir' : 'Analiz et'}</button></form>
        <form action={rejectSuggestionAction}>{hidden}<button className="btn-danger">Reddet{similar.length > 0 && ` (benzerleriyle ${similar.length + 1})`}</button></form>
      </div>
      {!plan && <p className="text-sm text-zinc-500">Analiz, konunun müfredatta olup olmadığına bakar; yoksa tek ders mi seri mi olması gerektiğini önerir (yardımcı model, birkaç kuruş). Hiçbir şey sen onaylamadan eklenmez.</p>}

      {plan && (
        <section className="card space-y-3 text-sm">
          <p><b>Karar:</b> {DECISIONS[plan.decision]}</p>
          {plan.reason && <p className="text-zinc-600 dark:text-zinc-400">{plan.reason}</p>}
          {similar.length > 0 && <p className="text-zinc-500">Aynı konuyu isteyen öteki öneriler (onay ya da retle birlikte kapanır): {similar.map((s) => s.title).join(' · ')}</p>}

          {plan.decision === 'var' && (
            <form action={approveSuggestionAction} className="space-y-3">
              {hidden}<input type="hidden" name="kind" value="var" />
              <p>Blok: <b>{stage?.title ?? 'bulunamadı'}</b> <code className="text-xs">{plan.key}</code>{stage?.planned && ' · zaten derslere bölünmüş'}</p>
              <input name="key" defaultValue={plan.key} aria-label="Blok anahtarı" className="input" />
              <button className="btn-primary">Bu bloğu hattının başına al</button>
            </form>
          )}

          {plan.decision === 'tek' && (
            <form action={approveSuggestionAction} className="space-y-3">
              {hidden}<input type="hidden" name="kind" value="tek" />
              <input name="title" defaultValue={plan.lesson?.title ?? suggestion.title} aria-label="Ders başlığı" className="input" required />
              <textarea name="scope" defaultValue={plan.lesson?.scope ?? ''} rows={2} aria-label="Kapsam" className="input" />
              <button className="btn-primary">Tek ders olarak sıranın önüne ekle</button>
            </form>
          )}

          {plan.decision === 'seri' && (
            <form action={approveSuggestionAction} className="space-y-3">
              {hidden}<input type="hidden" name="kind" value="seri" />
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <select name="track" defaultValue={plan.series?.track} aria-label="Hat" className="input">
                  {(['uygulama', 'astronomi', 'temel'] as const).map((t) => <option key={t} value={t}>{TRACKS[t]}</option>)}
                </select>
                <input name="title" defaultValue={plan.series?.title ?? suggestion.title} aria-label="Seri adı" className="input" required />
              </div>
              <textarea name="summary" defaultValue={plan.series?.summary ?? ''} rows={2} aria-label="Serinin kapsamı" placeholder="Serinin kapsamı" className="input" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <select name={`level${i}`} defaultValue={plan.stages[i]?.level ?? ''} aria-label={`${i + 1}. aşama`} className="input">
                    <option value="">Aşama yok</option>
                    <option value="temel">Temel</option>
                    <option value="orta">Orta</option>
                    <option value="ileri">İleri</option>
                  </select>
                  <textarea name={`summary${i}`} defaultValue={plan.stages[i]?.summary ?? ''} rows={2} aria-label={`${i + 1}. aşamanın önerilen dersleri`} placeholder="Önerilen dersler" className="input" />
                </div>
              ))}
              <input name="requires" defaultValue={plan.requires.join(', ')} aria-label="Önkoşullar" placeholder="Önkoşul anahtarları, ör. hareket/orta" className="input" />
              <button className="btn-primary">Seriyi hattın sonuna ekle</button>
            </form>
          )}
        </section>
      )}
    </>
  )
}
