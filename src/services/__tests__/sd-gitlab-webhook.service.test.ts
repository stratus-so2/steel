import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeGitlabIntegration,
  createFakeSdIntegrationLink,
} from '@/src/__tests__/factories/sd-integration.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, moduleDisabled } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

const SECRET = 'gl-hook-secret'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/lib/crypto', () => ({
  decryptConnectionSecret: vi.fn(async (v: string) => v.replace(/^enc:/, '')),
}))
vi.mock('@/src/cache/sd-integration-event.cache', () => ({
  SdIntegrationEventCache: { claim: vi.fn(), release: vi.fn() },
}))
vi.mock('@/src/repositories/sd-integration.repository')
vi.mock('@/src/repositories/workspace-integration.repository')
vi.mock('../authz', () => ({ assertModuleEnabled: vi.fn() }))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))
vi.mock('../sd-ticket-reply-notify', () => ({
  notifySdTicketReply: vi.fn(async () => undefined),
}))

import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import { assertModuleEnabled } from '../authz'
import { SdGitlabWebhookService } from '../sd-gitlab-webhook.service'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { notifySdTicketReply } from '../sd-ticket-reply-notify'

const repo = vi.mocked(SdIntegrationRepository)
const wsRepo = vi.mocked(WorkspaceIntegrationRepository)
const cache = vi.mocked(SdIntegrationEventCache)
const moduleEnabled = vi.mocked(assertModuleEnabled)
const record = vi.mocked(recordSdTicketEvent)

const mrMerged = {
  object_kind: 'merge_request',
  project: { path_with_namespace: 'stratus/steel' },
  object_attributes: {
    iid: 7,
    title: 'Corrige a fila',
    state: 'merged',
    action: 'merge',
    url: 'https://gitlab.com/stratus/steel/-/merge_requests/7',
  },
}

function call(
  body: unknown,
  token: string | null = SECRET,
  deliveryId: string | null = 'U1',
) {
  return {
    rawBody: JSON.stringify(body),
    token,
    event: 'Merge Request Hook',
    deliveryId,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  cache.claim.mockResolvedValue(true)
  cache.release.mockResolvedValue(undefined)
  moduleEnabled.mockResolvedValue(ok(true as never))
  wsRepo.findManyByExternalId.mockResolvedValue(
    ok([createFakeGitlabIntegration()]),
  )
  wsRepo.markEvent.mockResolvedValue(ok(undefined))
  repo.findRepoLinkByKey.mockResolvedValue(
    ok(
      createFakeSdIntegrationLink({
        integrationId: 'int-gl-1',
        kind: 'GITLAB_MERGE_REQUEST',
        externalKey: 'stratus/steel!7',
        externalState: 'open',
      }),
    ),
  )
  repo.updateLink.mockResolvedValue(ok(createFakeSdIntegrationLink()))
  repo.createTicketMessage.mockResolvedValue(ok({ id: 'msg-1' }))
  record.mockResolvedValue(ok(1))
})

describe('SdGitlabWebhookService.handle — verification', () => {
  it('refuses a body that is not JSON and a payload without project', async () => {
    expectErr(
      await SdGitlabWebhookService.handle({
        rawBody: 'nao-json',
        token: SECRET,
        event: null,
        deliveryId: null,
      }),
      'VALIDATION_ERROR',
    )
    expectErr(
      await SdGitlabWebhookService.handle({
        rawBody: '"texto"',
        token: SECRET,
        event: null,
        deliveryId: null,
      }),
      'VALIDATION_ERROR',
    )
    expectErr(
      await SdGitlabWebhookService.handle(call({ object_kind: 'issue' })),
      'VALIDATION_ERROR',
    )
  })

  it('refuses a project nobody connected (or only disconnected)', async () => {
    wsRepo.findManyByExternalId.mockResolvedValueOnce(ok([]))
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged)),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    wsRepo.findManyByExternalId.mockResolvedValueOnce(
      ok([createFakeGitlabIntegration({ status: 'DISCONNECTED' })]),
    )
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged)),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
    wsRepo.findManyByExternalId.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged)),
      'DATABASE_ERROR',
    )
  })

  it('refuses a connection without secret and a wrong or missing token', async () => {
    wsRepo.findManyByExternalId.mockResolvedValueOnce(
      ok([createFakeGitlabIntegration({ encryptedSigningSecret: null })]),
    )
    expect(
      expectErr(
        await SdGitlabWebhookService.handle(call(mrMerged)),
        'SD_INTEGRATION_NOT_CONFIGURED',
      ).message,
    ).toContain('segredo de webhook')
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged, 'outro')),
      'SD_INTEGRATION_SIGNATURE_INVALID',
    )
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged, null)),
      'SD_INTEGRATION_SIGNATURE_INVALID',
    )
    expect(repo.updateLink).not.toHaveBeenCalled()
    expect(wsRepo.markEvent).not.toHaveBeenCalled()
  })

  it('refuses when the ServiceDesk is disabled (after stamping the event)', async () => {
    moduleEnabled.mockResolvedValueOnce(err(moduleDisabled('SERVICE_DESK')))
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged)),
      'MODULE_DISABLED',
    )
    expect(wsRepo.markEvent).toHaveBeenCalledWith(
      'int-gl-1',
      'gitlab:merge_request.merge',
    )
  })
})

