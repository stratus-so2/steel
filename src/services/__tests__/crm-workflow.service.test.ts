import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmWorkflow,
  createFakeCrmWorkflowRun,
  createFakeCrmWorkflowRunStep,
  createFakeCrmWorkflowVersion,
  FAKE_WORKFLOW_DEFINITION,
} from '@/src/__tests__/factories/crm-workflow.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import type { ErrorCode } from '@/src/errors/codes'
import { err, ok, type Result } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-workflow.repository')
vi.mock('@/src/services/crm-workflow-runner')

import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
  CrmWorkflowVersionRepository,
} from '@/src/repositories/crm-workflow.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  resumeCrmWorkflow,
  runCrmWorkflow,
} from '@/src/services/crm-workflow-runner'
import { CrmWorkflowService } from '../crm-workflow.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedWorkflowRepo = vi.mocked(CrmWorkflowRepository)
const mockedVersionRepo = vi.mocked(CrmWorkflowVersionRepository)
const mockedRunRepo = vi.mocked(CrmWorkflowRunRepository)
const mockedRunCrmWorkflow = vi.mocked(runCrmWorkflow)
const mockedResumeCrmWorkflow = vi.mocked(resumeCrmWorkflow)

describe('CrmWorkflowService', () => {
  describe('create()', () => {
    it('should require workspace membership', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmWorkflowService.create('u1', 'ws1', { name: 'Boas-vindas' }),
        'FORBIDDEN',
      )
    })

    it('should create the workflow with an empty draft', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkflowRepo.create.mockResolvedValue(
        ok({ ...createFakeCrmWorkflow({ id: 'w1' }), versions: [] } as never),
      )

      const dto = expectOk(
        await CrmWorkflowService.create('u1', 'ws1', { name: 'Boas-vindas' }),
      )
      expect(dto.id).toBe('w1')
      expect(mockedWorkflowRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Boas-vindas' }),
      )
    })
  })

  describe('activate()', () => {
    it('should reject activation without a configured trigger', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkflowRepo.findById.mockResolvedValue(
        ok(createFakeCrmWorkflow({ id: 'w1', workspaceId: 'ws1' })),
      )
      mockedVersionRepo.findDraft.mockResolvedValue(
        ok(
          createFakeCrmWorkflowVersion({
            definition: {
              trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
              nodes: [],
              edges: [],
            } as never,
          }),
        ),
      )

      expectErr(
        await CrmWorkflowService.activate('u1', 'ws1', 'w1'),
        'CRM_WORKFLOW_INVALID_DEFINITION',
      )
    })

    it('should activate the draft when a trigger is configured', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkflowRepo.findById
        .mockResolvedValueOnce(
          ok(createFakeCrmWorkflow({ id: 'w1', workspaceId: 'ws1' })),
        )
        .mockResolvedValueOnce(
          ok(
            createFakeCrmWorkflow({
              id: 'w1',
              workspaceId: 'ws1',
              status: 'ACTIVE',
            }),
          ),
        )
      const draft = createFakeCrmWorkflowVersion({ id: 'v1' })
      mockedVersionRepo.findDraft.mockResolvedValue(ok(draft))
      mockedVersionRepo.activateDraft.mockResolvedValue(
        ok({
          activated: draft,
          newDraft: createFakeCrmWorkflowVersion({ id: 'v2' }),
        }),
      )

      const dto = expectOk(await CrmWorkflowService.activate('u1', 'ws1', 'w1'))
      expect(dto.status).toBe('ACTIVE')
      expect(mockedVersionRepo.activateDraft).toHaveBeenCalledWith('w1', 'v1')
    })
  })

  describe('triggerManual()', () => {
    it('should require workspace membership', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmWorkflowService.triggerManual('u1', 'ws1', 'w1', {
          payload: {},
          test: false,
        }),
        'FORBIDDEN',
      )
    })

    it('should run against the ACTIVE version and call the runner', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkflowRepo.findById.mockResolvedValue(
        ok(createFakeCrmWorkflow({ id: 'w1', workspaceId: 'ws1' })),
      )
      const version = createFakeCrmWorkflowVersion({
        id: 'v1',
        status: 'ACTIVE',
      })
      mockedVersionRepo.findActive.mockResolvedValue(ok(version))
      mockedRunRepo.create.mockResolvedValue(
        ok(
          createFakeCrmWorkflowRun({
            id: 'r1',
            workflowId: 'w1',
            versionId: 'v1',
          }),
        ),
      )
      mockedRunCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById.mockResolvedValue(
        ok({
          ...createFakeCrmWorkflowRun({
            id: 'r1',
            workflowId: 'w1',
            versionId: 'v1',
          }),
          steps: [],
        }),
      )

      const dto = expectOk(
        await CrmWorkflowService.triggerManual('u1', 'ws1', 'w1', {
          payload: {},
          test: false,
        }),
      )
      expect(dto.id).toBe('r1')
      expect(mockedRunCrmWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'r1',
          workspaceId: 'ws1',
          testMode: false,
        }),
      )
    })
  })

  describe('resumeRun()', () => {
    it('should reject a run that is not WAITING', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkflowRepo.findById.mockResolvedValue(
        ok(createFakeCrmWorkflow({ id: 'w1', workspaceId: 'ws1' })),
      )
      mockedRunRepo.findById.mockResolvedValue(
        ok({
          ...createFakeCrmWorkflowRun({
            id: 'r1',
            workflowId: 'w1',
            status: 'RUNNING',
          }),
          steps: [],
        }),
      )

      expectErr(
        await CrmWorkflowService.resumeRun('u1', 'ws1', 'w1', 'r1', {
          payload: {},
        }),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      )
      expect(mockedResumeCrmWorkflow).not.toHaveBeenCalled()
    })
  })

  describe('triggerWebhook()', () => {
    it('should return CRM_WORKFLOW_WEBHOOK_INVALID when no active workflow matches the token', async () => {
      mockedWorkflowRepo.findActiveByWebhookToken.mockResolvedValue(ok(null))

      expectErr(
        await CrmWorkflowService.triggerWebhook('tok_x', {}),
        'CRM_WORKFLOW_WEBHOOK_INVALID',
      )
    })

    it('should create a run and dispatch the runner for a matched webhook', async () => {
      const version = createFakeCrmWorkflowVersion({ id: 'v1' })
      mockedWorkflowRepo.findActiveByWebhookToken.mockResolvedValue(
        ok({
          ...createFakeCrmWorkflow({ id: 'w1' }),
          activeVersion: version,
        } as never),
      )
      mockedRunRepo.create.mockResolvedValue(
        ok(
          createFakeCrmWorkflowRun({
            id: 'r1',
            workflowId: 'w1',
            versionId: 'v1',
          }),
        ),
      )
      mockedRunCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById.mockResolvedValue(
        ok({
          ...createFakeCrmWorkflowRun({
            id: 'r1',
            workflowId: 'w1',
            versionId: 'v1',
          }),
          steps: [],
        }),
      )

      const dto = expectOk(
        await CrmWorkflowService.triggerWebhook('tok_x', { foo: 1 }),
      )
      expect(dto.id).toBe('r1')
      expect(mockedRunCrmWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ triggerType: 'webhook' }),
      )
    })
  })
})

