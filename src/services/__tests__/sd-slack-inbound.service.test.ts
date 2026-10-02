import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdIntegration,
  createFakeSdIntegrationLink,
} from '@/src/__tests__/factories/sd-integration.factory'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, moduleDisabled, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

const SIGNING = 'signing-secret-de-teste'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env/env')>()),
  NEXT_PUBLIC_URL: 'https://steel.test',
}))
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (v: string) => `enc:${v}`),
  decryptConnectionSecret: vi.fn(async (v: string) => v.replace(/^enc:/, '')),
}))
vi.mock('@/src/cache/sd-integration-event.cache', () => ({
  SdIntegrationEventCache: { claim: vi.fn(), release: vi.fn() },
}))
vi.mock('@/src/lib/servicedesk/slack-client', () => ({
  getSlackAppConfig: vi.fn(),
  SlackClient: {
    postMessage: vi.fn(),
    getUser: vi.fn(),
    permalink: vi.fn(),
  },
}))
vi.mock('@/src/repositories/sd-integration.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('../authz', () => ({ assertModuleEnabled: vi.fn() }))
vi.mock('../sd-automation-engine', () => ({
  fireSdAutomations: vi.fn(async () => undefined),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: {
    loadConfig: vi.fn(),
    create: vi.fn(),
    touchActivity: vi.fn(),
  },
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))

import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import {
  getSlackAppConfig,
  SlackClient,
} from '@/src/lib/servicedesk/slack-client'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { assertModuleEnabled } from '../authz'
import { fireSdAutomations } from '../sd-automation-engine'
import { SdSlackInboundService } from '../sd-slack-inbound.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'

const repo = vi.mocked(SdIntegrationRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const cache = vi.mocked(SdIntegrationEventCache)
const slack = vi.mocked(SlackClient)
const engine = vi.mocked(SdTicketEngine)
const moduleEnabled = vi.mocked(assertModuleEnabled)

const NOW = 1_790_000_000_000
const TS = String(Math.floor(NOW / 1000))

const CONFIG = {
  settings: createFakeSdSettings(),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
}

function sign(body: string, timestamp = TS): string {
  return `v0=${createHmac('sha256', SIGNING)
    .update(`v0:${timestamp}:${body}`, 'utf8')
    .digest('hex')}`
}

function jsonCall(body: unknown, timestamp = TS) {
  const rawBody = JSON.stringify(body)
  return {
    rawBody,
    signature: sign(rawBody, timestamp),
    timestamp,
    contentType: 'application/json',
    now: NOW,
  }
}

function formCall(fields: Record<string, string>, timestamp = TS) {
  const rawBody = new URLSearchParams(fields).toString()
  return {
    rawBody,
    signature: sign(rawBody, timestamp),
    timestamp,
    contentType: 'application/x-www-form-urlencoded; charset=utf-8',
    now: NOW,
  }
}

const slackIntegration = (config: Record<string, unknown> = {}) =>
  createFakeSdIntegration({
    config: {
      channels: [{ departmentId: null, channelId: 'C1' }],
      events: [],
      ...config,
    },
  })

beforeEach(() => {
  vi.mocked(getSlackAppConfig).mockReturnValue({
    clientId: 'id',
    clientSecret: 'secret',
    signingSecret: SIGNING,
    redirectUri: 'https://steel.test/cb',
    eventsUrl: 'https://steel.test/ev',
  })
  cache.claim.mockResolvedValue(true)
  cache.release.mockResolvedValue(undefined)
  moduleEnabled.mockResolvedValue(ok(true as never))
  repo.findByExternalId.mockResolvedValue(ok(slackIntegration()))
  repo.findSlackThread.mockResolvedValue(ok(null))
  repo.createLink.mockResolvedValue(ok(createFakeSdIntegrationLink()))
  repo.createTicketMessage.mockResolvedValue(ok({ id: 'msg-1' }))
  repo.findWorkspaceUserByEmail.mockResolvedValue(ok(null))
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: 'ws1', name: 'Acme', slug: 'acme' }),
  )
  engine.loadConfig.mockResolvedValue(ok(CONFIG))
  engine.create.mockResolvedValue(
    ok(createFakeSdTicket({ id: 't1', number: 42, type: 'INCIDENT' })),
  )
  engine.touchActivity.mockResolvedValue(ok(undefined as never))
  slack.postMessage.mockResolvedValue(ok({ channel: 'C1', ts: '1.2' }))
  slack.permalink.mockResolvedValue('https://slack.test/p/1')
  slack.getUser.mockResolvedValue(
    ok({ id: 'U1', name: 'Ana', email: null, isBot: false }),
  )
})

