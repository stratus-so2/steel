import { describe, expect, it } from 'vitest'
import {
  annotateRequest,
  currentRequestContext,
  type RequestContext,
  runWithRequestContext,
} from '../analytics/request-context'
import { scrubMessage } from '../analytics/scrub'
import { parseUserAgent } from '../analytics/user-agent'

const UA = {
  chromeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  firefoxLinux:
    'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0',
  opera:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 OPR/121.0.0.0',
  chromeos:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  curl: 'curl/8.9.1',
  odd: 'SomethingElse/1.0',
}

describe('parseUserAgent()', () => {
  it.each([
    ['chromeWin', 'Chrome', 'Windows', 'desktop'],
    ['edge', 'Edge', 'Windows', 'desktop'],
    ['safariMac', 'Safari', 'macOS', 'desktop'],
    ['iphone', 'Safari', 'iOS', 'mobile'],
    ['ipad', 'Chrome', 'iOS', 'tablet'],
    ['androidPhone', 'Samsung Internet', 'Android', 'mobile'],
    ['androidTablet', 'Chrome', 'Android', 'tablet'],
    ['firefoxLinux', 'Firefox', 'Linux', 'desktop'],
    ['opera', 'Opera', 'Windows', 'desktop'],
    ['chromeos', 'Chrome', 'ChromeOS', 'desktop'],
    ['bot', 'Bot/Script', 'Outro', 'bot'],
    ['curl', 'Bot/Script', 'Outro', 'bot'],
    ['odd', 'Outro', 'Outro', 'desktop'],
  ] as const)('%s', (key, browser, os, device) => {
    expect(parseUserAgent(UA[key])).toEqual({ browser, os, device })
  })

  it('handles a missing user agent', () => {
    expect(parseUserAgent(null)).toEqual({
      browser: 'Desconhecido',
      os: 'Desconhecido',
      device: 'unknown',
    })
  })
})

describe('scrubMessage()', () => {
  it('removes e-mails, IPs and long digit runs', () => {
    expect(
      scrubMessage(
        'Usuário joao.silva+x@acme.com.br (CPF 123.456.789-09) de 200.10.1.2 e 2001:db8::1:2',
      ),
    ).toBe('Usuário [email] (CPF [n]) de [ip] e [ip]')
  })

  it('collapses whitespace and truncates', () => {
    const out = scrubMessage(`a  \n b ${'x'.repeat(300)}`)
    expect(out?.startsWith('a b x')).toBe(true)
    expect(out).toHaveLength(200)
    expect(out?.endsWith('…')).toBe(true)
  })

  it('returns null for empty input', () => {
    expect(scrubMessage(undefined)).toBeNull()
    expect(scrubMessage('   ')).toBeNull()
  })
})

describe('request context', () => {
  it('annotates only inside a request', () => {
    annotateRequest({ userId: 'u1' })
    expect(currentRequestContext()).toBeUndefined()

    const context: RequestContext = {}
    runWithRequestContext(context, () => {
      annotateRequest({ userId: 'u1', workspaceId: undefined })
      annotateRequest({ errorCode: 'FORBIDDEN' })
      expect(currentRequestContext()).toBe(context)
    })
    expect(context).toEqual({ userId: 'u1', errorCode: 'FORBIDDEN' })
  })

  it('survives awaits within the request', async () => {
    const context: RequestContext = {}
    await runWithRequestContext(context, async () => {
      await Promise.resolve()
      annotateRequest({ workspaceId: 'w1' })
    })
    expect(context.workspaceId).toBe('w1')
  })
})
