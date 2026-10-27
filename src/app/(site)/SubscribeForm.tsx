'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { subscribeAction, type SubscribeState } from '../actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} className="rounded-full bg-violet-500 hover:bg-violet-400 text-white font-semibold px-6 py-3 transition disabled:opacity-60 whitespace-nowrap">
      {pending ? 'Gönderiliyor…' : 'Abone ol'}
    </button>
  )
}

export function SubscribeForm() {
  const [state, action] = useFormState<SubscribeState, FormData>(subscribeAction, null)
  if (state?.ok) return <p role="status" className="text-lg font-medium text-violet-200">✓ {state.message}</p>
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="sr-only" htmlFor="sub-email">E-posta</label>
        <input id="sub-email" name="email" type="email" required autoComplete="email" placeholder="e-posta adresin"
          className="flex-1 rounded-full bg-white/10 border border-white/20 px-5 py-3 placeholder:text-white/50 text-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
        <SubmitButton />
      </div>
      {/* Bot tuzağı: insanlar görmez */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state && <p role="alert" className="text-sm text-rose-200">{state.message}</p>}
    </form>
  )
}
