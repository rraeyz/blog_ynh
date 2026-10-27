import Anthropic from '@anthropic-ai/sdk'
import type { Settings } from '@/lib/state'

// Yapay zekâ sağlayıcıları. Claude resmi SDK ile; diğerleri OpenAI uyumlu /chat/completions ucu ile çağrılır.
// Model adı boş bırakılırsa defaultModel kullanılır; varsayılanı olmayan sağlayıcıda model adı zorunlu.
export const PROVIDERS: Record<string, { label: string; baseUrl: string; defaultModel: string }> = {
  anthropic: { label: 'Claude (Anthropic)', baseUrl: '', defaultModel: 'claude-opus-5-5' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: '' },
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: '' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: '' },
  custom: { label: 'Özel adres (OpenAI uyumlu: OpenCode, Ollama...)', baseUrl: '', defaultModel: '' },
}

export interface Completion {
  text: string
  inputTokens: number
  outputTokens: number
}

const TIMEOUT = 5 * 60 * 1000
// Sağlayıcı geçici olarak meşgulse (Gemini'de sık "503") iki kez daha denenir; testler süreleri kısaltır
export const RETRY_DELAYS = [15_000, 45_000]
const RETRY_STATUS = new Set([429, 500, 502, 503, 504])

export function aiConfig(settings: Settings) {
  const provider = PROVIDERS[settings.aiProvider] ? settings.aiProvider : 'anthropic'
  const model = settings.aiModel.trim() || PROVIDERS[provider].defaultModel
  const baseUrl = (provider === 'custom' ? settings.aiBaseUrl : PROVIDERS[provider].baseUrl).replace(/\/+$/, '')
  return { provider, model, baseUrl, apiKey: settings.aiApiKey.trim() }
}

export async function complete(settings: Settings, system: string, user: string): Promise<Completion> {
  const { provider, model, baseUrl, apiKey } = aiConfig(settings)
  if (!model) throw new Error('Ayarlar → Yapay zekâ bölümünde model adı girilmemiş')
  if (!apiKey && provider !== 'custom') throw new Error('Ayarlar → Yapay zekâ bölümünde API anahtarı girilmemiş')

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey, timeout: TIMEOUT })
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
    })
    if (response.stop_reason === 'refusal') throw new Error('Model bu isteği yanıtlamayı reddetti')
    const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
    return { text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
  }

  if (!baseUrl) throw new Error('Özel sağlayıcı için API adresi girilmemiş')
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      signal: AbortSignal.timeout(TIMEOUT),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok && RETRY_STATUS.has(response.status) && attempt < RETRY_DELAYS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]))
      continue
    }
    return completion(provider, response, data)
  }
}

function completion(provider: string, response: Response, data: any): Completion {
  if (!response.ok) throw new Error(`${PROVIDERS[provider].label} hata ${response.status}: ${String(data?.error?.message ?? data?.error ?? '').slice(0, 200)}`)
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('Modelden metin yanıtı gelmedi')
  return { text, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 }
}
