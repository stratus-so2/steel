import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmWorkflow,
  createFakeCrmWorkflowRun,
} from '@/src/__tests__/factories/crm-workflow.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-workflow.repository')
vi.mock('@/src/repositories/crm-person.repository')
vi.mock('@/src/repositories/crm-task.repository')
vi.mock('@/src/lib/mail/send')

import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
  CrmWorkflowRunStepRepository,
} from '@/src/repositories/crm-workflow.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmWorkflowService } from '../crm-workflow.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedWorkflowRepo = vi.mocked(CrmWorkflowRepository)
const mockedRunRepo = vi.mocked(CrmWorkflowRunRepository)
const mockedStepRepo = vi.mocked(CrmWorkflowRunStepRepository)
const mockedTaskRepo = vi.mocked(CrmTaskRepository)

describe('CrmWorkflowService', () => {
  describe('runFromWebhook()', () => {
    it('should return CRM_WORKFLOW_NOT_ACTIVE for a draft workflow', async () => {
      mockedWorkflowRepo.findByWebhookToken.mockResolvedValue(
        ok(createFakeCrmWorkflow({ triggerType: 'WEBHOOK', status: 'DRAFT' })),
      )

      expectErr(
        await CrmWorkflowService.runFromWebhook('wfh_token', {}),
        'CRM_WORKFLOW_NOT_ACTIVE',
      )
    })

    it('should return CRM_WORKFLOW_NOT_ACTIVE for a MANUAL-only workflow', async () => {
      mockedWorkflowRepo.findByWebhookToken.mockResolvedValue(
        ok(createFakeCrmWorkflow({ triggerType: 'MANUAL', status: 'ACTIVE' })),
      )

      expectErr(
        await CrmWorkflowService.runFromWebhook('wfh_token', {}),
        'CRM_WORKFLOW_NOT_ACTIVE',
      )
    })

    it('should execute nodes sequentially and mark the run completed', async () => {
      const workflow = createFakeCrmWorkflow({
        id: 'w1',
        triggerType: 'WEBHOOK',
        status: 'ACTIVE',
        definition: {
          nodes: [
            { id: 'n1', type: 'CREATE_TASK', config: { title: 'Ligar' } },
          ],
        } as never,
      })
      mockedWorkflowRepo.findByWebhookToken.mockResolvedValue(ok(workflow))
      mockedRunRepo.create.mockResolvedValue(
        ok(createFakeCrmWorkflowRun({ id: 'r1', workflowId: 'w1' })),
      )
      mockedTaskRepo.create.mockResolvedValue(
        err({ code: 'DATABASE_ERROR', message: 'boom' } as never),
      )
      mockedStepRepo.create.mockResolvedValue(
        ok({
          id: 's1',
          runId: 'r1',
          nodeId: 'n1',
          nodeType: 'CREATE_TASK',
          status: 'RUNNING',
          input: null,
          output: null,
          error: null,
          startedAt: new Date(),
          finishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )
      mockedStepRepo.finish.mockResolvedValue(
        ok({
          id: 's1',
          runId: 'r1',
          nodeId: 'n1',
          nodeType: 'CREATE_TASK',
          status: 'FAILED',
          input: null,
          output: null,
          error: 'CRM_TASK_TITLE_MISSING',
          startedAt: new Date(),
          finishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )
      mockedRunRepo.finish.mockResolvedValue(
        ok(
          createFakeCrmWorkflowRun({
            id: 'r1',
            workflowId: 'w1',
            status: 'FAILED',
          }),
        ),
      )
      mockedWorkflowRepo.touchLastRunAt.mockResolvedValue(ok(undefined))

      const result = expectOk(
        await CrmWorkflowService.runFromWebhook('wfh_token', {}),
      )
      expect(mockedRunRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'w1', triggerType: 'WEBHOOK' }),
      )
      expect(result.workflowId).toBe('w1')
    })
  })

  describe('runManually()', () => {
    it('should require workspace membership', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(
        await CrmWorkflowService.runManually('u1', 'ws1', 'w1'),
        'FORBIDDEN',
      )
    })

    it('should run regardless of workflow status when triggered manually', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkflowRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmWorkflow({
            id: 'w1',
            status: 'DRAFT',
            definition: { nodes: [] } as never,
          }),
        ),
      )
      mockedRunRepo.create.mockResolvedValue(
        ok(createFakeCrmWorkflowRun({ id: 'r1', workflowId: 'w1' })),
      )
      mockedRunRepo.finish.mockResolvedValue(
        ok(createFakeCrmWorkflowRun({ id: 'r1', workflowId: 'w1' })),
      )
      mockedWorkflowRepo.touchLastRunAt.mockResolvedValue(ok(undefined))

      const result = expectOk(
        await CrmWorkflowService.runManually('u1', 'ws1', 'w1'),
      )
      expect(result.id).toBe('r1')
    })
  })
})
