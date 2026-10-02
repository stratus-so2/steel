import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdGithubIntegration,
  createFakeSdIntegration,
} from '@/src/__tests__/factories/sd-integration.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import {
  databaseError,
  sdIntegrationNotFound,
  sdIntegrationRequestFailed,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { createSdSlackOauthState } from '@/src/lib/servicedesk/slack-oauth-state'

vi.mock('@/lib/axiom/audit', () => ({
  auditMutation: vi.fn(),
  auditAuth: vi.fn(),
}))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/lib/crypto', () => ({
  encryptConnectionSecret: vi.fn(async (value: string) => `enc:${value}`),
  decryptConnectionSecret: vi.fn(async (value: string) =>
    value.replace(/^enc:/, ''),
  ),
}))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-integration.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/lib/servicedesk/slack-client', () => ({
  getSlackAppConfig: vi.fn(),
  slackAuthorizeUrl: vi.fn(
    (_config, state: string) => `https://slack.test/oauth?state=${state}`,
  ),
  SLACK_EVENTS_PATH: '/api/servicedesk/integrations/slack',
  SLACK_REDIRECT_PATH: '/api/servicedesk/integrations/oauth/slack',
  SlackClient: {
    exchangeCode: vi.fn(),
    listChannels: vi.fn(),
    postMessage: vi.fn(),
    getUser: vi.fn(),
    permalink: vi.fn(),
  },
}))
vi.mock('@/src/lib/servicedesk/github-client', () => ({
  GithubClient: {
    checkRepo: vi.fn(),
    getItem: vi.fn(),
    createIssue: vi.fn(),
  },
}))

import { auditAuth, auditMutation } from '@/lib/axiom/audit'
import { GithubClient } from '@/src/lib/servicedesk/github-client'
import {
  getSlackAppConfig,
  SlackClient,
} from '@/src/lib/servicedesk/slack-client'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import {
  activeSdIntegration,
  SdIntegrationService,
} from '../sd-integration.service'

const repo = vi.mocked(SdIntegrationRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const config = vi.mocked(SdConfigRepository)
const slackApp = vi.mocked(getSlackAppConfig)
const slack = vi.mocked(SlackClient)
const github = vi.mocked(GithubClient)
const audit = vi.mocked(auditMutation)
const authAudit = vi.mocked(auditAuth)

const WS = 'ws1'
const TOKEN = 'github_pat_11ABCDEFG0123456789'

const APP = {
  clientId: 'id',
  clientSecret: 'secret',
  signingSecret: 'signing',
  redirectUri: 'https://steel.test/api/servicedesk/integrations/oauth/slack',
  eventsUrl: 'https://steel.test/api/servicedesk/integrations/slack',
}

beforeEach(() => {
  actAs('owner')
  slackApp.mockReturnValue(APP)
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: WS, name: 'Acme', slug: 'acme' }),
  )
  config.findExistingRefs.mockResolvedValue(
    ok({ departmentIds: ['dep-1'] } as never),
  )
  repo.list.mockResolvedValue(ok([]))
  repo.findByKind.mockResolvedValue(ok(null))
  repo.requireByKind.mockResolvedValue(ok(createFakeSdIntegration()))
  repo.upsert.mockResolvedValue(ok(createFakeSdIntegration()))
  repo.update.mockResolvedValue(ok(createFakeSdIntegration()))
  repo.disconnect.mockResolvedValue(ok(undefined))
  repo.markError.mockResolvedValue(ok(undefined))
})

