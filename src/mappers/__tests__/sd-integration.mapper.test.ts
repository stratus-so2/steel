import { describe, expect, it } from 'vitest'
import {
  createFakeSdGithubIntegration,
  createFakeSdIntegration,
  createFakeSdIntegrationLink,
} from '@/src/__tests__/factories/sd-integration.factory'
import {
  toSdIntegrationDTO,
  toSdIntegrationLinkDTO,
} from '../sd-integration.mapper'

describe('toSdIntegrationDTO', () => {
  it('nunca expõe o token nem o segredo, só se existe segredo', () => {
    const dto = toSdIntegrationDTO(
      createFakeSdGithubIntegration({
        encryptedToken: 'enc:super-secreto',
        encryptedSigningSecret: 'enc:hook',
      }),
    )
    expect(dto.hasWebhookSecret).toBe(true)
    expect(JSON.stringify(dto)).not.toContain('super-secreto')
    expect(JSON.stringify(dto)).not.toContain('enc:hook')
    expect(dto).not.toHaveProperty('encryptedToken')
    expect(dto).not.toHaveProperty('encryptedSigningSecret')
  })

  it('traz a configuração do Slack e deixa a do GitHub nula', () => {
    const dto = toSdIntegrationDTO(
      createFakeSdIntegration({
        config: {
          channels: [{ departmentId: null, channelId: 'C1' }],
          events: ['sla.breached'],
          ticketType: 'PROBLEM',
        },
      }),
    )
    expect(dto.kind).toBe('SLACK')
    expect(dto.github).toBeNull()
    expect(dto.slack).toEqual({
      channels: [{ departmentId: null, channelId: 'C1', channelName: null }],
      events: ['sla.breached'],
      allowTicketFromMessage: true,
      mirrorThreadReplies: true,
      ticketType: 'PROBLEM',
      departmentId: null,
    })
    expect(dto.hasWebhookSecret).toBe(false)
  })

  it('traz a configuração do GitHub e deixa a do Slack nula', () => {
    const dto = toSdIntegrationDTO(
      createFakeSdGithubIntegration({
        status: 'ERROR',
        statusError: 'token sem acesso',
        config: { suggestPhaseOnClose: false, allowIssueFromTicket: false },
      }),
    )
    expect(dto.slack).toBeNull()
    expect(dto.github).toEqual({
      suggestPhaseOnClose: false,
      allowIssueFromTicket: false,
    })
    expect(dto.status).toBe('ERROR')
    expect(dto.statusError).toBe('token sem acesso')
    expect(dto.externalId).toBe('stratus-so2/steel')
  })

  it('serializa as datas em ISO', () => {
    const dto = toSdIntegrationDTO(createFakeSdIntegration())
    expect(dto.createdAt).toBe('2026-10-02T12:00:00.000Z')
    expect(dto.updatedAt).toBe('2026-10-02T12:00:00.000Z')
  })
})

describe('toSdIntegrationLinkDTO', () => {
  it('traduz o estado para pt-BR e lê o título do `meta`', () => {
    const dto = toSdIntegrationLinkDTO(
      createFakeSdIntegrationLink({ externalState: 'merged' }),
    )
    expect(dto.externalState).toBe('merged')
    expect(dto.externalStateLabel).toBe('Mesclada')
    expect(dto.title).toBe('Fila de e-mail travando')
  })

  it('devolve o próprio valor quando o estado não é conhecido', () => {
    const dto = toSdIntegrationLinkDTO(
      createFakeSdIntegrationLink({ externalState: 'draft' }),
    )
    expect(dto.externalStateLabel).toBe('draft')
  })

  it('aceita thread do Slack sem estado, sem url e sem meta', () => {
    const dto = toSdIntegrationLinkDTO(
      createFakeSdIntegrationLink({
        kind: 'SLACK_THREAD',
        externalKey: 'C1:1700000000.000100',
        externalState: null,
        externalUrl: null,
        meta: null,
      }),
    )
    expect(dto.kind).toBe('SLACK_THREAD')
    expect(dto.externalStateLabel).toBeNull()
    expect(dto.externalUrl).toBeNull()
    expect(dto.title).toBeNull()
  })

  it.each([
    ['meta em array', [1, 2] as never],
    ['título vazio', { title: '  ' } as never],
    ['título que não é texto', { title: 7 } as never],
  ])('ignora %s', (_label, meta) => {
    expect(
      toSdIntegrationLinkDTO(createFakeSdIntegrationLink({ meta })).title,
    ).toBeNull()
  })
})
