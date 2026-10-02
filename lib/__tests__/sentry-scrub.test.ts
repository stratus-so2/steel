import { describe, expect, it } from 'vitest'
import {
  maskQueryString,
  maskSensitiveText,
  maskUrl,
  scrubBreadcrumb,
  scrubEvent,
} from '@/lib/sentry/scrub'

describe('maskSensitiveText', () => {
  it('masks e-mail addresses', () => {
    expect(maskSensitiveText('falha ao enviar para ana@stratus.com.br')).toBe(
      'falha ao enviar para [email]',
    )
  })

  it('masks a bearer token', () => {
    expect(maskSensitiveText('Authorization: Bearer abc123def')).toBe(
      'Authorization: Bearer [redacted]',
    )
  })

  it('masks a JWT anywhere in the text', () => {
    expect(
      maskSensitiveText('token=eyJhbGciOiJIUzI1NiJ9.payload.signature done'),
    ).toBe('token=[jwt] done')
  })

  it('masks credentials embedded in a URL', () => {
    expect(maskSensitiveText('postgresql://root:senha@localhost:5433/steel')).toBe(
      'postgresql://[redacted]@localhost:5433/steel',
    )
  })

  it('masks a slack webhook url entirely', () => {
    expect(
      maskSensitiveText('POST https://hooks.slack.com/services/T0/B0/xyz failed'),
    ).toBe('POST [webhook] failed')
  })

  it('leaves text with nothing sensitive untouched', () => {
    expect(maskSensitiveText('ticket SD-1042 moved to resolved')).toBe(
      'ticket SD-1042 moved to resolved',
    )
  })
})

describe('maskQueryString', () => {
  it('returns an empty query unchanged', () => {
    expect(maskQueryString('')).toBe('')
  })

  it('redacts secret-looking parameters and keeps the rest', () => {
    expect(maskQueryString('?token=abc&page=2')).toBe(
      '?token=[redacted]&page=2',
    )
  })

  it('works without the leading question mark', () => {
    expect(maskQueryString('secret=x&safe=y')).toBe('secret=[redacted]&safe=y')
  })

  it('keeps a valueless parameter as it is', () => {
    expect(maskQueryString('?flag&token=abc')).toBe('?flag&token=[redacted]')
  })

  it('decodes the parameter name before matching', () => {
    expect(maskQueryString('?%74oken=abc')).toBe('?%74oken=[redacted]')
  })
})

describe('maskUrl', () => {
  it('masks both the path credentials and the query secrets', () => {
    expect(
      maskUrl('https://user:pw@steel.test/reset-password?token=abc&next=/home'),
    ).toBe('https://[redacted]@steel.test/reset-password?token=[redacted]&next=/home')
  })

  it('handles a url with no query string', () => {
    expect(maskUrl('https://steel.test/sign-in')).toBe('https://steel.test/sign-in')
  })
})