/* ======================= cobertura ampliada ======================= */

const WS = 'ws1'
const WF = 'w1'
const dbErr = { code: 'DATABASE_ERROR', message: 'boom' } as never
const code = (c: string) => c as ErrorCode

function asMember(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

function withWorkflow(
  overrides: Parameters<typeof createFakeCrmWorkflow>[0] = {},
) {
  mockedWorkflowRepo.findById.mockResolvedValue(
    ok(createFakeCrmWorkflow({ id: WF, workspaceId: WS, ...overrides })),
  )
}

function runWithSteps(
  overrides: Parameters<typeof createFakeCrmWorkflowRun>[0] = {},
  steps: ReturnType<typeof createFakeCrmWorkflowRunStep>[] = [],
) {
  return { ...createFakeCrmWorkflowRun(overrides), steps }
}

/** Todo método autenticado passa por membership → módulo → permissão → load. */
const AUTHED_METHODS: Array<{
  name: string
  action: 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE'
  call: () => Promise<Result<unknown>>
}> = [
  {
    name: 'list',
    action: 'VIEW',
    call: () => CrmWorkflowService.list('u1', WS),
  },
  {
    name: 'getById',
    action: 'VIEW',
    call: () => CrmWorkflowService.getById('u1', WS, WF),
  },
  {
    name: 'update',
    action: 'EDIT',
    call: () => CrmWorkflowService.update('u1', WS, WF, { name: 'X' }),
  },
  {
    name: 'remove',
    action: 'DELETE',
    call: () => CrmWorkflowService.remove('u1', WS, WF),
  },
  {
    name: 'getDraft',
    action: 'VIEW',
    call: () => CrmWorkflowService.getDraft('u1', WS, WF),
  },
  {
    name: 'listVersions',
    action: 'VIEW',
    call: () => CrmWorkflowService.listVersions('u1', WS, WF),
  },
  {
    name: 'updateDraft',
    action: 'EDIT',
    call: () =>
      CrmWorkflowService.updateDraft('u1', WS, WF, {
        definition: FAKE_WORKFLOW_DEFINITION,
      }),
  },
  {
    name: 'activate',
    action: 'EDIT',
    call: () => CrmWorkflowService.activate('u1', WS, WF),
  },
  {
    name: 'deactivate',
    action: 'EDIT',
    call: () => CrmWorkflowService.deactivate('u1', WS, WF),
  },
  {
    name: 'discard',
    action: 'EDIT',
    call: () => CrmWorkflowService.discard('u1', WS, WF),
  },
  {
    name: 'listRuns',
    action: 'VIEW',
    call: () => CrmWorkflowService.listRuns('u1', WS, WF),
  },
  {
    name: 'getRun',
    action: 'VIEW',
    call: () => CrmWorkflowService.getRun('u1', WS, WF, 'r1'),
  },
  {
    name: 'triggerManual',
    action: 'EDIT',
    call: () =>
      CrmWorkflowService.triggerManual('u1', WS, WF, {
        payload: {},
        test: false,
      }),
  },
  {
    name: 'resumeRun',
    action: 'EDIT',
    call: () =>
      CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', { payload: {} }),
  },
]

describe('CrmWorkflowService — authorization and loading', () => {
  describe.each(AUTHED_METHODS)('$name()', ({ name, action, call }) => {
    it('should reject non-members', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await call(), 'FORBIDDEN')
    })

    it('should reject when the CRM module is disabled', async () => {
      asMember('OWNER')
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))
      expectErr(await call(), 'MODULE_DISABLED')
    })

    it('should reject members of a suspended workspace', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(
          createFakeMembership({ role: 'OWNER', workspaceStatus: 'SUSPENDED' }),
        ),
      )
      expectErr(await call(), 'WORKSPACE_SUSPENDED')
    })

    if (action !== 'VIEW') {
      it('should reject a VIEWER', async () => {
        asMember('VIEWER')
        expectErr(await call(), 'FORBIDDEN')
      })
    }

    if (name !== 'list') {
      it('should return not found for a workflow from another workspace', async () => {
        asMember('OWNER')
        withWorkflow({ workspaceId: 'other' })
        expectErr(await call(), 'CRM_WORKFLOW_NOT_FOUND')
      })

      it('should return not found for a soft-deleted workflow', async () => {
        asMember('OWNER')
        withWorkflow({ deletedAt: new Date() })
        expectErr(await call(), 'CRM_WORKFLOW_NOT_FOUND')
      })

      it('should return not found when the workflow does not exist', async () => {
        asMember('OWNER')
        mockedWorkflowRepo.findById.mockResolvedValue(ok(null))
        expectErr(await call(), 'CRM_WORKFLOW_NOT_FOUND')
      })

      it('should propagate a repository error while loading', async () => {
        asMember('OWNER')
        mockedWorkflowRepo.findById.mockResolvedValue(err(dbErr))
        expectErr(await call(), 'DATABASE_ERROR')
      })
    }
  })

  it('should forbid a MEMBER from deleting (no DELETE on workflows)', async () => {
    asMember('MEMBER')
    expectErr(await CrmWorkflowService.remove('u1', WS, WF), 'FORBIDDEN')
    expect(mockedWorkflowRepo.softDelete).not.toHaveBeenCalled()
  })

  it('should let a VIEWER list workflows', async () => {
    asMember('VIEWER')
    mockedWorkflowRepo.listByWorkspace.mockResolvedValue(
      ok([createFakeCrmWorkflow({ id: WF, workspaceId: WS })]),
    )
    const list = expectOk(await CrmWorkflowService.list('u1', WS))
    expect(list.map((w) => w.id)).toEqual([WF])
  })
})

