'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { suggestAction, type SubscribeState } from '../../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="rounded-full bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-2.5 transition disabled:opacity-60">{pending ? 'Gönderiliyor…' : 'Öner'}</button>
}

export function SuggestForm() {
  const [state, action] = useFormState<SubscribeState, FormData>(suggestAction, null)
  if (state?.ok) return <p role="status" className="font-medium text-violet-700 dark:text-violet-300">✓ {state.message}</p>
  return (
    <form action={action} className="space-y-3">
      <label className="sr-only" htmlFor="oner-konu">Konu</label>
      <input id="oner-konu" name="title" required minLength={3} maxLength={200} placeholder="Ör. Spektroskopik çift yıldızların yörüngesi nasıl bulunur?" className="input" />
      <label className="sr-only" htmlFor="oner-ayrinti">Ayrıntı</label>
      <textarea id="oner-ayrinti" name="detail" rows={2} maxLength={1000} placeholder="Neyi öğrenmek istiyorsun? (isteğe bağlı)" className="input" />
      {/* Bot tuzağı: insanlar görmez */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <SubmitButton />
      {state && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{state.message}</p>}
    </form>
  )
}
