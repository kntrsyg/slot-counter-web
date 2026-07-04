import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseSlotInfo } from '../src/utils/parseSlotInfo'

const MAX_RESPONSE_BYTES = 1_500_000
const MAX_TEXT_LENGTH = 60_000
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 10_000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 8
const requestLog = new Map<string, number[]>()

function isPrivateAddress(address: string): boolean {
  const lower = address.toLowerCase().split('%')[0]
  if (lower === '::' || lower === '::1') return true
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe') || lower.startsWith('ff')) return true
  if (lower.startsWith('2001:db8:')) return true
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7))
  if (isIP(lower) !== 4) return false

  const [a, b] = lower.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19))
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('正しいURLを入力してください。')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('httpまたはhttpsのURLのみ取得できます。')
  if (url.username || url.password) throw new Error('認証情報を含むURLは取得できません。')
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('標準ポート以外のURLは取得できません。')
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('ローカルネットワークのURLは取得できません。')

  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('ローカルネットワークのURLは取得できません。')
  }
  return url
}

function checkRateLimit(request: VercelRequest): boolean {
  const raw = request.headers['x-forwarded-for']
  const client = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const recent = (requestLog.get(client) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) return false
  recent.push(now)
  requestLog.set(client, recent)
  return true
}

async function readLimitedBody(response: Response, encoding = 'utf-8'): Promise<string> {
  const announcedSize = Number(response.headers.get('content-length') || 0)
  if (announcedSize > MAX_RESPONSE_BYTES) throw new Error('ページのサイズが大きすぎるため取得できません。')
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('ページのサイズが大きすぎるため取得できません。')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

async function fetchPage(initialUrl: URL): Promise<{ html: string; finalUrl: string }> {
  let current = initialUrl
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    current = await validatePublicUrl(current.toString())
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let result: Response
    try {
      result = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
          'User-Agent': 'SlotCounterReferenceFetcher/1.0 (+https://slot-counter-web.vercel.app/)',
        },
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('ページ取得がタイムアウトしました。')
      throw new Error('ページに接続できませんでした。')
    } finally {
      clearTimeout(timer)
    }

    if ([301, 302, 303, 307, 308].includes(result.status)) {
      const location = result.headers.get('location')
      await result.body?.cancel()
      if (!location) throw new Error('転送先URLを確認できませんでした。')
      if (redirect === MAX_REDIRECTS) throw new Error('リダイレクト回数が多すぎます。')
      current = new URL(location, current)
      continue
    }
    if (!result.ok) throw new Error(`ページ取得に失敗しました（HTTP ${result.status}）。`)
    const contentType = result.headers.get('content-type')?.toLowerCase() || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
      throw new Error('HTMLまたはテキストのページではありません。')
    }
    const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || 'utf-8'
    return { html: await readLimitedBody(result, charset), finalUrl: current.toString() }
  }
  throw new Error('ページを取得できませんでした。')
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x'
      const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity
    }
    return named[code.toLowerCase()] ?? entity
  })
}

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const title = decodeEntities((titleMatch?.[1] || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  const text = decodeEntities(html
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, '\n')
    .replace(/<\/?(td|th)\b[^>]*>/gi, '\t')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  return { title, text: focusRelevantText(text) }
}

function focusRelevantText(text: string): string {
  const lines = text.split('\n')
  const relevant = /設定\s*[1-6]|1\s*[\/／]\s*\d|\d+(?:\.\d+)?\s*分の\s*1|BIG|REG|合算|ブドウ|ぶどう|チェリー|スイカ|チャンス目/i
  const selected = new Set<number>()
  lines.forEach((line, index) => {
    if (relevant.test(line)) {
      for (let nearby = Math.max(0, index - 2); nearby <= Math.min(lines.length - 1, index + 2); nearby += 1) selected.add(nearby)
    }
  })
  const focused = selected.size ? [...selected].sort((a, b) => a - b).map((index) => lines[index]).join('\n') : lines.slice(0, 500).join('\n')
  return focused.slice(0, MAX_TEXT_LENGTH)
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'POSTメソッドのみ利用できます。' })
  if (!checkRateLimit(request)) return response.status(429).json({ success: false, error: '短時間の取得回数が上限に達しました。時間を置いてお試しください。' })

  let body: { url?: unknown } | undefined
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body) as { url?: unknown } : request.body as { url?: unknown } | undefined
  } catch {
    return response.status(400).json({ success: false, error: 'JSONリクエストを確認できませんでした。' })
  }
  if (!body || typeof body.url !== 'string' || body.url.length > 2_000) {
    return response.status(400).json({ success: false, error: '取得するURLを入力してください。' })
  }

  try {
    const requestedUrl = await validatePublicUrl(body.url.trim())
    const { html, finalUrl } = await fetchPage(requestedUrl)
    const { title, text } = htmlToText(html)
    const parsed = parseSlotInfo(text, title)
    return response.status(200).json({ success: true, title, text, sourceUrl: finalUrl, parsed })
  } catch (error) {
    const message = error instanceof Error ? error.message : '自動取得できませんでした。'
    return response.status(422).json({ success: false, error: message })
  }
}