describe('assinatura', () => {
  it('recusa quando o app do Slack não está configurado', async () => {
    vi.mocked(getSlackAppConfig).mockReturnValue(null)
    expectErr(
      await SdSlackInboundService.handle(
        jsonCall({ type: 'url_verification' }),
      ),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('aceita a assinatura correta e responde o challenge', async () => {
    const result = expectOk(
      await SdSlackInboundService.handle(
        jsonCall({ type: 'url_verification', challenge: 'abc' }),
      ),
    )
    expect(result).toEqual({ outcome: 'challenge', challenge: 'abc' })
  })

  it('recusa assinatura inválida', async () => {
    const call = jsonCall({ type: 'url_verification', challenge: 'abc' })
    const error = expectErr(
      await SdSlackInboundService.handle({ ...call, signature: 'v0=dead' }),
      'SD_INTEGRATION_SIGNATURE_INVALID',
    )
    expect(error.message).toContain('inválida')
  })

  it('recusa timestamp velho (replay)', async () => {
    const stale = String(Math.floor(NOW / 1000) - 3600)
    const error = expectErr(
      await SdSlackInboundService.handle(
        jsonCall({ type: 'url_verification', challenge: 'abc' }, stale),
      ),
      'SD_INTEGRATION_SIGNATURE_INVALID',
    )
    expect(error.message).toContain('5 minutos')
  })

  it('recusa corpo que não é JSON nem formulário reconhecível', async () => {
    const rawBody = 'nao-e-json'
    expectErr(
      await SdSlackInboundService.handle({
        rawBody,
        signature: sign(rawBody),
        timestamp: TS,
        contentType: 'application/json',
        now: NOW,
      }),
      'VALIDATION_ERROR',
    )
  })

  it('recusa url_verification sem challenge e payload de atalho ilegível', async () => {
    expectErr(
      await SdSlackInboundService.handle(
        jsonCall({ type: 'url_verification' }),
      ),
      'VALIDATION_ERROR',
    )
    expectErr(
      await SdSlackInboundService.handle(formCall({ payload: '{quebrado' })),
      'VALIDATION_ERROR',
    )
  })

  it('ignora envelope JSON de outro tipo', async () => {
    expect(
      expectOk(
        await SdSlackInboundService.handle(
          jsonCall({ type: 'app_rate_limited' }),
        ),
      ).outcome,
    ).toBe('ignored')
  })
})

describe('resposta na thread → histórico do chamado', () => {
  const reply = (overrides: Record<string, unknown> = {}) =>
    jsonCall({
      type: 'event_callback',
      team_id: 'T0001',
      event_id: 'Ev1',
      event: {
        type: 'message',
        channel: 'C1',
        user: 'U1',
        text: 'Já resolvi',
        ts: '1700000000.000200',
        thread_ts: '1700000000.000100',
        ...overrides,
      },
    })

  beforeEach(() => {
    repo.findByExternalId.mockResolvedValue(
      ok(slackIntegration({ mirrorThreadReplies: true })),
    )
    repo.findSlackThread.mockResolvedValue(
      ok(
        createFakeSdIntegrationLink({
          kind: 'SLACK_THREAD',
          externalKey: 'C1:1700000000.000100',
          ticketId: 't1',
        }),
      ),
    )
  })

  it('grava a mensagem como autor externo quando o e-mail não casa', async () => {
    expect(expectOk(await SdSlackInboundService.handle(reply())).outcome).toBe(
      'message_mirrored',
    )
    expect(repo.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 't1',
        authorKind: 'SYSTEM',
        authorUserId: null,
      }),
    )
    const [{ body }] = repo.createTicketMessage.mock.calls[0]
    expect(body).toContain('Ana')
    expect(body).toContain('usuário externo')
    expect(engine.touchActivity).toHaveBeenCalledWith('t1')
    expect(fireSdAutomations).toHaveBeenCalledWith('MESSAGE_RECEIVED', 't1')
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'message.posted' }),
    )
  })

  it('casa o autor com a conta do Steel pelo e-mail', async () => {
    slack.getUser.mockResolvedValue(
      ok({ id: 'U1', name: 'Ana', email: 'ana@acme.test', isBot: false }),
    )
    repo.findWorkspaceUserByEmail.mockResolvedValue(ok({ id: 'u9' }))
    expectOk(await SdSlackInboundService.handle(reply()))
    expect(repo.findWorkspaceUserByEmail).toHaveBeenCalledWith(
      'ws1',
      'ana@acme.test',
    )
    expect(repo.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({ authorKind: 'AGENT', authorUserId: 'u9' }),
    )
  })

  it('segue sem o autor quando o Slack recusa users.info', async () => {
    slack.getUser.mockResolvedValue(err(databaseError()))
    expect(expectOk(await SdSlackInboundService.handle(reply())).outcome).toBe(
      'message_mirrored',
    )
    const [{ body }] = repo.createTicketMessage.mock.calls[0]
    expect(body).toContain('usuário do Slack')
    expect(repo.findWorkspaceUserByEmail).not.toHaveBeenCalled()
  })

  it('e-mail sem conta correspondente segue como autor externo', async () => {
    slack.getUser.mockResolvedValue(
      ok({ id: 'U1', name: 'Ana', email: 'ana@fora.test', isBot: false }),
    )
    repo.findWorkspaceUserByEmail.mockResolvedValue(ok(null))
    expectOk(await SdSlackInboundService.handle(reply()))
    expect(repo.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({ authorKind: 'SYSTEM', authorUserId: null }),
    )
  })

  it('resposta sem texto vira mensagem com o aviso de conteúdo vazio', async () => {
    expectOk(await SdSlackInboundService.handle(reply({ text: undefined })))
    const [{ body }] = repo.createTicketMessage.mock.calls[0]
    expect(body).toContain('(mensagem sem texto)')
  })

  it('tolera falha ao casar o e-mail', async () => {
    slack.getUser.mockResolvedValue(
      ok({ id: 'U1', name: 'Ana', email: 'ana@acme.test', isBot: false }),
    )
    repo.findWorkspaceUserByEmail.mockResolvedValue(err(databaseError()))
    expectOk(await SdSlackInboundService.handle(reply()))
    expect(repo.createTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({ authorUserId: null }),
    )
  })

  it('é idempotente: a reentrega do Slack não duplica a mensagem', async () => {
    cache.claim.mockResolvedValue(false)
    expect(expectOk(await SdSlackInboundService.handle(reply())).outcome).toBe(
      'duplicate',
    )
    expect(repo.createTicketMessage).not.toHaveBeenCalled()
  })

  it('libera a trava quando o processamento falha', async () => {
    repo.createTicketMessage.mockResolvedValue(err(databaseError()))
    expectErr(await SdSlackInboundService.handle(reply()), 'DATABASE_ERROR')
    expect(cache.release).toHaveBeenCalledWith('slack', 'Ev1')
  })

  it.each([
    ['mensagem-raiz da thread', { ts: '1700000000.000100' }],
    ['mensagem fora de thread', { thread_ts: undefined }],
    ['aviso do próprio bot', { bot_id: 'B1' }],
    ['edição/remoção (subtype)', { subtype: 'message_changed' }],
    ['evento sem autor', { user: undefined }],
  ])('ignora %s', async (_label, overrides) => {
    expect(
      expectOk(await SdSlackInboundService.handle(reply(overrides))).outcome,
    ).toBe('ignored')
    expect(repo.createTicketMessage).not.toHaveBeenCalled()
  })

  it('ignora mensagem de usuário que é bot', async () => {
    slack.getUser.mockResolvedValue(
      ok({ id: 'U1', name: 'Bot', email: null, isBot: true }),
    )
    expect(expectOk(await SdSlackInboundService.handle(reply())).outcome).toBe(
      'ignored',
    )
  })

  it('ignora thread que não pertence a nenhum chamado', async () => {
    repo.findSlackThread.mockResolvedValue(ok(null))
    expect(expectOk(await SdSlackInboundService.handle(reply())).outcome).toBe(
      'ignored',
    )
  })

  it('ignora quando o espelhamento está desligado', async () => {
    repo.findByExternalId.mockResolvedValue(
      ok(slackIntegration({ mirrorThreadReplies: false })),
    )
    expect(expectOk(await SdSlackInboundService.handle(reply())).outcome).toBe(
      'ignored',
    )
  })

  it('propaga erro de banco na thread e no token ilegível', async () => {
    repo.findSlackThread.mockResolvedValue(err(databaseError()))
    expectErr(await SdSlackInboundService.handle(reply()), 'DATABASE_ERROR')

    repo.findSlackThread.mockResolvedValue(
      ok(createFakeSdIntegrationLink({ kind: 'SLACK_THREAD' })),
    )
    repo.findByExternalId.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          encryptedToken: '',
          config: { mirrorThreadReplies: true },
        }),
      ),
    )
    expectErr(
      await SdSlackInboundService.handle(reply()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('ignora evento sem time, sem event ou de outro tipo', async () => {
    expect(
      expectOk(
        await SdSlackInboundService.handle(
          jsonCall({ type: 'event_callback', event: { type: 'message' } }),
        ),
      ).outcome,
    ).toBe('ignored')
    expect(
      expectOk(
        await SdSlackInboundService.handle(
          jsonCall({ type: 'event_callback', team_id: 'T0001' }),
        ),
      ).outcome,
    ).toBe('ignored')
    expect(
      expectOk(
        await SdSlackInboundService.handle(
          jsonCall({
            type: 'event_callback',
            team_id: 'T0001',
            event: { type: 'reaction_added' },
          }),
        ),
      ).outcome,
    ).toBe('ignored')
  })

  it('usa o canal e o ts como chave quando falta o event_id', async () => {
    const rawBody = JSON.stringify({
      type: 'event_callback',
      team_id: 'T0001',
      event: {
        type: 'message',
        channel: 'C1',
        user: 'U1',
        text: 'oi',
        ts: '2',
        thread_ts: '1',
      },
    })
    expectOk(
      await SdSlackInboundService.handle({
        rawBody,
        signature: sign(rawBody),
        timestamp: TS,
        contentType: 'application/json',
        now: NOW,
      }),
    )
    expect(cache.claim).toHaveBeenCalledWith('slack', 'C1:2')
  })
})

