import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env/server')>()),
  BETTER_AUTH_URL: 'https://steel.test/',
  SLACK_CLIENT_ID: 'client-id',
  SLACK_CLIENT_SECRET: 'client-secret',
  SLACK_SIGNING_SECRET: 'signing-secret',
}))

import { logger } from '@/lib/axiom/logger'
import {
  getSlackAppConfig,
  isSlackConfigured,
  SLACK_BOT_SCOPES,
  SlackClient,
  slackAuthorizeUrl,
} from '@/src/lib/servicedesk/slack-client'

const fetchMock = vi.fn()

function reply(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

const APP = getSlackAppConfig()
if (!APP) throw new Error('app do Slack deveria estar configurado no teste')

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getSlackAppConfig', () => {
  it('monta as URLs fixas a partir da BETTER_AUTH_URL, sem barra dupla', () => {
    expect(APP.redirectUri).toBe(
      'https://steel.test/api/servicedesk/integrations/oauth/slack',
    )
    expect(APP.eventsUrl).toBe(
      'https://steel.test/api/servicedesk/integrations/slack',
    )
    expect(isSlackConfigured()).toBe(true)
  })

  it('a URL de autorização leva os escopos e o state', () => {
    const url = new URL(slackAuthorizeUrl(APP, 'state-123'))
    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/v2/authorize')
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('scope')).toBe(SLACK_BOT_SCOPES.join(','))
    expect(url.searchParams.get('redirect_uri')).toBe(APP.redirectUri)
  })
})

