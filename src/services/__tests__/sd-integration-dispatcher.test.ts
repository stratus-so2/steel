import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdIntegration } from '@/src/__tests__/factories/sd-integration.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdIntegrationRequestFailed } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (value: string) => `enc:${value}`),
  decryptConnectionSecret: vi.fn(async (value: string) =>
    value.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/lib/servicedesk/integrations-queue', () => ({
  enqueueSdIntegrationEvent: vi.fn(),
  enqueueSdGithubStateSync: vi.fn(),
}))
vi.mock('@/src/lib/servicedesk/slack-client', () => ({
  SlackClient: { postMessage: vi.fn() },
}))
vi.mock('@/src/repositories/sd-integration.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')

import { logger } from '@/lib/axiom/logger'
import { enqueueSdIntegrationEvent } from '@/src/lib/servicedesk/integrations-queue'
import { SlackClient } from '@/src/lib/servicedesk/slack-client'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdIntegrationDispatcher } from '../sd-integration-dispatcher'

const repo = vi.mocked(SdIntegrationRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const enqueue = vi.mocked(enqueueSdIntegrationEvent)
const slack = vi.mocked(SlackClient)

const WS = 'ws1'

const CONFIGURED = {
  channels: [
    { departmentId: 'dep-1', channelId: 'C-time' },
    { departmentId: null, channelId: 'C-padrao' },
  ],
  events: ['sla.breached'],
}

const ticket = {
  id: 't1',
  number: 42,
  code: 'INC-000042',
  title: 'E-mail fora do ar',
  departmentId: 'dep-1',
}

const payload = { title: 'SLA violado', body: 'Prazo estourou' }

beforeEach(() => {
  repo.findByKind.mockResolvedValue(
    ok(createFakeSdIntegration({ config: CONFIGURED })),
  )
  repo.findById.mockResolvedValue(
    ok(createFakeSdIntegration({ config: CONFIGURED })),
  )
  repo.markError.mockResolvedValue(ok(undefined))
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: WS, name: 'Acme', slug: 'acme' }),
  )
  slack.postMessage.mockResolvedValue(ok({ channel: 'C-time', ts: '1.1' }))
})

