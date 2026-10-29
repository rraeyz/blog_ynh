import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { createDigestAction } from '../../actions'
import { Notice } from '../../Notice'

const STATUS: Record<string, [string, string]> = {
  draft: ['Taslak', 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'],
  sent: ['Gönderildi', 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'],
  failed: ['Hata', 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'],
}

export default async function DigestsPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const digests = await prisma.digest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="text-xl font-bold flex-1">Bültenler</h1>
        <form action={createDigestAction}><button className="btn-primary">Son 7 günden bülten hazırla</button></form>
      </div>
      <p className="text-xs text-stone-500 mb-4">
        Bültenler Künye&apos;deki abonelere Künye&apos;nin e-posta ayarlarıyla gider. Tek bir önemli yazıyı hemen göndermek için yazının sayfasında &quot;Abonelere gönder&quot;i kullan.
      </p>
      {digests.length === 0 ? (
        <p className="text-sm text-stone-500">Henüz bülten yok. Yukarıdaki düğmeyle son 7 günün yazılarından bir taslak hazırla.</p>
      ) : (
        <ul className="space-y-2">
          {digests.map((digest) => {
            const [label, color] = STATUS[digest.status] ?? [digest.status, 'bg-stone-100 dark:bg-stone-800']
            return (
              <li key={digest.id} className="card py-3 text-sm">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 ${color}`}>{label}</span>
                  <span className="text-stone-500">{(digest.sentAt ?? digest.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>
                <Link href={`/admin/bultenler/${digest.id}`} className="mt-1.5 block font-medium leading-snug hover:underline">{digest.subject}</Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