describe('SdIntegrationService.overview', () => {
  it('diz que o Slack está configurado e devolve as URLs e as integrações', async () => {
    repo.list.mockResolvedValue(
      ok([createFakeSdIntegration(), createFakeSdGithubIntegration()]),
    )
    const view = expectOk(await SdIntegrationService.overview('u1', WS))
    expect(view.slackConfigured).toBe(true)
    expect(view.slackEventsUrl).toContain('/api/servicedesk/integrations/slack')
    expect(view.githubWebhookUrl).toContain(
      '/api/servicedesk/integrations/github',
    )
    expect(view.slack?.kind).toBe('SLACK')
    expect(view.github?.kind).toBe('GITHUB')
    expect(JSON.stringify(view)).not.toContain('xoxb-token')
  })

  it('sem app do Slack no servidor, avisa e não oferece a URL', async () => {
    slackApp.mockReturnValue(null)
    const view = expectOk(await SdIntegrationService.overview('u1', WS))
    expect(view.slackConfigured).toBe(false)
    expect(view.slackEventsUrl).toBeNull()
    expect(view.slack).toBeNull()
    expect(view.github).toBeNull()
  })

  it('recusa quem não é admin e propaga erro de banco', async () => {
    actAs('agent')
    expectErr(await SdIntegrationService.overview('u1', WS), 'FORBIDDEN')
    actAs('requester')
    expectErr(await SdIntegrationService.overview('u1', WS), 'FORBIDDEN')
    actAs('stranger')
    expectErr(await SdIntegrationService.overview('u1', WS), 'FORBIDDEN')
    actAs('disabled')
    expectErr(await SdIntegrationService.overview('u1', WS), 'MODULE_DISABLED')
    actAs('owner')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdIntegrationService.overview('u1', WS), 'DATABASE_ERROR')
  })
})

