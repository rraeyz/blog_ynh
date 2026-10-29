'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { reportAction, type SubscribeState } from '../../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="btn">{pending ? 'Gönderiliyor…' : 'Gönder'}</button>
}

// Dersin sonunda kapalı duran "Hata bildir" kutusu
export function ReportForm({ lessonId }: { lessonId: number }) {
  const [state, action] = useFormState<SubscribeState, FormData>(reportAction, null)
  return (
    <details className="mt-6 card text-sm">
      <summary className="cursor-pointer font-medium">Hata bildir ya da anlaşılmayan yeri söyle</summary>
      {state?.ok ? (
        <p role="status" className="mt-3 text-violet-700 dark:text-violet-300">✓ {state.message}</p>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="lessonId" value={lessonId} />
          <label className="sr-only" htmlFor="bildir-not">Not</label>
          <textarea id="bildir-not" name="note" required minLength={5} maxLength={1000} rows={3} placeholder="Ör. &quot;Matematiği&quot; bölümündeki formülde katsayı yanlış görünüyor; ya da ikinci adımı anlamadım." className="input" />
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <SubmitButton />
          {state && <p role="alert" className="text-rose-600 dark:text-rose-300">{state.message}</p>}
        </form>
      )}
    </details>
  )
}