describe('CrmWorkflowService — CRUD', () => {
  it('create() should propagate a repository failure', async () => {
    asMember()
    mockedWorkflowRepo.create.mockResolvedValue(err(dbErr))
    expectErr(
      await CrmWorkflowService.create('u1', WS, {
        name: 'X',
        description: 'd',
      }),
      'DATABASE_ERROR',
    )
    expect(mockedWorkflowRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'd', createdById: 'u1' }),
    )
  })

  it('list() should propagate a repository error', async () => {
    asMember()
    mockedWorkflowRepo.listByWorkspace.mockResolvedValue(err(dbErr))
    expectErr(await CrmWorkflowService.list('u1', WS), 'DATABASE_ERROR')
  })

  it('getById() should return the DTO', async () => {
    asMember()
    withWorkflow({ name: 'Onboarding' })
    const dto = expectOk(await CrmWorkflowService.getById('u1', WS, WF))
    expect(dto).toMatchObject({ id: WF, name: 'Onboarding' })
  })

  it('update() should persist the patch', async () => {
    asMember()
    withWorkflow()
    mockedWorkflowRepo.update.mockResolvedValue(
      ok(createFakeCrmWorkflow({ id: WF, workspaceId: WS, name: 'Novo' })),
    )
    const dto = expectOk(
      await CrmWorkflowService.update('u1', WS, WF, {
        name: 'Novo',
        status: 'DEACTIVATED',
      }),
    )
    expect(dto.name).toBe('Novo')
    expect(mockedWorkflowRepo.update).toHaveBeenCalledWith(WF, {
      updatedById: 'u1',
      name: 'Novo',
      description: undefined,
      status: 'DEACTIVATED',
    })
  })

  it('update() should propagate a repository error', async () => {
    asMember()
    withWorkflow()
    mockedWorkflowRepo.update.mockResolvedValue(err(dbErr))
    expectErr(
      await CrmWorkflowService.update('u1', WS, WF, { name: 'Novo' }),
      'DATABASE_ERROR',
    )
  })

  it('remove() should soft delete as ADMIN', async () => {
    asMember('ADMIN')
    withWorkflow()
    mockedWorkflowRepo.softDelete.mockResolvedValue(ok(undefined) as never)
    expectOk(await CrmWorkflowService.remove('u1', WS, WF))
    expect(mockedWorkflowRepo.softDelete).toHaveBeenCalledWith(WF, 'u1')
  })

  it('remove() should propagate a repository error', async () => {
    asMember('ADMIN')
    withWorkflow()
    mockedWorkflowRepo.softDelete.mockResolvedValue(err(dbErr))
    expectErr(await CrmWorkflowService.remove('u1', WS, WF), 'DATABASE_ERROR')
  })

  it('deactivate() should set DEACTIVATED', async () => {
    asMember()
    withWorkflow({ status: 'ACTIVE' })
    mockedWorkflowRepo.update.mockResolvedValue(
      ok(createFakeCrmWorkflow({ id: WF, status: 'DEACTIVATED' })),
    )
    const dto = expectOk(await CrmWorkflowService.deactivate('u1', WS, WF))
    expect(dto.status).toBe('DEACTIVATED')
    expect(mockedWorkflowRepo.update).toHaveBeenCalledWith(WF, {
      updatedById: 'u1',
      status: 'DEACTIVATED',
    })
  })

  it('deactivate() should propagate a repository error', async () => {
    asMember()
    withWorkflow()
    mockedWorkflowRepo.update.mockResolvedValue(err(dbErr))
    expectErr(
      await CrmWorkflowService.deactivate('u1', WS, WF),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmWorkflowService — versions', () => {
  it('getDraft() should return the draft', async () => {
    asMember('VIEWER')
    withWorkflow()
    mockedVersionRepo.findDraft.mockResolvedValue(
      ok(createFakeCrmWorkflowVersion({ id: 'v1', workflowId: WF })),
    )
    const dto = expectOk(await CrmWorkflowService.getDraft('u1', WS, WF))
    expect(dto.id).toBe('v1')
    expect(dto.definition.nodes).toHaveLength(1)
  })

  it('getDraft() should return version not found when there is no draft', async () => {
    asMember()
    withWorkflow()
    mockedVersionRepo.findDraft.mockResolvedValue(ok(null))
    expectErr(
      await CrmWorkflowService.getDraft('u1', WS, WF),
      'CRM_WORKFLOW_VERSION_NOT_FOUND',
    )
  })

  it('getDraft() should propagate a repository error', async () => {
    asMember()
    withWorkflow()
    mockedVersionRepo.findDraft.mockResolvedValue(err(dbErr))
    expectErr(await CrmWorkflowService.getDraft('u1', WS, WF), 'DATABASE_ERROR')
  })

  it('listVersions() should map every version', async () => {
    asMember()
    withWorkflow()
    mockedVersionRepo.listByWorkflow.mockResolvedValue(
      ok([
        createFakeCrmWorkflowVersion({ id: 'v1', status: 'ARCHIVED' }),
        createFakeCrmWorkflowVersion({ id: 'v2', status: 'DRAFT', version: 2 }),
      ]),
    )
    const list = expectOk(await CrmWorkflowService.listVersions('u1', WS, WF))
    expect(list.map((v) => [v.id, v.status])).toEqual([
      ['v1', 'ARCHIVED'],
      ['v2', 'DRAFT'],
    ])
  })

  it('listVersions() should propagate a repository error', async () => {
    asMember()
    withWorkflow()
    mockedVersionRepo.listByWorkflow.mockResolvedValue(err(dbErr))
    expectErr(
      await CrmWorkflowService.listVersions('u1', WS, WF),
      'DATABASE_ERROR',
    )
  })

  describe('updateDraft()', () => {
    it('should save a valid definition and bump updatedBy', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(
        ok(createFakeCrmWorkflowVersion({ id: 'v1' })),
      )
      mockedVersionRepo.updateDefinition.mockResolvedValue(
        ok(createFakeCrmWorkflowVersion({ id: 'v1' })),
      )
      mockedWorkflowRepo.update.mockResolvedValue(ok(createFakeCrmWorkflow()))

      const dto = expectOk(
        await CrmWorkflowService.updateDraft('u1', WS, WF, {
          definition: FAKE_WORKFLOW_DEFINITION,
        }),
      )
      expect(dto.id).toBe('v1')
      expect(mockedVersionRepo.updateDefinition).toHaveBeenCalledWith(
        'v1',
        expect.objectContaining({ edges: FAKE_WORKFLOW_DEFINITION.edges }),
      )
      expect(mockedWorkflowRepo.update).toHaveBeenCalledWith(WF, {
        updatedById: 'u1',
      })
    })

    it('should reject when there is no draft', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(ok(null))
      expectErr(
        await CrmWorkflowService.updateDraft('u1', WS, WF, {
          definition: FAKE_WORKFLOW_DEFINITION,
        }),
        'CRM_WORKFLOW_VERSION_NOT_DRAFT',
      )
    })

    it('should propagate a findDraft error', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.updateDraft('u1', WS, WF, {
          definition: FAKE_WORKFLOW_DEFINITION,
        }),
        'DATABASE_ERROR',
      )
    })

    it('should reject an invalid definition (edge to unknown node)', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(
        ok(createFakeCrmWorkflowVersion({ id: 'v1' })),
      )
      expectErr(
        await CrmWorkflowService.updateDraft('u1', WS, WF, {
          definition: {
            ...FAKE_WORKFLOW_DEFINITION,
            edges: [{ id: 'e1', source: 'trigger', target: 'ghost' }],
          },
        }),
        'CRM_WORKFLOW_INVALID_DEFINITION',
      )
      expect(mockedVersionRepo.updateDefinition).not.toHaveBeenCalled()
    })

    it('should propagate an updateDefinition error without touching the workflow', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(
        ok(createFakeCrmWorkflowVersion({ id: 'v1' })),
      )
      mockedVersionRepo.updateDefinition.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.updateDraft('u1', WS, WF, {
          definition: FAKE_WORKFLOW_DEFINITION,
        }),
        'DATABASE_ERROR',
      )
      expect(mockedWorkflowRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('activate() edge cases', () => {
    it('should reject when there is no draft', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(ok(null))
      expectErr(
        await CrmWorkflowService.activate('u1', WS, WF),
        'CRM_WORKFLOW_VERSION_NOT_DRAFT',
      )
    })

    it('should propagate a findDraft error', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.activate('u1', WS, WF),
        'DATABASE_ERROR',
      )
    })

    it('should treat a corrupt definition as an unconfigured trigger', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(
        ok(createFakeCrmWorkflowVersion({ definition: { garbage: true } })),
      )
      expectErr(
        await CrmWorkflowService.activate('u1', WS, WF),
        'CRM_WORKFLOW_INVALID_DEFINITION',
      )
      expect(mockedVersionRepo.activateDraft).not.toHaveBeenCalled()
    })

    it('should propagate an activateDraft error', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findDraft.mockResolvedValue(
        ok(createFakeCrmWorkflowVersion({ id: 'v1' })),
      )
      mockedVersionRepo.activateDraft.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.activate('u1', WS, WF),
        'DATABASE_ERROR',
      )
    })

    it.each([
      ['reload error', err(dbErr), 'DATABASE_ERROR'],
      ['reload returns null', ok(null), 'CRM_WORKFLOW_NOT_FOUND'],
    ])('should fail on %s after activating', async (_label, reload, c) => {
      asMember()
      mockedWorkflowRepo.findById
        .mockResolvedValueOnce(
          ok(createFakeCrmWorkflow({ id: WF, workspaceId: WS })),
        )
        .mockResolvedValueOnce(reload as never)
      mockedVersionRepo.findDraft.mockResolvedValue(
        ok(createFakeCrmWorkflowVersion({ id: 'v1' })),
      )
      mockedVersionRepo.activateDraft.mockResolvedValue(ok({} as never))
      expectErr(await CrmWorkflowService.activate('u1', WS, WF), code(c))
    })
  })

  it('discard() should return the restored draft', async () => {
    asMember()
    withWorkflow()
    mockedVersionRepo.discardDraft.mockResolvedValue(
      ok(createFakeCrmWorkflowVersion({ id: 'v3' })),
    )
    const dto = expectOk(await CrmWorkflowService.discard('u1', WS, WF))
    expect(dto.id).toBe('v3')
    expect(mockedVersionRepo.discardDraft).toHaveBeenCalledWith(WF)
  })

  it('discard() should propagate a repository error', async () => {
    asMember()
    withWorkflow()
    mockedVersionRepo.discardDraft.mockResolvedValue(err(dbErr))
    expectErr(await CrmWorkflowService.discard('u1', WS, WF), 'DATABASE_ERROR')
  })
})