describe('scrubEvent', () => {
  it('keeps only the user id on the identity', () => {
    const event = scrubEvent({
      user: { id: 'user_1', email: 'ana@stratus.com.br', username: 'ana' },
    })
    expect(event.user).toEqual({ id: 'user_1' })
  })

  it('nulls the identity when there is no id to keep', () => {
    expect(scrubEvent({ user: { email: 'ana@stratus.com.br' } }).user).toBeNull()
  })

  it('leaves an absent user alone', () => {
    expect(scrubEvent({ user: null }).user).toBeNull()
    expect(scrubEvent({ user: undefined }).user).toBeUndefined()
  })

  it('drops the request body, cookies and env', () => {
    const event = scrubEvent({
      request: {
        data: { password: 'hunter2' },
        cookies: 'better-auth.session_token=abc',
        env: { REMOTE_ADDR: '1.2.3.4' },
      },
    })
    expect(event.request?.data).toBeUndefined()
    expect(event.request?.cookies).toBeUndefined()
    expect(event.request?.env).toBeUndefined()
  })

  it('redacts credential headers and masks the remaining ones', () => {
    const event = scrubEvent({
      request: {
        headers: {
          Cookie: 'session=abc',
          'X-Slack-Signature': 'v0=deadbeef',
          'X-Request-Id': 'req_1',
          From: 'ana@stratus.com.br',
        },
      },
    })
    expect(event.request?.headers).toEqual({
      Cookie: '[redacted]',
      'X-Slack-Signature': '[redacted]',
      'X-Request-Id': 'req_1',
      From: '[email]',
    })
  })

  it('masks the request url', () => {
    const event = scrubEvent({
      request: { url: 'https://steel.test/invite?token=abc' },
    })
    expect(event.request?.url).toBe('https://steel.test/invite?token=[redacted]')
  })

  it('masks a string query_string', () => {
    const event = scrubEvent({ request: { query_string: 'token=abc&q=open' } })
    expect(event.request?.query_string).toBe('token=[redacted]&q=open')
  })

  it('masks a tuple-array query_string', () => {
    const event = scrubEvent({
      request: {
        query_string: [
          ['token', 'abc'],
          ['email', 'ana@stratus.com.br'],
        ] as [string, string][],
      },
    })
    expect(event.request?.query_string).toEqual([
      ['token', '[redacted]'],
      ['email', '[email]'],
    ])
  })

  it('masks a record query_string', () => {
    const event = scrubEvent({
      request: { query_string: { secret: 'abc', note: 'ana@stratus.com.br' } },
    })
    expect(event.request?.query_string).toEqual({
      secret: '[redacted]',
      note: '[email]',
    })
  })

  it('leaves an unusable query_string shape alone', () => {
    const event = scrubEvent({
      request: { query_string: 42 as unknown as string },
    })
    expect(event.request?.query_string).toBe(42)
  })

  it('leaves an absent request alone', () => {
    expect(scrubEvent({ request: null }).request).toBeNull()
  })

  it('masks a string message', () => {
    expect(scrubEvent({ message: 'no user ana@stratus.com.br' }).message).toBe(
      'no user [email]',
    )
  })

  it('masks both fields of a structured message', () => {
    const event = scrubEvent({
      message: {
        message: 'login de ana@stratus.com.br',
        formatted: 'login de ana@stratus.com.br falhou',
      },
    })
    expect(event.message).toEqual({
      message: 'login de [email]',
      formatted: 'login de [email] falhou',
    })
  })

  it('leaves a structured message with neither field alone', () => {
    const event = scrubEvent({ message: {} })
    expect(event.message).toEqual({})
  })

  it('masks exception values', () => {
    const event = scrubEvent({
      exception: {
        values: [
          { value: 'duplicate ana@stratus.com.br', type: 'Error' },
          { type: 'Error' },
        ],
      },
    })
    expect(event.exception?.values?.[0]?.value).toBe('duplicate [email]')
  })

  it('tolerates an absent exception list', () => {
    expect(scrubEvent({ exception: null }).exception).toBeNull()
  })

  it('masks breadcrumb messages and urls', () => {
    const event = scrubEvent({
      breadcrumbs: [
        {
          message: 'fetch ana@stratus.com.br',
          data: { url: 'https://steel.test/a?token=abc' },
        },
        { data: null },
        {},
      ],
    })
    expect(event.breadcrumbs?.[0]?.message).toBe('fetch [email]')
    expect(event.breadcrumbs?.[0]?.data?.url).toBe(
      'https://steel.test/a?token=[redacted]',
    )
  })

  it('returns the same object reference it was given', () => {
    const event = { message: 'ok' }
    expect(scrubEvent(event)).toBe(event)
  })
})

describe('scrubBreadcrumb', () => {
  it('masks the url a fetch crumb carries', () => {
    const crumb = scrubBreadcrumb({
      category: 'fetch',
      data: { url: 'https://steel.test/reset?token=abc' },
    })
    expect(crumb?.data?.url).toBe('https://steel.test/reset?token=[redacted]')
  })

  it('masks the crumb message', () => {
    expect(
      scrubBreadcrumb({ message: 'convite para ana@stratus.com.br' })?.message,
    ).toBe('convite para [email]')
  })

  it('leaves a crumb with neither url nor message alone', () => {
    const crumb = { category: 'ui.click', data: null }
    expect(scrubBreadcrumb(crumb)).toBe(crumb)
  })

  it('ignores a non-string url', () => {
    const crumb = scrubBreadcrumb({ data: { url: 7 } })
    expect(crumb?.data?.url).toBe(7)
  })
})
