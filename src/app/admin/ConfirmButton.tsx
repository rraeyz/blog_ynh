'use client'

// Silme ve gönderme gibi geri alınamayan işlemler için onay soran gönder düğmesi
export function ConfirmButton({ question, className, children }: { question: string; className: string; children: React.ReactNode }) {
  return (
    <button className={className} onClick={(event) => { if (!confirm(question)) event.preventDefault() }}>
      {children}
    </button>
  )
}
