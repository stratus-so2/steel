import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeGitlabIntegration,
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
vi.mock('@/src/repositories/workspace-integration.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/lib/servicedesk/slack-client', () => ({
  getSlackAppConfig: vi.fn(),
  SlackClient: { listChannels: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import {
  getSlackAppConfig,
  SlackClient,
} from '@/src/lib/servicedesk/slack-client'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import { SdIntegrationService } from '../sd-integration.service'

const repo = vi.mocked(WorkspaceIntegrationRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const config = vi.mocked(SdConfigRepository)
const slackApp = vi.mocked(getSlackAppConfig)
const slack = vi.mocked(SlackClient)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'

beforeEach(() => {
  vi.clearAllMocks()
  actAs('owner')
  slackApp.mockReturnValue({} as never)
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: WS, name: 'Acme', slug: 'acme' }),
  )
  config.findExistingRefs.mockResolvedValue(
    ok({ departmentIds: ['dep-1', 'dep-2'] } as never),
  )
  repo.list.mockResolvedValue(ok([]))
  repo.requireByKind.mockResolvedValue(ok(createFakeSdIntegration()))
  repo.update.mockImplementation(async (id, _ws, data) =>
    ok(createFakeSdIntegration({ id, config: data.config as never })),
  )
  repo.markError.mockResolvedValue(ok(undefined))
})

describe('SdIntegrationService.overview', () => {
  it('returns the workspace connections and where to manage them', async () => {
    repo.list.mockResolvedValue(
      ok([
        createFakeSdIntegration(),
        createFakeSdGithubIntegration(),
        createFakeGitlabIntegration(),
      ]),
    )
    const view = expectOk(await SdIntegrationService.overview('u1', WS))
    expect(view.slackConfigured).toBe(true)
    expect(view.manageHref).toBe('/acme/settings/integrations')
    expect(view.slack?.kind).toBe('SLACK')
    expect(view.github?.kind).toBe('GITHUB')
    expect(view.gitlab?.kind).toBe('GITLAB')
    expect(JSON.stringify(view)).not.toContain('xoxb-token')
  })

  it('without a Slack app and without the workspace slug, says so', async () => {
    slackApp.mockReturnValue(null)
    ctxRepo.findWorkspace.mockResolvedValue(err(databaseError()))
    const view = expectOk(await SdIntegrationService.overview('u1', WS))
    expect(view.slackConfigured).toBe(false)
    expect(view.manageHref).toBeNull()
    expect(view.slack).toBeNull()
    expect(view.github).toBeNull()
    expect(view.gitlab).toBeNull()
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expect(
      expectOk(await SdIntegrationService.overview('u1', WS)).manageHref,
    ).toBeNull()
  })

  it('refuses non-admins and propagates a database error', async () => {
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

describe('SdIntegrationService.listSlackChannels', () => {
  it('lists the channels the bot sees', async () => {
    slack.listChannels.mockResolvedValue(
      ok([{ id: 'C1', name: 'suporte', isPrivate: false }]),
    )
    expect(
      expectOk(await SdIntegrationService.listSlackChannels('u1', WS)),
    ).toEqual([{ id: 'C1', name: 'suporte', isPrivate: false }])
    expect(slack.listChannels).toHaveBeenCalledWith('xoxb-token')
  })

  it('stamps the error on the connection when Slack refuses', async () => {
    slack.listChannels.mockResolvedValue(
      err(
        sdIntegrationRequestFailed('O Slack recusou a chamada (invalid_auth)'),
      ),
    )
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    expect(repo.markError).toHaveBeenCalledWith(
      'int-slack-1',
      'O Slack recusou a chamada (invalid_auth)',
    )
  })

  it('refuses non-admins, a missing connection and an unreadable token', async () => {
    actAs('agent')
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'FORBIDDEN',
    )
    actAs('owner')
    repo.requireByKind.mockResolvedValueOnce(err(sdIntegrationNotFound()))
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.requireByKind.mockResolvedValueOnce(
      ok(createFakeSdIntegration({ encryptedToken: '' })),
    )
    expectErr(
      await SdIntegrationService.listSlackChannels('u1', WS),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })
})

describe('SdIntegrationService.updateSlackConfig', () => {
  it('merges the module settings and keeps the workspace rules', async () => {
    repo.requireByKind.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          config: {
            routes: [
              {
                event: 'crm.deal.won',
                channelId: 'C9',
                channelName: 'vendas',
              },
            ],
            waitingMinutes: 30,
            servicedesk: { ticketType: 'PROBLEM' },
          },
        }),
      ),
    )
    const dto = expectOk(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        channels: [
          { departmentId: 'dep-1', channelId: 'C1', channelName: 'n1' },
        ],
        mirrorThreadReplies: false,
        departmentId: 'dep-2',
      }),
    )
    const saved = repo.update.mock.calls[0][2].config as Record<string, unknown>
    expect(saved.routes).toEqual([
      { event: 'crm.deal.won', channelId: 'C9', channelName: 'vendas' },
    ])
    expect(saved.waitingMinutes).toBe(30)
    expect(saved.servicedesk).toEqual({
      channels: [{ departmentId: 'dep-1', channelId: 'C1', channelName: 'n1' }],
      allowTicketFromMessage: true,
      mirrorThreadReplies: false,
      ticketType: 'PROBLEM',
      departmentId: 'dep-2',
    })
    expect(dto.slack?.mirrorThreadReplies).toBe(false)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_integration',
        action: 'update',
        meta: expect.objectContaining({ kind: 'SLACK' }),
      }),
    )
  })

  it('maps a legacy config on the way (default channel becomes rules)', async () => {
    repo.requireByKind.mockResolvedValue(
      ok(
        createFakeSdIntegration({
          config: {
            events: ['sla.breached'],
            channels: [{ departmentId: null, channelId: 'C0' }],
          },
        }),
      ),
    )
    expectOk(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        allowTicketFromMessage: false,
        ticketType: 'CHANGE',
      }),
    )
    const saved = repo.update.mock.calls[0][2].config as Record<string, unknown>
    expect(saved.routes).toEqual([
      { event: 'servicedesk.sla.breached', channelId: 'C0', channelName: null },
    ])
    expect(saved.servicedesk).toMatchObject({
      channels: [],
      allowTicketFromMessage: false,
      ticketType: 'CHANGE',
    })
  })

  it('refuses a team of another workspace, a missing connection and non-admins', async () => {
    config.findExistingRefs.mockResolvedValue(
      ok({ departmentIds: [] } as never),
    )
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        departmentId: 'dep-x',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    repo.requireByKind.mockResolvedValueOnce(err(sdIntegrationNotFound()))
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        mirrorThreadReplies: true,
      }),
      'SD_INTEGRATION_NOT_FOUND',
    )
    actAs('agent')
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        mirrorThreadReplies: true,
      }),
      'FORBIDDEN',
    )
  })

  it('propagates a database error on save', async () => {
    repo.update.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdIntegrationService.updateSlackConfig('u1', WS, {
        mirrorThreadReplies: true,
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdIntegrationService.updateRepoConfig', () => {
  it('updates the switches of GitHub and GitLab', async () => {
    repo.requireByKind.mockResolvedValueOnce(
      ok(createFakeSdGithubIntegration()),
    )
    repo.update.mockImplementation(async (id, _ws, data) =>
      ok(createFakeSdGithubIntegration({ id, config: data.config as never })),
    )
    const dto = expectOk(
      await SdIntegrationService.updateRepoConfig('u1', WS, 'GITHUB', {
        suggestPhaseOnClose: false,
      }),
    )
    expect(dto.repo).toEqual({
      suggestPhaseOnClose: false,
      allowIssueFromTicket: true,
    })

    repo.requireByKind.mockResolvedValueOnce(
      ok(createFakeGitlabIntegration({ config: {} })),
    )
    expectOk(
      await SdIntegrationService.updateRepoConfig('u1', WS, 'GITLAB', {
        allowIssueFromTicket: false,
      }),
    )
    expect(repo.requireByKind).toHaveBeenLastCalledWith(WS, 'GITLAB')
    expect(repo.update.mock.calls[1][2].config).toEqual({
      servicedesk: { suggestPhaseOnClose: true, allowIssueFromTicket: false },
    })
  })

  it('refuses a missing connection and non-admins', async () => {
    repo.requireByKind.mockResolvedValueOnce(err(sdIntegrationNotFound()))
    expectErr(
      await SdIntegrationService.updateRepoConfig('u1', WS, 'GITLAB', {
        suggestPhaseOnClose: true,
      }),
      'SD_INTEGRATION_NOT_FOUND',
    )
    actAs('requester')
    expectErr(
      await SdIntegrationService.updateRepoConfig('u1', WS, 'GITHUB', {
        suggestPhaseOnClose: true,
      }),
      'FORBIDDEN',
    )
  })
})