describe('SdIntegrationDispatcher.dispatch', () => {
  it('enfileira o evento escolhido com o recorte do chamado', async () => {
    await SdIntegrationDispatcher.dispatch({
      workspaceId: WS,
      event: 'sla.breached',
      ticket,
      payload,
    })
    expect(enqueue).toHaveBeenCalledWith({
      workspaceId: WS,
      integrationId: 'int-slack-1',
      event: 'sla.breached',
      ticketId: 't1',
      payload: {
        title: 'SLA violado',
        body: 'Prazo estourou',
        ticketCode: 'INC-000042',
        ticketTitle: 'E-mail fora do ar',
        ticketNumber: 42,
        departmentId: 'dep-1',
      },
    })
  })

  it('não enfileira evento que o workspace não escolheu', async () => {
    await SdIntegrationDispatcher.dispatch({
      workspaceId: WS,
      event: 'ticket.message',
      ticket,
      payload,
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('não enfileira sem canal para o time nem canal padrão', async () => {
    repo.findByKind.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          config: {
            channels: [{ departmentId: 'dep-9', channelId: 'C9' }],
            events: ['sla.breached'],
          },
        }),
      ),
    )
    await SdIntegrationDispatcher.dispatch({
      workspaceId: WS,
      event: 'sla.breached',
      ticket,
      payload,
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('não enfileira sem integração ou com ela desconectada', async () => {
    repo.findByKind.mockResolvedValue(ok(null))
    await SdIntegrationDispatcher.dispatch({
      workspaceId: WS,
      event: 'sla.breached',
      ticket,
      payload,
    })
    repo.findByKind.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          status: 'DISCONNECTED',
          config: CONFIGURED,
        }),
      ),
    )
    await SdIntegrationDispatcher.dispatch({
      workspaceId: WS,
      event: 'sla.breached',
      ticket,
      payload,
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('erro de banco só vira log — o chamado segue', async () => {
    repo.findByKind.mockResolvedValue(err(databaseError()))
    await SdIntegrationDispatcher.dispatch({
      workspaceId: WS,
      event: 'sla.breached',
      ticket,
      payload,
    })
    expect(enqueue).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.integration.dispatch_lookup_failed',
      expect.any(Object),
    )
  })

  it('exceção inesperada não escapa (é chamado em `void`)', async () => {
    repo.findByKind.mockRejectedValue(new Error('redis caiu'))
    await expect(
      SdIntegrationDispatcher.dispatch({
        workspaceId: WS,
        event: 'sla.breached',
        ticket,
        payload,
      }),
    ).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.integration.dispatch_failed',
      expect.objectContaining({ message: 'redis caiu' }),
    )
  })
})

describe('SdIntegrationDispatcher.deliver', () => {
  const job = {
    workspaceId: WS,
    integrationId: 'int-slack-1',
    event: 'sla.breached',
    ticketId: 't1',
    payload: {
      title: 'SLA violado',
      body: 'Prazo estourou',
      ticketCode: 'INC-000042',
      ticketTitle: 'E-mail fora do ar',
      ticketNumber: 42,
      departmentId: 'dep-1',
    },
  }

  it('manda a mensagem ao canal do time com o link do chamado', async () => {
    expect(expectOk(await SdIntegrationDispatcher.deliver(job))).toBe('sent')
    expect(slack.postMessage).toHaveBeenCalledWith('xoxb-token', {
      channel: 'C-time',
      text: expect.stringContaining(
        'https://steel.test/acme/servicedesk/tickets/42',
      ),
    })
  })

  it('cai no canal padrão quando o time não tem canal', async () => {
    expectOk(
      await SdIntegrationDispatcher.deliver({
        ...job,
        payload: { ...job.payload, departmentId: null },
      }),
    )
    expect(slack.postMessage.mock.calls[0][1].channel).toBe('C-padrao')
  })

  it('usa a URL base quando o workspace não é encontrado', async () => {
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expectOk(await SdIntegrationDispatcher.deliver(job))
    expect(slack.postMessage.mock.calls[0][1].text).toContain(
      'https://steel.test|INC-000042',
    )
  })

  it('tolera erro de banco ao buscar o workspace', async () => {
    ctxRepo.findWorkspace.mockResolvedValue(err(databaseError()))
    expectOk(await SdIntegrationDispatcher.deliver(job))
    expect(slack.postMessage).toHaveBeenCalled()
  })

  it('usa a URL base quando o payload não trouxe o número', async () => {
    expectOk(
      await SdIntegrationDispatcher.deliver({
        ...job,
        payload: { ...job.payload, ticketNumber: 'quarenta e dois' },
      }),
    )
    expect(slack.postMessage.mock.calls[0][1].text).toContain(
      'https://steel.test|INC-000042',
    )
  })

  it('tolera payload ausente', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          config: { channels: [{ channelId: 'C-padrao' }], events: ['x'] },
        }),
      ),
    )
    expect(
      expectOk(
        await SdIntegrationDispatcher.deliver({
          workspaceId: WS,
          integrationId: 'int-slack-1',
          event: 'x',
        }),
      ),
    ).toBe('sent')
  })

  it('pula o que mudou entre o enfileiramento e a entrega', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          status: 'DISCONNECTED',
          config: CONFIGURED,
        }),
      ),
    )
    expect(expectOk(await SdIntegrationDispatcher.deliver(job))).toBe(
      'skipped_disconnected',
    )

    repo.findById.mockResolvedValue(
      ok(createFakeSdIntegration({ config: { ...CONFIGURED, events: [] } })),
    )
    expect(expectOk(await SdIntegrationDispatcher.deliver(job))).toBe(
      'skipped_not_selected',
    )

    repo.findById.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          config: { channels: [], events: ['sla.breached'] },
        }),
      ),
    )
    expect(expectOk(await SdIntegrationDispatcher.deliver(job))).toBe(
      'skipped_no_channel',
    )
  })

  it('recusa integração inexistente ou de outro workspace', async () => {
    repo.findById.mockResolvedValue(ok(null))
    expectErr(
      await SdIntegrationDispatcher.deliver(job),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(
      ok(createFakeSdIntegration({ workspaceId: 'outra', config: CONFIGURED })),
    )
    expectErr(
      await SdIntegrationDispatcher.deliver(job),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(await SdIntegrationDispatcher.deliver(job), 'DATABASE_ERROR')
  })

  it('token ilegível devolve SD_INTEGRATION_NOT_CONFIGURED', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          encryptedToken: '',
          config: CONFIGURED,
        }),
      ),
    )
    expectErr(
      await SdIntegrationDispatcher.deliver(job),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('erro do Slack carimba ERROR na integração e devolve o erro', async () => {
    slack.postMessage.mockResolvedValue(err(sdIntegrationRequestFailed()))
    expectErr(
      await SdIntegrationDispatcher.deliver(job),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    expect(repo.markError).toHaveBeenCalledWith(
      'int-slack-1',
      expect.any(String),
    )
  })
})
