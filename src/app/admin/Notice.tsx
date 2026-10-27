// İşlem sonrası ?mesaj=... ile gelen bilgi satırı
export function Notice({ message }: { message?: string }) {
  if (!message) return null
  return <p role="status" className="mb-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-900 px-3 py-2 text-sm">{message}</p>
}
