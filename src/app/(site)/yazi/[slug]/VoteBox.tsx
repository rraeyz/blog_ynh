'use client'

import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { voteAction, type SubscribeState } from '../../../actions'

const KEY = 'oylar' // oy verilen yazıların id'leri; yalnızca bu tarayıcıda

function read(): number[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function Vote({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="btn">{label}</button>
}

// Yazının sonunda "Faydalı mıydı?". Aynı yazıya bu tarayıcıda bir kez sorulur
export function VoteBox({ postId }: { postId: number }) {
  const [up, upAction] = useFormState<SubscribeState, FormData>(voteAction, null)
  const [down, downAction] = useFormState<SubscribeState, FormData>(voteAction, null)
  const [voted, setVoted] = useState(false)
  const state = up ?? down
  useEffect(() => setVoted(read().includes(postId)), [postId])
  useEffect(() => {
    if (!state?.ok) return
    try {
      localStorage.setItem(KEY, JSON.stringify([...read(), postId].slice(-500)))
    } catch {}
  }, [state, postId])

  if (state?.ok || voted) return <p role="status" className="mt-8 text-sm text-zinc-500">✓ Teşekkürler, oyun alındı.</p>
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium">Bu yazı faydalı mıydı?</span>
      <form action={upAction}><input type="hidden" name="postId" value={postId} /><input type="hidden" name="oy" value="evet" /><Vote label="👍 Evet" /></form>
      <form action={downAction}><input type="hidden" name="postId" value={postId} /><input type="hidden" name="oy" value="hayir" /><Vote label="👎 Hayır" /></form>
      {state && <p role="alert" className="w-full text-rose-600 dark:text-rose-300">{state.message}</p>}
    </div>
  )
}