describe('SdGitlabWebhookService.handle — mirroring', () => {
  it('mirrors a merged MR into the ticket', async () => {
    expect(
      expectOk(await SdGitlabWebhookService.handle(call(mrMerged))),
    ).toEqual({ outcome: 'state_updated', state: 'merged' })
    expect(repo.findRepoLinkByKey).toHaveBeenCalledWith(
      'int-gl-1',
      'GITLAB',
      'stratus/steel!7',
    )
    expect(repo.updateLink).toHaveBeenCalledWith(
      'link-1',
      expect.objectContaining({
        externalState: 'merged',
        externalUrl: 'https://gitlab.com/stratus/steel/-/merge_requests/7',
        meta: { title: 'Corrige a fila' },
      }),
    )
    const [{ body }] = repo.createTicketMessage.mock.calls[0]
    expect(body).toContain('O merge request')
    expect(body).toContain('do GitLab agora está mesclada')
    expect(vi.mocked(notifySdTicketReply)).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'GITLAB' }),
    )
    expect(cache.claim).toHaveBeenCalledWith('gitlab', 'U1')
  })

  it('maps issue hooks and closes/reopens', async () => {
    repo.findRepoLinkByKey.mockResolvedValueOnce(
      ok(
        createFakeSdIntegrationLink({
          kind: 'GITLAB_ISSUE',
          externalKey: 'stratus/steel#3',
          externalState: 'open',
        }),
      ),
    )
    expect(
      expectOk(
        await SdGitlabWebhookService.handle(
          call({
            object_kind: 'issue',
            project: { path_with_namespace: 'stratus/steel' },
            object_attributes: { iid: 3, state: 'closed', action: 'close' },
          }),
        ),
      ),
    ).toEqual({ outcome: 'state_updated', state: 'closed' })
    expect(repo.findRepoLinkByKey).toHaveBeenLastCalledWith(
      'int-gl-1',
      'GITLAB',
      'stratus/steel#3',
    )
  })

  it('ignores other hooks, items without iid and unchanged states', async () => {
    expect(
      expectOk(
        await SdGitlabWebhookService.handle(
          call({
            object_kind: 'push',
            project: { path_with_namespace: 'stratus/steel' },
          }),
        ),
      ).outcome,
    ).toBe('ignored')
    expect(wsRepo.markEvent).toHaveBeenLastCalledWith('int-gl-1', 'gitlab:push')
    expect(
      expectOk(
        await SdGitlabWebhookService.handle(
          call({ ...mrMerged, object_attributes: { state: 'merged' } }),
        ),
      ).outcome,
    ).toBe('ignored')
    expect(
      expectOk(
        await SdGitlabWebhookService.handle(
          call({
            ...mrMerged,
            object_attributes: {
              ...mrMerged.object_attributes,
              state: 'opened',
            },
          }),
        ),
      ),
    ).toEqual({ outcome: 'ignored', state: 'open' })
    // Unknown kind without event header: stamped as unknown.
    expectOk(
      await SdGitlabWebhookService.handle({
        rawBody: JSON.stringify({
          project: { path_with_namespace: 'stratus/steel' },
        }),
        token: SECRET,
        event: null,
        deliveryId: null,
      }),
    )
    expect(wsRepo.markEvent).toHaveBeenLastCalledWith(
      'int-gl-1',
      'gitlab:unknown',
    )
  })

  it('is idempotent and builds a key without the delivery header', async () => {
    cache.claim.mockResolvedValueOnce(false)
    expect(
      expectOk(await SdGitlabWebhookService.handle(call(mrMerged))).outcome,
    ).toBe('duplicate')
    expectOk(await SdGitlabWebhookService.handle(call(mrMerged, SECRET, null)))
    expect(cache.claim).toHaveBeenLastCalledWith(
      'gitlab',
      'stratus/steel:GITLAB_MERGE_REQUEST:7:merge:merged',
    )
    expectOk(
      await SdGitlabWebhookService.handle(
        call({ ...mrMerged, object_attributes: { iid: 7 } }, SECRET, null),
      ),
    )
    expect(cache.claim).toHaveBeenLastCalledWith(
      'gitlab',
      'stratus/steel:GITLAB_MERGE_REQUEST:7::',
    )
  })

  it('answers unlinked and releases the lock on database errors', async () => {
    repo.findRepoLinkByKey.mockResolvedValueOnce(ok(null))
    expect(
      expectOk(await SdGitlabWebhookService.handle(call(mrMerged))).outcome,
    ).toBe('unlinked')
    repo.findRepoLinkByKey.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged)),
      'DATABASE_ERROR',
    )
    expect(cache.release).toHaveBeenCalledWith('gitlab', 'U1')
    repo.updateLink.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdGitlabWebhookService.handle(call(mrMerged)),
      'DATABASE_ERROR',
    )
    expect(cache.release).toHaveBeenCalledTimes(2)
  })
})
