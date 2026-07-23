import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from '@/src/lib/mail/send'
import { ok } from '@/src/lib/result'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import { executeCrmWorkflowNode } from '../crm-workflow-runner'

vi.mock('@/src/repositories/crm-person.repository')
vi.mock('@/src/repositories/crm-task.repository')
vi.mock('@/src/lib/mail/send')

const mockedPersonRepo = vi.mocked(CrmPersonRepository)
const mockedTaskRepo = vi.mocked(CrmTaskRepository)
const mockedSendEmail = vi.mocked(sendEmail)

const ctx = {
  workspaceId: 'ws-1',
  createdById: 'user-1',
  trigger: { email: 'lead@acme.com' },
}

describe('executeCrmWorkflowNode()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a person and resolve trigger interpolation', async () => {
    mockedPersonRepo.create.mockResolvedValue(ok({ id: 'p-1' } as never))

    const result = await executeCrmWorkflowNode(
      'CREATE_PERSON',
      { name: 'Fulano', email: '{{trigger.email}}' },
      ctx,
    )

    expect(result.ok).toBe(true)
    expect(mockedPersonRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ emails: ['lead@acme.com'] }),
    )
  })

  it('should fail CREATE_TASK without a title', async () => {
    const result = await executeCrmWorkflowNode('CREATE_TASK', {}, ctx)
    expect(result.ok).toBe(false)
    expect(mockedTaskRepo.create).not.toHaveBeenCalled()
  })

  it('should send an email via SEND_EMAIL', async () => {
    mockedSendEmail.mockResolvedValue({ id: 'msg-1' } as never)

    const result = await executeCrmWorkflowNode(
      'SEND_EMAIL',
      { to: 'lead@acme.com', subject: 'Oi', contentHtml: '<p>Oi</p>' },
      ctx,
    )

    expect(result.ok).toBe(true)
    expect(result.output).toEqual({ messageId: 'msg-1' })
  })

  it('should return an error result when sendEmail throws', async () => {
    mockedSendEmail.mockRejectedValue(new Error('boom'))

    const result = await executeCrmWorkflowNode(
      'SEND_EMAIL',
      { to: 'lead@acme.com', subject: 'Oi', contentHtml: '<p>Oi</p>' },
      ctx,
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
  })
})