describe('SlackClient.exchangeCode', () => {
  it('devolve o token do bot e o time', async () => {
    fetchMock.mockResolvedValue(
      reply({
        ok: true,
        access_token: 'xoxb-1',
        bot_user_id: 'B1',
        team: { id: 'T1', name: 'Stratus' },
      }),
    )
    expect(expectOk(await SlackClient.exchangeCode(APP, 'code'))).toEqual({
      accessToken: 'xoxb-1',
      teamId: 'T1',
      teamName: 'Stratus',
      botUserId: 'B1',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://slack.com/api/oauth.v2.access')
    expect(String(init.body)).toContain('code=code')
  })

  it('recusa resposta sem token ou sem time', async () => {
    fetchMock.mockResolvedValue(reply({ ok: true, team: { id: 'T1' } }))
    expectErr(
      await SlackClient.exchangeCode(APP, 'code'),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    fetchMock.mockResolvedValue(reply({ ok: true, access_token: 'xoxb' }))
    expectErr(
      await SlackClient.exchangeCode(APP, 'code'),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
  })

  it('traduz a recusa do Slack sem vazar o code', async () => {
    fetchMock.mockResolvedValue(reply({ ok: false, error: 'invalid_code' }))
    const error = expectErr(
      await SlackClient.exchangeCode(APP, 'code-secreto'),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    expect(error.message).toContain('invalid_code')
    expect(JSON.stringify(vi.mocked(logger).warn.mock.calls)).not.toContain(
      'code-secreto',
    )
  })

  it('traduz o status HTTP quando o corpo não é JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)
    expect(
      expectErr(
        await SlackClient.exchangeCode(APP, 'code'),
        'SD_INTEGRATION_REQUEST_FAILED',
      ).message,
    ).toContain('503')
  })

  it('erro de rede devolve Result, não exceção', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'))
    expect(
      expectErr(
        await SlackClient.exchangeCode(APP, 'code'),
        'SD_INTEGRATION_REQUEST_FAILED',
      ).message,
    ).toContain('não respondeu')
  })
})

describe('SlackClient.postMessage', () => {
  it('posta no canal e devolve o ts', async () => {
    fetchMock.mockResolvedValue(reply({ ok: true, channel: 'C1', ts: '1.2' }))
    expect(
      expectOk(
        await SlackClient.postMessage('xoxb', { channel: 'C1', text: 'oi' }),
      ),
    ).toEqual({ channel: 'C1', ts: '1.2' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer xoxb')
    expect(JSON.parse(String(init.body))).toEqual({
      channel: 'C1',
      text: 'oi',
      unfurl_links: false,
    })
  })

  it('posta na thread quando informada', async () => {
    fetchMock.mockResolvedValue(reply({ ok: true }))
    const posted = expectOk(
      await SlackClient.postMessage('xoxb', {
        channel: 'C1',
        text: 'oi',
        threadTs: '1.1',
      }),
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).thread_ts).toBe(
      '1.1',
    )
    // Sem `ts` na resposta, devolve vazio (quem chama decide o que fazer).
    expect(posted).toEqual({ channel: 'C1', ts: '' })
  })

  it('propaga a recusa do Slack', async () => {
    fetchMock.mockResolvedValue(reply({ ok: false, error: 'channel_not_found' }))
    expectErr(
      await SlackClient.postMessage('xoxb', { channel: 'C1', text: 'oi' }),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
  })
})

describe('SlackClient.getUser', () => {
  it('prefere o nome do perfil e traz o e-mail', async () => {
    fetchMock.mockResolvedValue(
      reply({
        ok: true,
        user: {
          id: 'U1',
          name: 'ana',
          real_name: 'Ana',
          is_bot: false,
          profile: { real_name: 'Ana Souza', email: 'ana@acme.test' },
        },
      }),
    )
    expect(expectOk(await SlackClient.getUser('xoxb', 'U1'))).toEqual({
      id: 'U1',
      name: 'Ana Souza',
      email: 'ana@acme.test',
      isBot: false,
    })
  })

  it('cai para real_name, para name e para o id', async () => {
    fetchMock.mockResolvedValue(
      reply({ ok: true, user: { id: 'U1', real_name: 'Ana' } }),
    )
    expect(expectOk(await SlackClient.getUser('xoxb', 'U1')).name).toBe('Ana')

    fetchMock.mockResolvedValue(reply({ ok: true, user: { name: 'ana' } }))
    expect(expectOk(await SlackClient.getUser('xoxb', 'U1')).name).toBe('ana')

    fetchMock.mockResolvedValue(reply({ ok: true }))
    const bare = expectOk(await SlackClient.getUser('xoxb', 'U1'))
    expect(bare).toEqual({ id: 'U1', name: 'U1', email: null, isBot: false })
  })

  it('marca o bot', async () => {
    fetchMock.mockResolvedValue(
      reply({ ok: true, user: { id: 'B1', name: 'bot', is_bot: true } }),
    )
    expect(expectOk(await SlackClient.getUser('xoxb', 'B1')).isBot).toBe(true)
  })

  it('propaga a recusa', async () => {
    fetchMock.mockResolvedValue(reply({ ok: false, error: 'user_not_found' }))
    expectErr(
      await SlackClient.getUser('xoxb', 'U1'),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
  })
})

describe('SlackClient.listChannels', () => {
  it('ordena, descarta canal sem id/nome e marca privado', async () => {
    fetchMock.mockResolvedValue(
      reply({
        ok: true,
        channels: [
          { id: 'C2', name: 'suporte', is_private: true },
          { id: 'C1', name: 'geral' },
          { id: 'C3' },
          { name: 'sem-id' },
        ],
      }),
    )
    expect(expectOk(await SlackClient.listChannels('xoxb'))).toEqual([
      { id: 'C1', name: 'geral', isPrivate: false },
      { id: 'C2', name: 'suporte', isPrivate: true },
    ])
  })

  it('aceita resposta sem canais e propaga a recusa', async () => {
    fetchMock.mockResolvedValue(reply({ ok: true }))
    expect(expectOk(await SlackClient.listChannels('xoxb'))).toEqual([])
    fetchMock.mockResolvedValue(reply({ ok: false, error: 'missing_scope' }))
    expectErr(
      await SlackClient.listChannels('xoxb'),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
  })
})

describe('SlackClient.permalink', () => {
  it('devolve o link, ou null quando não vem e quando o Slack recusa', async () => {
    fetchMock.mockResolvedValue(
      reply({ ok: true, permalink: 'https://slack.test/p/1' }),
    )
    expect(
      await SlackClient.permalink('xoxb', { channel: 'C1', ts: '1.1' }),
    ).toBe('https://slack.test/p/1')

    fetchMock.mockResolvedValue(reply({ ok: true }))
    expect(
      await SlackClient.permalink('xoxb', { channel: 'C1', ts: '1.1' }),
    ).toBeNull()

    fetchMock.mockResolvedValue(reply({ ok: false, error: 'not_in_channel' }))
    expect(
      await SlackClient.permalink('xoxb', { channel: 'C1', ts: '1.1' }),
    ).toBeNull()
  })
})