describe('SdIntegrationService.beginSlackConnect', () => {
  it('monta a URL de autorização com o state do workspace', async () => {
    const begun = expectOk(await SdIntegrationService.beginSlackConnect('u1', WS))
    expect(begun.authorizeUrl).toContain('https://slack.test/oauth?state=')
  })

  it('sem app configurado responde SD_INTEGRATION_NOT_CONFIGURED', async () => {
    slackApp.mockReturnValue(null)
    expectErr(
      await SdIntegrationService.beginSlackConnect('u1', WS),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('recusa não-admin, workspace inexistente e erro de banco', async () => {
    actAs('agent')
    expectErr(
      await SdIntegrationService.beginSlackConnect('u1', WS),
      'FORBIDDEN',
    )
    actAs('owner')
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await SdIntegrationService.beginSlackConnect('u1', WS),
      'SD_INTEGRATION_NOT_FOUND',
    )
    ctxRepo.findWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdIntegrationService.beginSlackConnect('u1', WS),
      'DATABASE_ERROR',
    )
  })
})

describe('SdIntegrationService.completeSlackConnect', () => {
  const state = () => createSdSlackOauthState(WS, 'acme')

  beforeEach(() => {
    slack.exchangeCode.mockResolvedValue(
      ok({
        accessToken: 'xoxb-novo',
        teamId: 'T0001',
        teamName: 'Stratus',
        botUserId: 'B1',
      }),
    )
  })

  it('cifra o token, guarda a integração e audita a concessão', async () => {
    const done = expectOk(
      await SdIntegrationService.completeSlackConnect('u1', state(), 'code-1'),
    )
    expect(done.workspaceSlug).toBe('acme')
    expect(done.teamName).toBe('Stratus')
    expect(repo.upsert).toHaveBeenCalledWith(
      WS,
      'SLACK',
      'T0001',
      expect.objectContaining({ encryptedToken: 'enc:xoxb-novo' }),
    )
    expect(authAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth.oauth_grant.servicedesk_slack' }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_integration', action: 'connect' }),
    )
    // Nada de token nos metadados auditados.
    expect(JSON.stringify(audit.mock.calls)).not.toContain('xoxb-novo')
  })

  it('preserva a configuração ao reconectar o mesmo Slack', async () => {
    repo.findByKind.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          config: { events: ['sla.breached'], channels: [] },
        }),
      ),
    )
    expectOk(
      await SdIntegrationService.completeSlackConnect('u1', state(), 'code-1'),
    )
    expect(repo.upsert).toHaveBeenCalledWith(
      WS,
      'SLACK',
      'T0001',
      expect.objectContaining({
        config: expect.objectContaining({ events: ['sla.breached'] }),
      }),
    )
  })

  it('recusa state inválido e audita a falha', async () => {
    expectErr(
      await SdIntegrationService.completeSlackConnect('u1', 'lixo', 'code'),
      'VALIDATION_ERROR',
    )
    expect(authAudit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'STATE_INVALID' }),
    )
  })

  it('sem app configurado não tenta nada', async () => {
    slackApp.mockReturnValue(null)
    expectErr(
      await SdIntegrationService.completeSlackConnect('u1', state(), 'code'),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    expect(slack.exchangeCode).not.toHaveBeenCalled()
  })

  it('recusa quem não é admin do workspace do state', async () => {
    actAs('agent')
    expectErr(
      await SdIntegrationService.completeSlackConnect('u1', state(), 'code'),
      'FORBIDDEN',
    )
  })

  it('propaga a recusa do Slack e o erro de banco', async () => {
    slack.exchangeCode.mockResolvedValue(err(sdIntegrationRequestFailed()))
    expectErr(
      await SdIntegrationService.completeSlackConnect('u1', state(), 'code'),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    expect(authAudit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )

    slack.exchangeCode.mockResolvedValue(
      ok({
        accessToken: 'xoxb',
        teamId: 'T1',
        teamName: null,
        botUserId: null,
      }),
    )
    repo.findByKind.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdIntegrationService.completeSlackConnect('u1', state(), 'code'),
      'DATABASE_ERROR',
    )

    repo.findByKind.mockResolvedValue(ok(null))
    repo.upsert.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdIntegrationService.completeSlackConnect('u1', state(), 'code'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdIntegrationService.listSlackChannels', () => {
  it('lista os canais do bot em ordem', async () => {
    slack.listChannels.mockResolvedValue(
      ok([{ id: 'C1', name: 'geral', isPrivate: false }]),
    )
    const channels = expectOk(
      await SdIntegrationService.listSlackChannels('u1', WS),
    )
    expect(channels).toEqual([{ id: 'C1', name: 'geral', isPrivate: false }])
    expect(slack.listChannels).toHaveBeenCalledWith('xoxb-token')
  })

  it('carimba ERROR na integração quando o Slack recusa', async () => {
    slack.listChannels.mockResolvedValue(err(sdIntegrationRequestFailed()))
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    expect(repo.markError).toHaveBeenCalledWith(
      'int-slack-1',
      expect.any(String),
    )
  })

  it('recusa não-admin, integração ausente e token ilegível', async () => {
    actAs('agent')
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'FORBIDDEN',
    )
    actAs('owner')
    repo.requireByKind.mockResolvedValue(err(sdIntegrationNotFound()))
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.requireByKind.mockResolvedValue(
      ok(createFakeSdIntegration({ encryptedToken: '' })),
    )
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })
})

describe('SdIntegrationService.updateSlackConfig', () => {
  it('salva o canal por time junto do que já havia', async () => {
    repo.requireByKind.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          config: { events: ['sla.breached'], mirrorThreadReplies: false },
        }),
      ),
    )
    expectOk(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        channels: [
          { departmentId: 'dep-1', channelId: 'C1', channelName: 'n1' },
        ],
      }),
    )
    expect(repo.update).toHaveBeenCalledWith(
      'int-slack-1',
      WS,
      expect.objectContaining({
        config: expect.objectContaining({
          events: ['sla.breached'],
          mirrorThreadReplies: false,
          channels: [
            { departmentId: 'dep-1', channelId: 'C1', channelName: 'n1' },
          ],
        }),
      }),
    )
  })

  it('aceita trocar eventos, interruptores, tipo e time', async () => {
    expectOk(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        events: ['ticket.escalated', 'ticket.escalated'],
        allowTicketFromMessage: false,
        mirrorThreadReplies: true,
        ticketType: 'PROBLEM',
        departmentId: 'dep-1',
      }),
    )
    const [, , data] = repo.update.mock.calls[0]
    expect(data.config).toEqual(
      expect.objectContaining({
        events: ['ticket.escalated'],
        allowTicketFromMessage: false,
        ticketType: 'PROBLEM',
        departmentId: 'dep-1',
      }),
    )
  })

  it('recusa departamento de outra workspace', async () => {
    config.findExistingRefs.mockResolvedValue(ok({ departmentIds: [] } as never))
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        departmentId: 'dep-de-outra',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('recusa não-admin, integração ausente e erro de banco', async () => {
    actAs('agent')
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        events: ['x'],
      }),
      'FORBIDDEN',
    )
    actAs('owner')
    repo.requireByKind.mockResolvedValue(err(sdIntegrationNotFound()))
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, { events: ['x'] }),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.requireByKind.mockResolvedValue(ok(createFakeSdIntegration()))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, { events: ['x'] }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdIntegrationService.connectGithub', () => {
  beforeEach(() => {
    github.checkRepo.mockResolvedValue(
      ok({ fullName: 'stratus-so2/steel', private: true }),
    )
    repo.upsert.mockResolvedValue(ok(createFakeSdGithubIntegration()))
  })

  it('valida o acesso, cifra token e segredo e usa o nome canônico', async () => {
    const dto = expectOk(
      await SdIntegrationService.connectGithub('u1', WS, {
        repo: 'https://github.com/Stratus-SO2/Steel',
        token: TOKEN,
        webhookSecret: 'segredo-de-teste',
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      }),
    )
    expect(dto.kind).toBe('GITHUB')
    expect(github.checkRepo).toHaveBeenCalledWith(TOKEN, {
      owner: 'Stratus-SO2',
      repo: 'Steel',
    })
    expect(repo.upsert).toHaveBeenCalledWith(
      WS,
      'GITHUB',
      'stratus-so2/steel',
      expect.objectContaining({
        encryptedToken: `enc:${TOKEN}`,
        encryptedSigningSecret: 'enc:segredo-de-teste',
      }),
    )
    expect(JSON.stringify(audit.mock.calls)).not.toContain(TOKEN)
  })

  it('aceita conexão sem segredo de webhook', async () => {
    expectOk(
      await SdIntegrationService.connectGithub('u1', WS, {
        repo: 'owner/repo',
        token: TOKEN,
        suggestPhaseOnClose: false,
        allowIssueFromTicket: false,
      }),
    )
    expect(repo.upsert).toHaveBeenCalledWith(
      WS,
      'GITHUB',
      'stratus-so2/steel',
      expect.objectContaining({ encryptedSigningSecret: null }),
    )
  })

  it('cai no repositório informado se o GitHub devolver um nome estranho', async () => {
    github.checkRepo.mockResolvedValue(ok({ fullName: 'invalido', private: false }))
    expectOk(
      await SdIntegrationService.connectGithub('u1', WS, {
        repo: 'owner/repo',
        token: TOKEN,
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      }),
    )
    expect(repo.upsert).toHaveBeenCalledWith(
      WS,
      'GITHUB',
      'owner/repo',
      expect.any(Object),
    )
  })

  it('recusa repositório irreconhecível, token sem acesso e erro de banco', async () => {
    expectErr(
      await SdIntegrationService.connectGithub('u1', WS, {
        repo: 'nao-e-um-repo',
        token: TOKEN,
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      }),
      'VALIDATION_ERROR',
    )
    github.checkRepo.mockResolvedValue(err(sdIntegrationRequestFailed()))
    expectErr(
      await SdIntegrationService.connectGithub('u1', WS, {
        repo: 'owner/repo',
        token: TOKEN,
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      }),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    github.checkRepo.mockResolvedValue(
      ok({ fullName: 'owner/repo', private: false }),
    )
    repo.upsert.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdIntegrationService.connectGithub('u1', WS, {
        repo: 'owner/repo',
        token: TOKEN,
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      }),
      'DATABASE_ERROR',
    )
  })

  it('recusa quem não é admin', async () => {
    actAs('agent')
    expectErr(
      await SdIntegrationService.connectGithub('u1', WS, {
        repo: 'owner/repo',
        token: TOKEN,
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      }),
      'FORBIDDEN',
    )
  })
})