describe('integração do time do Slack', () => {
  const call = () =>
    jsonCall({
      type: 'event_callback',
      team_id: 'T0001',
      event_id: 'Ev1',
      event: {
        type: 'message',
        channel: 'C1',
        ts: '2',
        thread_ts: '1',
        user: 'U1',
      },
    })

  it('recusa workspace do Slack não conectado ou desconectado', async () => {
    repo.findByExternalId.mockResolvedValue(ok(null))
    expectErr(
      await SdSlackInboundService.handle(call()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    repo.findByExternalId.mockResolvedValue(
      ok(createFakeSdIntegration({ status: 'DISCONNECTED' })),
    )
    expectErr(
      await SdSlackInboundService.handle(call()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('recusa quando o módulo está desabilitado e propaga erro de banco', async () => {
    moduleEnabled.mockResolvedValue(err(moduleDisabled('SERVICE_DESK')))
    expectErr(await SdSlackInboundService.handle(call()), 'MODULE_DISABLED')
    moduleEnabled.mockResolvedValue(ok(true as never))
    repo.findByExternalId.mockResolvedValue(err(databaseError()))
    expectErr(await SdSlackInboundService.handle(call()), 'DATABASE_ERROR')
  })
})

describe('abrir chamado pelo atalho de mensagem', () => {
  const shortcut = (message: Record<string, unknown> = {}) =>
    formCall({
      payload: JSON.stringify({
        type: 'message_action',
        callback_id: 'abrir_chamado',
        trigger_id: 'Tr1',
        team: { id: 'T0001' },
        user: { id: 'U9' },
        channel: { id: 'C1', name: 'suporte' },
        message: {
          ts: '1700000000.000100',
          text: 'Servidor fora do ar\ndetalhes',
          user: 'U1',
          ...message,
        },
      }),
    })

  beforeEach(() => {
    repo.findByExternalId.mockResolvedValue(
      ok(
        slackIntegration({
          allowTicketFromMessage: true,
          ticketType: 'INCIDENT',
          departmentId: 'dep-1',
        }),
      ),
    )
  })

  it('abre o chamado, responde na thread e grava o vínculo', async () => {
    const result = expectOk(await SdSlackInboundService.handle(shortcut()))
    expect(result.outcome).toBe('ticket_created')
    expect(result.ticketCode).toBe('INC-000042')

    expect(engine.create).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({
        type: 'INCIDENT',
        title: 'Servidor fora do ar',
        channel: 'API',
        departmentId: 'dep-1',
      }),
      { kind: 'system', source: 'slack' },
      CONFIG,
    )
    expect(slack.postMessage).toHaveBeenCalledWith('xoxb-token', {
      channel: 'C1',
      text: expect.stringContaining('INC-000042'),
      threadTs: '1700000000.000100',
    })
    expect(repo.createLink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'SLACK_THREAD',
        externalKey: 'C1:1700000000.000100',
        externalUrl: 'https://slack.test/p/1',
        ticketId: 't1',
      }),
    )
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'integration.ticket_from_slack' }),
    )
  })

  it('abre sem departamento quando a integração não define um', async () => {
    repo.findByExternalId.mockResolvedValue(
      ok(slackIntegration({ allowTicketFromMessage: true })),
    )
    expectOk(await SdSlackInboundService.handle(shortcut()))
    expect(engine.create.mock.calls[0][1]).not.toHaveProperty('departmentId')
  })

  it('recusa atalho de um workspace do Slack não conectado', async () => {
    repo.findByExternalId.mockResolvedValue(ok(null))
    expectErr(
      await SdSlackInboundService.handle(shortcut()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    expect(cache.claim).not.toHaveBeenCalled()
  })

  it('ignora quando a abertura por mensagem está desligada', async () => {
    repo.findByExternalId.mockResolvedValue(
      ok(slackIntegration({ allowTicketFromMessage: false })),
    )
    expect(
      expectOk(await SdSlackInboundService.handle(shortcut())).outcome,
    ).toBe('ignored')
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('é idempotente por trigger_id', async () => {
    cache.claim.mockResolvedValue(false)
    expect(
      expectOk(await SdSlackInboundService.handle(shortcut())).outcome,
    ).toBe('duplicate')
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('libera a trava e propaga quando o motor recusa', async () => {
    engine.create.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdSlackInboundService.handle(shortcut()),
      'SD_TICKET_NOT_FOUND',
    )
    expect(cache.release).toHaveBeenCalledWith('slack', 'Tr1')
  })

  it('propaga erro de configuração do motor e token ilegível', async () => {
    engine.loadConfig.mockResolvedValue(err(databaseError()))
    expectErr(await SdSlackInboundService.handle(shortcut()), 'DATABASE_ERROR')

    engine.loadConfig.mockResolvedValue(ok(CONFIG))
    repo.findByExternalId.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          encryptedToken: '',
          config: { allowTicketFromMessage: true },
        }),
      ),
    )
    expectErr(
      await SdSlackInboundService.handle(shortcut()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('segue mesmo quando o autor, o permalink e o vínculo falham', async () => {
    slack.getUser.mockResolvedValue(err(databaseError()))
    slack.permalink.mockResolvedValue(null)
    repo.createLink.mockResolvedValue(err(databaseError()))
    expect(
      expectOk(await SdSlackInboundService.handle(shortcut())).outcome,
    ).toBe('ticket_created')
  })

  it('abre sem autor conhecido quando a mensagem não tem `user`', async () => {
    const rawBody = new URLSearchParams({
      payload: JSON.stringify({
        type: 'message_action',
        trigger_id: 'Tr2',
        team: { id: 'T0001' },
        channel: { id: 'C1' },
        message: { ts: '1', text: 'texto' },
      }),
    }).toString()
    expectOk(
      await SdSlackInboundService.handle({
        rawBody,
        signature: sign(rawBody),
        timestamp: TS,
        contentType: 'application/x-www-form-urlencoded',
        now: NOW,
      }),
    )
    expect(slack.getUser).not.toHaveBeenCalled()
  })

  it('ignora interatividade que não é atalho de mensagem', async () => {
    expect(
      expectOk(
        await SdSlackInboundService.handle(
          formCall({ payload: JSON.stringify({ type: 'block_actions' }) }),
        ),
      ).outcome,
    ).toBe('ignored')
  })

  it('recusa atalho sem time, canal ou mensagem', async () => {
    expectErr(
      await SdSlackInboundService.handle(
        formCall({
          payload: JSON.stringify({
            type: 'message_action',
            channel: { id: 'C1' },
            message: { ts: '1' },
          }),
        }),
      ),
      'VALIDATION_ERROR',
    )
  })
})

describe('abrir chamado pelo slash command', () => {
  const command = (fields: Record<string, string> = {}) =>
    formCall({
      team_id: 'T0001',
      channel_id: 'C1',
      channel_name: 'suporte',
      user_id: 'U9',
      text: 'Impressora travada',
      trigger_id: 'Tr9',
      command: '/chamado',
      ...fields,
    })

  beforeEach(() => {
    repo.findByExternalId.mockResolvedValue(
      ok(slackIntegration({ allowTicketFromMessage: true })),
    )
  })

  it('abre o chamado e usa a resposta como raiz da thread', async () => {
    const result = expectOk(await SdSlackInboundService.handle(command()))
    expect(result.outcome).toBe('ticket_created')
    expect(slack.permalink).not.toHaveBeenCalled()
    expect(slack.postMessage).toHaveBeenCalledWith('xoxb-token', {
      channel: 'C1',
      text: expect.stringContaining('INC-000042'),
    })
    expect(repo.createLink).toHaveBeenCalledWith(
      expect.objectContaining({ externalKey: 'C1:1.2' }),
    )
  })

  it('recusa comando de um workspace do Slack não conectado', async () => {
    repo.findByExternalId.mockResolvedValue(ok(null))
    expectErr(
      await SdSlackInboundService.handle(command()),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    expect(cache.claim).not.toHaveBeenCalled()
  })

  it('não grava thread quando a resposta no canal falha', async () => {
    slack.postMessage.mockResolvedValue(err(databaseError()))
    expectOk(await SdSlackInboundService.handle(command()))
    expect(repo.createLink).not.toHaveBeenCalled()
  })

  it('não grava thread quando o Slack responde sem ts', async () => {
    slack.postMessage.mockResolvedValue(ok({ channel: 'C1', ts: '' }))
    expectOk(await SdSlackInboundService.handle(command()))
    expect(repo.createLink).not.toHaveBeenCalled()
  })

  it('é idempotente e libera a trava na falha', async () => {
    cache.claim.mockResolvedValue(false)
    expect(
      expectOk(await SdSlackInboundService.handle(command())).outcome,
    ).toBe('duplicate')
    cache.claim.mockResolvedValue(true)
    engine.create.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdSlackInboundService.handle(command()),
      'SD_TICKET_NOT_FOUND',
    )
    expect(cache.release).toHaveBeenCalledWith('slack', 'Tr9')
  })

  it('usa canal e texto como chave quando falta trigger_id', async () => {
    expectOk(await SdSlackInboundService.handle(command({ trigger_id: '' })))
    expect(cache.claim).toHaveBeenCalledWith('slack', 'C1:Impressora travada')
  })

  it('aceita comando sem texto (título padrão)', async () => {
    expectOk(await SdSlackInboundService.handle(command({ text: '' })))
    expect(engine.create.mock.calls[0][1].title).toBe(
      'Chamado aberto pelo Slack',
    )
  })

  it('recusa formulário sem time ou sem canal', async () => {
    expectErr(
      await SdSlackInboundService.handle(formCall({ channel_id: 'C1' })),
      'VALIDATION_ERROR',
    )
    expectErr(
      await SdSlackInboundService.handle(formCall({ team_id: 'T0001' })),
      'VALIDATION_ERROR',
    )
  })

  it('usa a URL base quando o workspace não é encontrado', async () => {
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expectOk(await SdSlackInboundService.handle(command()))
    expect(slack.postMessage.mock.calls[0][1].text).toContain(
      'https://steel.test|INC-000042',
    )
  })
})