describe('CrmWorkflowService — runs', () => {
  it('listRuns() should map runs', async () => {
    asMember('VIEWER')
    withWorkflow()
    mockedRunRepo.listByWorkflow.mockResolvedValue(
      ok([createFakeCrmWorkflowRun({ id: 'r1', status: 'COMPLETED' })]),
    )
    const runs = expectOk(await CrmWorkflowService.listRuns('u1', WS, WF))
    expect(runs.map((r) => [r.id, r.status])).toEqual([['r1', 'COMPLETED']])
  })

  it('listRuns() should propagate a repository error', async () => {
    asMember()
    withWorkflow()
    mockedRunRepo.listByWorkflow.mockResolvedValue(err(dbErr))
    expectErr(await CrmWorkflowService.listRuns('u1', WS, WF), 'DATABASE_ERROR')
  })

  it('getRun() should return the run with its steps', async () => {
    asMember()
    withWorkflow()
    mockedRunRepo.findById.mockResolvedValue(
      ok(
        runWithSteps({ id: 'r1', workflowId: WF }, [
          createFakeCrmWorkflowRunStep({ runId: 'r1', status: 'COMPLETED' }),
        ]),
      ),
    )
    const dto = expectOk(await CrmWorkflowService.getRun('u1', WS, WF, 'r1'))
    expect(dto.id).toBe('r1')
    expect(dto.steps).toHaveLength(1)
  })

  it.each([
    ['repository error', () => err(dbErr), 'DATABASE_ERROR'],
    ['missing run', () => ok(null), 'CRM_WORKFLOW_NOT_FOUND'],
    [
      'run from another workflow',
      () => ok(runWithSteps({ id: 'r1', workflowId: 'other' })),
      'CRM_WORKFLOW_NOT_FOUND',
    ],
  ])('getRun() should fail on %s', async (_label, result, c) => {
    asMember()
    withWorkflow()
    mockedRunRepo.findById.mockResolvedValue(result() as never)
    expectErr(await CrmWorkflowService.getRun('u1', WS, WF, 'r1'), code(c))
  })

  describe('triggerManual() edge cases', () => {
    function arrange(opts: { test: boolean }) {
      asMember()
      withWorkflow()
      const version = createFakeCrmWorkflowVersion({ id: 'v1' })
      if (opts.test) mockedVersionRepo.findDraft.mockResolvedValue(ok(version))
      else mockedVersionRepo.findActive.mockResolvedValue(ok(version))
      mockedRunRepo.create.mockResolvedValue(
        ok(createFakeCrmWorkflowRun({ id: 'r1', workflowId: WF })),
      )
    }

    it('should use the DRAFT in test mode and pass the payload', async () => {
      arrange({ test: true })
      mockedRunCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById.mockResolvedValue(
        ok(runWithSteps({ id: 'r1', workflowId: WF, status: 'COMPLETED' })),
      )
      const dto = expectOk(
        await CrmWorkflowService.triggerManual('u1', WS, WF, {
          payload: { name: 'Ana' },
          test: true,
        }),
      )
      expect(dto.status).toBe('COMPLETED')
      expect(mockedVersionRepo.findDraft).toHaveBeenCalledWith(WF)
      expect(mockedVersionRepo.findActive).not.toHaveBeenCalled()
      expect(mockedRunRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          versionId: 'v1',
          triggerType: 'LAUNCH_MANUALLY',
          triggerPayload: { name: 'Ana' },
          startedById: 'u1',
        }),
      )
      expect(mockedRunCrmWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          testMode: true,
          triggerPayload: { name: 'Ana' },
          definition: FAKE_WORKFLOW_DEFINITION,
        }),
      )
    })

    it('should default a missing payload to {} on the run row', async () => {
      arrange({ test: false })
      mockedRunCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById.mockResolvedValue(
        ok(runWithSteps({ id: 'r1', workflowId: WF })),
      )
      expectOk(
        await CrmWorkflowService.triggerManual('u1', WS, WF, {
          test: false,
        } as never),
      )
      expect(mockedRunRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ triggerPayload: {} }),
      )
    })

    it('should fail when there is no version to run', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findActive.mockResolvedValue(ok(null))
      expectErr(
        await CrmWorkflowService.triggerManual('u1', WS, WF, {
          payload: {},
          test: false,
        }),
        'CRM_WORKFLOW_VERSION_NOT_FOUND',
      )
      expect(mockedRunRepo.create).not.toHaveBeenCalled()
    })

    it('should propagate a version lookup error', async () => {
      asMember()
      withWorkflow()
      mockedVersionRepo.findActive.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.triggerManual('u1', WS, WF, {
          payload: {},
          test: false,
        }),
        'DATABASE_ERROR',
      )
    })

    it('should propagate a run creation error', async () => {
      arrange({ test: false })
      mockedRunRepo.create.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.triggerManual('u1', WS, WF, {
          payload: {},
          test: false,
        }),
        'DATABASE_ERROR',
      )
      expect(mockedRunCrmWorkflow).not.toHaveBeenCalled()
    })

    it.each([
      [new Error('runner exploded'), 'runner exploded'],
      ['plain string', 'plain string'],
    ])('should wrap a runner throw (%s) as EXECUTION_FAILED', async (thrown, message) => {
      arrange({ test: false })
      mockedRunCrmWorkflow.mockRejectedValue(thrown)
      const error = expectErr(
        await CrmWorkflowService.triggerManual('u1', WS, WF, {
          payload: {},
          test: false,
        }),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      )
      expect(JSON.stringify(error)).toContain(message)
    })

    it.each([
      ['reload error', err(dbErr), 'DATABASE_ERROR'],
      ['reload returns null', ok(null), 'CRM_WORKFLOW_NOT_FOUND'],
    ])('should fail on %s after running', async (_label, reload, c) => {
      arrange({ test: false })
      mockedRunCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById.mockResolvedValue(reload as never)
      expectErr(
        await CrmWorkflowService.triggerManual('u1', WS, WF, {
          payload: {},
          test: false,
        }),
        code(c),
      )
    })
  })

  describe('resumeRun() edge cases', () => {
    const FORM_DEFINITION = {
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'f1',
          position: { x: 0, y: 0 },
          data: {
            type: 'form',
            title: 'Aprovação',
            fields: [{ name: 'ok', type: 'boolean', required: true }],
            outputAlias: 'approval',
          },
        },
        {
          id: 'f2',
          position: { x: 0, y: 0 },
          data: {
            type: 'form',
            title: 'Sem alias',
            fields: [{ name: 'note', type: 'text', required: false }],
          },
        },
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { type: 'delay', amount: 1, unit: 'minutes' },
        },
      ],
      edges: [],
    }

    function waitingRun(
      nodeId: string,
      overrides: Parameters<typeof createFakeCrmWorkflowRun>[0] = {},
    ) {
      return runWithSteps(
        {
          id: 'r1',
          workflowId: WF,
          versionId: 'v1',
          status: 'WAITING',
          waitingStepId: 's1',
          state: { trigger: {} },
          triggerPayload: { a: 1 },
          ...overrides,
        },
        [createFakeCrmWorkflowRunStep({ id: 's1', runId: 'r1', nodeId })],
      )
    }

    function arrange(nodeId: string) {
      asMember()
      withWorkflow()
      mockedRunRepo.findById.mockResolvedValue(ok(waitingRun(nodeId)))
      mockedVersionRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmWorkflowVersion({
            id: 'v1',
            definition: FORM_DEFINITION as never,
          }),
        ),
      )
    }

    it('should resume with the node outputAlias and the persisted scope', async () => {
      arrange('f1')
      mockedResumeCrmWorkflow.mockResolvedValue(undefined)
      const dto = expectOk(
        await CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', {
          payload: { ok: true },
        }),
      )
      expect(dto.id).toBe('r1')
      expect(mockedResumeCrmWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'r1',
          waitingStepId: 's1',
          pausedNodeId: 'f1',
          outputAlias: 'approval',
          scope: { trigger: {} },
          submission: { ok: true },
          triggerPayload: { a: 1 },
        }),
      )
    })

    it('should fall back to the node id when the form has no alias', async () => {
      arrange('f2')
      mockedResumeCrmWorkflow.mockResolvedValue(undefined)
      expectOk(
        await CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', { payload: {} }),
      )
      expect(mockedResumeCrmWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ outputAlias: 'f2' }),
      )
    })

    it.each([
      ['repository error', () => err(dbErr), 'DATABASE_ERROR'],
      ['missing run', () => ok(null), 'CRM_WORKFLOW_NOT_FOUND'],
      [
        'run from another workflow',
        () => ok(waitingRun('f1', { workflowId: 'other' })),
        'CRM_WORKFLOW_NOT_FOUND',
      ],
      [
        'run without waitingStepId',
        () => ok(waitingRun('f1', { waitingStepId: null })),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      ],
      [
        'run without state',
        () => ok(waitingRun('f1', { state: null })),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      ],
      [
        'waiting step missing from steps',
        () => ok(waitingRun('f1', { waitingStepId: 'ghost' })),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      ],
    ])('should fail on %s', async (_label, result, c) => {
      asMember()
      withWorkflow()
      mockedRunRepo.findById.mockResolvedValue(result() as never)
      expectErr(
        await CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', { payload: {} }),
        code(c),
      )
      expect(mockedResumeCrmWorkflow).not.toHaveBeenCalled()
    })

    it.each([
      ['version lookup error', err(dbErr), 'DATABASE_ERROR'],
      ['missing version', ok(null), 'CRM_WORKFLOW_VERSION_NOT_FOUND'],
    ])('should fail on %s', async (_label, version, c) => {
      arrange('f1')
      mockedVersionRepo.findById.mockResolvedValue(version as never)
      expectErr(
        await CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', { payload: {} }),
        code(c),
      )
    })

    it.each([
      ['a node that is not a form', 'n1'],
      ['a node missing from the definition', 'gone'],
    ])('should reject when the paused step points to %s', async (_label, nodeId) => {
      arrange(nodeId)
      expectErr(
        await CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', { payload: {} }),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      )
      expect(mockedResumeCrmWorkflow).not.toHaveBeenCalled()
    })

    it.each([
      [new Error('resume exploded'), 'resume exploded'],
      [42, '42'],
    ])('should wrap a resume throw (%s)', async (thrown, message) => {
      arrange('f1')
      mockedResumeCrmWorkflow.mockRejectedValue(thrown)
      const error = expectErr(
        await CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', { payload: {} }),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      )
      expect(JSON.stringify(error)).toContain(message)
    })

    it.each([
      ['reload error', err(dbErr), 'DATABASE_ERROR'],
      ['reload returns null', ok(null), 'CRM_WORKFLOW_NOT_FOUND'],
    ])('should fail on %s after resuming', async (_label, reload, c) => {
      arrange('f1')
      mockedResumeCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById
        .mockResolvedValueOnce(ok(waitingRun('f1')))
        .mockResolvedValueOnce(reload as never)
      expectErr(
        await CrmWorkflowService.resumeRun('u1', WS, WF, 'r1', { payload: {} }),
        code(c),
      )
    })
  })

  describe('triggerWebhook() edge cases', () => {
    function arrangeMatch() {
      mockedWorkflowRepo.findActiveByWebhookToken.mockResolvedValue(
        ok({
          ...createFakeCrmWorkflow({
            id: WF,
            workspaceId: WS,
            createdById: 'owner',
          }),
          activeVersion: createFakeCrmWorkflowVersion({ id: 'v1' }),
        } as never),
      )
      mockedRunRepo.create.mockResolvedValue(
        ok(createFakeCrmWorkflowRun({ id: 'r1', workflowId: WF })),
      )
    }

    it('should propagate a token lookup error', async () => {
      mockedWorkflowRepo.findActiveByWebhookToken.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.triggerWebhook('tok', {}),
        'DATABASE_ERROR',
      )
    })

    it('should reject a workflow without an active version', async () => {
      mockedWorkflowRepo.findActiveByWebhookToken.mockResolvedValue(
        ok({ ...createFakeCrmWorkflow(), activeVersion: null } as never),
      )
      expectErr(
        await CrmWorkflowService.triggerWebhook('tok', {}),
        'CRM_WORKFLOW_WEBHOOK_INVALID',
      )
    })

    it('should reject when the CRM module is disabled for the workspace', async () => {
      arrangeMatch()
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmWorkflowService.triggerWebhook('tok', {}),
        'MODULE_DISABLED',
      )
      expect(mockedRunRepo.create).not.toHaveBeenCalled()
    })

    it('should run as the workflow creator with an empty payload row when none is sent', async () => {
      arrangeMatch()
      mockedRunCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById.mockResolvedValue(
        ok(runWithSteps({ id: 'r1', workflowId: WF })),
      )
      expectOk(await CrmWorkflowService.triggerWebhook('tok', undefined))
      expect(mockedRunRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerType: 'WEBHOOK',
          triggerPayload: {},
          startedById: null,
        }),
      )
      expect(mockedRunCrmWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          actingUserId: 'owner',
          workspaceId: WS,
          testMode: false,
        }),
      )
    })

    it('should propagate a run creation error', async () => {
      arrangeMatch()
      mockedRunRepo.create.mockResolvedValue(err(dbErr))
      expectErr(
        await CrmWorkflowService.triggerWebhook('tok', {}),
        'DATABASE_ERROR',
      )
    })

    it.each([
      [new Error('webhook exploded'), 'webhook exploded'],
      ['raw', 'raw'],
    ])('should wrap a runner throw (%s)', async (thrown, message) => {
      arrangeMatch()
      mockedRunCrmWorkflow.mockRejectedValue(thrown)
      const error = expectErr(
        await CrmWorkflowService.triggerWebhook('tok', {}),
        'CRM_WORKFLOW_EXECUTION_FAILED',
      )
      expect(JSON.stringify(error)).toContain(message)
    })

    it.each([
      ['reload error', err(dbErr), 'DATABASE_ERROR'],
      ['reload returns null', ok(null), 'CRM_WORKFLOW_NOT_FOUND'],
    ])('should fail on %s after running', async (_label, reload, c) => {
      arrangeMatch()
      mockedRunCrmWorkflow.mockResolvedValue(undefined)
      mockedRunRepo.findById.mockResolvedValue(reload as never)
      expectErr(await CrmWorkflowService.triggerWebhook('tok', {}), code(c))
    })
  })
})