describe('SdIntegrationService.updateGithub', () => {
  beforeEach(() => {
    repo.requireByKind.mockResolvedValue(ok(createFakeSdGithubIntegration()))
    repo.update.mockResolvedValue(ok(createFakeSdGithubIntegration()))
    github.checkRepo.mockResolvedValue(
      ok({ fullName: 'stratus-so2/steel', private: true }),
    )
  })

  it('troca o token depois de revalidar o acesso', async () => {
    expectOk(
      await SdIntegrationService.updateGithub('u1', WS, { token: TOKEN }),
    )
    expect(github.checkRepo).toHaveBeenCalledWith(TOKEN, {
      owner: 'stratus-so2',
      repo: 'steel',
    })
    const [, , data] = repo.update.mock.calls[0]
    expect(data.encryptedToken).toBe(`enc:${TOKEN}`)
    expect(data.status).toBe('ACTIVE')
    expect(data.statusError).toBeNull()
  })

  it('troca e remove o segredo do webhook', async () => {
    expectOk(
      await SdIntegrationService.updateGithub('u1', WS, {
        webhookSecret: 'outro-segredo-de-teste',
      }),
    )
    expect(repo.update.mock.calls[0][2].encryptedSigningSecret).toBe(
      'enc:outro-segredo-de-teste',
    )
    repo.update.mockClear()
    expectOk(
      await SdIntegrationService.updateGithub('u1', WS, {
        webhookSecret: null,
      }),
    )
    expect(repo.update.mock.calls[0][2].encryptedSigningSecret).toBeNull()
  })

  it('mescla os interruptores com o que já estava salvo', async () => {
    repo.requireByKind.mockResolvedValue(
      ok(
        createFakeSdGithubIntegration({
          config: { suggestPhaseOnClose: false, allowIssueFromTicket: true },
        }),
      ),
    )
    expectOk(
      await SdIntegrationService.updateGithub('u1', WS, {
        allowIssueFromTicket: false,
      }),
    )
    expect(repo.update.mock.calls[0][2].config).toEqual({
      suggestPhaseOnClose: false,
      allowIssueFromTicket: false,
    })
  })

  it('recusa token sem acesso, repositório corrompido e não-admin', async () => {
    github.checkRepo.mockResolvedValue(err(sdIntegrationRequestFailed()))
    expectErr(
      await SdIntegrationService.updateGithub('u1', WS, { token: TOKEN }),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    repo.requireByKind.mockResolvedValue(
      ok(createFakeSdGithubIntegration({ externalId: 'invalido' })),
    )
    expectErr(
      await SdIntegrationService.updateGithub('u1', WS, { token: TOKEN }),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    actAs('agent')
    expectErr(
      await SdIntegrationService.updateGithub('u1', WS, {
        suggestPhaseOnClose: false,
      }),
      'FORBIDDEN',
    )
  })

  it('propaga integração ausente e erro de banco', async () => {
    repo.requireByKind.mockResolvedValue(err(sdIntegrationNotFound()))
    expectErr(
      await SdIntegrationService.updateGithub('u1', WS, {
        suggestPhaseOnClose: false,
      }),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.requireByKind.mockResolvedValue(ok(createFakeSdGithubIntegration()))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdIntegrationService.updateGithub('u1', WS, {
        suggestPhaseOnClose: false,
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdIntegrationService.disconnect', () => {
  it('desconecta e audita', async () => {
    expectOk(await SdIntegrationService.disconnect('u1', WS, 'SLACK'))
    expect(repo.disconnect).toHaveBeenCalledWith('int-slack-1', WS)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_integration',
        action: 'disconnect',
      }),
    )
  })

  it('recusa não-admin, integração ausente e erro de banco', async () => {
    actAs('agent')
    expectErr(
      await SdIntegrationService.disconnect('u1', WS, 'GITHUB'),
      'FORBIDDEN',
    )
    actAs('owner')
    repo.requireByKind.mockResolvedValue(err(sdIntegrationNotFound()))
    expectErr(
      await SdIntegrationService.disconnect('u1', WS, 'GITHUB'),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.requireByKind.mockResolvedValue(ok(createFakeSdIntegration()))
    repo.disconnect.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdIntegrationService.disconnect('u1', WS, 'SLACK'),
      'DATABASE_ERROR',
    )
  })
})

describe('activeSdIntegration', () => {
  it('devolve a integração viva e ignora a desconectada', async () => {
    repo.findByKind.mockResolvedValue(ok(createFakeSdIntegration()))
    expect(await activeSdIntegration(WS, 'SLACK')).not.toBeNull()

    repo.findByKind.mockResolvedValue(
      ok(createFakeSdIntegration({ status: 'DISCONNECTED' })),
    )
    expect(await activeSdIntegration(WS, 'SLACK')).toBeNull()

    repo.findByKind.mockResolvedValue(ok(null))
    expect(await activeSdIntegration(WS, 'SLACK')).toBeNull()

    repo.findByKind.mockResolvedValue(err(databaseError()))
    expect(await activeSdIntegration(WS, 'SLACK')).toBeNull()
  })
})
