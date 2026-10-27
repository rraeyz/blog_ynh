// Sunucu açılırken bir kez çalışır. Node'a özgü kod Edge derlemesine girmesin diye ayrı dosyada
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/jobs')
    startScheduler()
  }
}
