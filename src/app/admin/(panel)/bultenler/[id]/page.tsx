import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { deleteDigestAction, saveDigestAction, sendDigestAction } from '../../../actions'
import { Notice } from '../../../Notice'
import { ConfirmButton } from '../../../ConfirmButton'

export default async function DigestPage({ params, searchParams }: { params: { id: string }; searchParams: { mesaj?: string } }) {
  const digest = await prisma.digest.findUnique({ where: { id: Number(params.id) || 0 } })
  if (!digest) notFound()
  const sent = digest.status === 'sent'
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold flex-1">{sent ? 'Gönderilmiş bülten' : 'Bülten'}</h1>
        {!sent && (
          <form action={sendDigestAction}>
            <input type="hidden" name="id" value={digest.id} />
            <ConfirmButton question="Bülten Künye'deki abonelere gönderilsin mi? (önce kaydetmeyi unutma)" className="btn-primary">Abonelere gönder</ConfirmButton>
          </form>
        )}
        <form action={deleteDigestAction}><input type="hidden" name="id" value={digest.id} /><ConfirmButton question="Bülten silinsin mi?" className="btn-danger">Sil</ConfirmButton></form>
      </div>
      {digest.result && <p className={`text-sm mb-4 ${digest.status === 'failed' ? 'text-red-600' : 'text-stone-500'}`}>{digest.result}</p>}
      <form action={saveDigestAction} className="space-y-4">
        <input type="hidden" name="id" value={digest.id} />
        <div>
          <label className="label" htmlFor="subject">Konu</label>
          <input id="subject" name="subject" defaultValue={digest.subject} className="input" required disabled={sent} />
        </div>
        <div>
          <label className="label" htmlFor="body">Metin</label>
          <textarea id="body" name="body" defaultValue={digest.body} rows={20} className="input font-mono" required disabled={sent} />
          <p className="hint">Künye biçimi: **kalın**, *italik*, [metin](https://link). Altına Künye&apos;nin imzası ve abonelikten çık linki eklenir.</p>
        </div>
        {!sent && <button className="btn">Kaydet</button>}
      </form>
    </>
  )
}
