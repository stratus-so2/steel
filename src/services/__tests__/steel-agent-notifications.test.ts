import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/src/services/notification-emitter', () => ({
  emitNotification: vi.fn(async () => 1),
  workspaceAdminIds: vi.fn(async () => ['admin1', 'admin2']),
}))

import {
  emitNotification,
  workspaceAdminIds,
} from '@/src/services/notification-emitter'
import {
  notifyAgentApprovalRequested,
  notifyAgentRunFailed,
  steelAgentRunPath,
} from '../steel-agent-notifications'

const emit = vi.mocked(emitNotification)

beforeEach(() => {
  vi.mocked(workspaceAdminIds).mockResolvedValue(['admin1', 'admin2'])
  emit.mockResolvedValue(1)
})

describe('steel agent notifications', () => {
  it('should build the run path', () => {
    expect(steelAgentRunPath('a1', 'r1')).toBe('/ai/agents/a1/runs/r1')
  })

  it('should notify owner and admins about a pending approval', async () => {
    await notifyAgentApprovalRequested({
      workspaceId: 'ws1',
      agentId: 'a1',
      agentName: 'Triagem',
      ownerId: 'owner1',
      runId: 'r1',
      round: 2,
      count: 1,
    })
    expect(emit).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      recipients: ['owner1', 'admin1', 'admin2'],
      kind: 'AGENT_APPROVAL_REQUESTED',
      title: 'Triagem aguarda aprovação',
      body: 'O agente propôs uma ação que precisa da sua aprovação.',
      path: '/ai/agents/a1/runs/r1',
      dedupeKey: 'agent-approval:r1:2',
    })
  })

  it('should pluralize several pending approvals', async () => {
    await notifyAgentApprovalRequested({
      workspaceId: 'ws1',
      agentId: 'a1',
      agentName: 'Triagem',
      ownerId: null,
      runId: 'r1',
      round: 1,
      count: 3,
    })
    expect(emit.mock.calls[0][0].body).toBe(
      'O agente propôs 3 ações que precisam da sua aprovação.',
    )
  })

  it('should notify owner and creator about a failure', async () => {
    await notifyAgentRunFailed({
      workspaceId: 'ws1',
      agentId: 'a1',
      agentName: 'Triagem',
      ownerId: 'owner1',
      createdById: 'admin1',
      runId: 'r1',
      error: 'x'.repeat(400),
    })
    const input = emit.mock.calls[0][0]
    expect(input.kind).toBe('AGENT_RUN_FAILED')
    expect(input.recipients).toEqual(['owner1', 'admin1'])
    expect(input.body).toHaveLength(280)
    expect(input.dedupeKey).toBe('agent-run-failed:r1')
  })
})
