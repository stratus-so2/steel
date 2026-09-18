import { describe, expect, it } from 'vitest'
import {
  buildCrmUnsubscribeHeaders,
  buildCrmUnsubscribeUrls,
  createCrmUnsubscribeToken,
  verifyCrmUnsubscribeToken,
  withCrmUnsubscribeFooter,
} from '../crm-email-unsubscribe'

describe('crm-email-unsubscribe token', () => {
  it('should round-trip the recipient id', () => {
    const token = createCrmUnsubscribeToken('rcpt_123')
    const verified = verifyCrmUnsubscribeToken(token)
    expect(verified.ok).toBe(true)
    if (verified.ok) expect(verified.value).toBe('rcpt_123')
  })

  it('should be url-safe and signed, not just encoded', () => {
    const token = createCrmUnsubscribeToken('rcpt_123')
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{40,}$/)
    expect(token).not.toContain('rcpt_123')
  })

  it('should reject a token whose payload was swapped', () => {
    const [, signature] = createCrmUnsubscribeToken('rcpt_123').split('.')
    const forged = `${Buffer.from('rcpt_999').toString('base64url')}.${signature}`
    expect(verifyCrmUnsubscribeToken(forged).ok).toBe(false)
  })

  it.each([
    '',
    'abc',
    'a.b.c',
    'payload.',
  ])('should reject malformed token %j', (token) => {
    expect(verifyCrmUnsubscribeToken(token).ok).toBe(false)
  })
})

describe('crm-email-unsubscribe headers and footer', () => {
  it('should build RFC 8058 one-click headers pointing at the API route', () => {
    const urls = buildCrmUnsubscribeUrls('https://app.test/', 'tok.sig')
    expect(urls.oneClickUrl).toBe(
      'https://app.test/api/crm/unsubscribe/tok.sig',
    )
    expect(urls.pageUrl).toBe('https://app.test/unsubscribe/tok.sig')

    const headers = buildCrmUnsubscribeHeaders(urls)
    expect(headers['List-Unsubscribe']).toBe(
      '<https://app.test/api/crm/unsubscribe/tok.sig>',
    )
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('should append the footer inside <body> when present', () => {
    const html = withCrmUnsubscribeFooter(
      '<html><body><p>Oi</p></body></html>',
      'https://app.test/unsubscribe/tok.sig',
    )
    expect(html).toMatch(
      /<p>Oi<\/p>[\s\S]*href="https:\/\/app\.test\/unsubscribe\/tok\.sig"[\s\S]*<\/body><\/html>$/,
    )
    expect(html).toContain('descadastrar')
  })

  it('should append the footer at the end of a fragment', () => {
    const html = withCrmUnsubscribeFooter('<p>Oi</p>', 'https://x/u/t')
    expect(html.startsWith('<p>Oi</p>')).toBe(true)
    expect(html).toContain('href="https://x/u/t"')
  })
})
