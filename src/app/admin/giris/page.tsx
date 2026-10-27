import { redirect } from 'next/navigation'
import { getSettings } from '@/lib/state'
import { isAdmin } from '@/lib/auth'
import { loginAction, setupAction } from '../actions'
import { Notice } from '../Notice'

export default async function LoginPage({ searchParams }: { searchParams: { mesaj?: string } }) {
  if (await isAdmin()) redirect('/admin')
  const settings = await getSettings()
  const setup = !settings.passwordHash
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-bold mb-6">{setup ? 'İlk kurulum' : 'Yönetici girişi'}</h1>
      <Notice message={searchParams.mesaj} />
      {setup ? (
        <form action={setupAction} className="space-y-4">
          <p className="text-sm text-stone-500">Panel için bir şifre belirle (en az 10 karakter).</p>
          {process.env.SETUP_TOKEN && (
            <div>
              <label className="label" htmlFor="setupToken">Kurulum anahtarı</label>
              <input id="setupToken" name="setupToken" className="input" required autoComplete="off" />
              <p className="hint">Sunucudaki .env dosyasındaki SETUP_TOKEN değeri.</p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="password">Şifre</label>
            <input id="password" name="password" type="password" minLength={10} className="input" required autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="password2">Şifre (tekrar)</label>
            <input id="password2" name="password2" type="password" minLength={10} className="input" required autoComplete="new-password" />
          </div>
          <button className="btn-primary">Kurulumu tamamla</button>
        </form>
      ) : (
        <form action={loginAction} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">Şifre</label>
            <input id="password" name="password" type="password" className="input" required autoComplete="current-password" autoFocus />
          </div>
          <button className="btn-primary">Giriş yap</button>
        </form>
      )}
    </div>
  )
}
