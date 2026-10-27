import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { createDigestAction } from '../../actions'
import { Notice } from '../../Notice'

const STATUS: Record<string, string> = { draft: 'Taslak', sent: 'Gönderildi', failed: 'Hata' }

export default async function DigestsPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  const digests = await prisma.digest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return (
    <>
      <Notice message={searchParams.mesaj} />
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold flex-1">Bültenler</h1>
        <form action={createDigestAction}><button className="btn-primary">Son 7 günden bülten hazırla</button></form>
      </div>
      <p className="text-sm text-stone-500 mb-4">
        Bültenler Künye&apos;deki abonelere Künye&apos;nin e-posta ayarlarıyla gider. Tek bir önemli yazıyı hemen göndermek için yazının sayfasında &quot;Abonelere gönder&quot;i kullan.
      </p>
      <ul className="space-y-2">
        {digests.map((digest) => (
          <li key={digest.id} className="card text-sm flex items-center gap-3">
            <span className="text-xs rounded px-2 py-0.5 bg-stone-100 dark:bg-stone-800">{STATUS[digest.status] ?? digest.status}</span>
            <Link href={`/admin/bultenler/${digest.id}`} className="flex-1 hover:underline">{digest.subject}</Link>
            <span className="text-xs text-stone-500">{(digest.sentAt ?? digest.createdAt).toLocaleDateString('tr-TR')}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
