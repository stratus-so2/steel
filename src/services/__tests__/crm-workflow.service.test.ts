import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmWorkflow,
  createFakeCrmWorkflowRun,
  createFakeCrmWorkflowVersion,
} from '@/src/__tests__/factories/crm-workflow.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-workflow.repository')
vi.mock('@/src/services/crm-workflow-runner')

import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
  CrmWorkflowVersionRepository,
} from '@/src/repositories/crm-workflow.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
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
