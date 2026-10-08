import { describe, expect, it } from 'vitest'
import { createFakeSteelAgentRun } from '@/src/__tests__/factories/steel-agent.factory'
import {
  createFakeAiActionLog,
  createFakeAiMessage,
} from '@/src/__tests__/factories/steel-ai.factory'
import { simulatedToolResult } from '@/src/lib/ai/tools/simulation'
import { toAiActionLogDTO } from '../ai-action-log.mapper'
import { toAiMessageDTOs, toolCallStatusOf } from '../ai-conversation.mapper'
import { toSteelAgentRunDTO } from '../steel-agent.mapper'

const meta = (name: string) => ({ label: name, module: 'CRM' as const })

describe('Teste mode mapping', () => {
  it('should fold a simulated TOOL row into the call with its simulation', () => {
    const preview = { title: 'Criar o lead “Mariana”', summary: 'Novo lead' }
    const rows = [
      createFakeAiMessage({ id: 'u1', role: 'USER', content: 'Cadastre' }),
      createFakeAiMessage({
        id: 'a1',
        role: 'ASSISTANT',
        content: 'Eu criaria o lead.',
        toolCalls: [{ id: 'c1', name: 'crm_create_lead', arguments: {} }],
      }),
      createFakeAiMessage({
        id: 't1',
        role: 'TOOL',
        toolCallId: 'c1',
        content: JSON.stringify(simulatedToolResult('CREATE', preview)),
      }),
    ]

    const [, turn] = toAiMessageDTOs(rows, [], meta)

    expect(turn.toolCalls).toEqual([
      {
        id: 'c1',
        name: 'crm_create_lead',
        label: 'crm_create_lead',
        module: 'CRM',
        status: 'simulated',
        summary: preview.title,
        simulation: { kind: 'CREATE', preview },
      },
    ])
    expect(turn.pendingActions).toEqual([])
    expect(toolCallStatusOf({ status: 'simulated' })).toBe('simulated')
  })

  it('should keep the simulated outcome of an action log', () => {
    const row = createFakeAiActionLog({ outcome: 'simulated', error: null })
    expect(toAiActionLogDTO(row).outcome).toBe('simulated')
  })

  it('should expose whether an agent run is a test', () => {
    expect(toSteelAgentRunDTO(createFakeSteelAgentRun()).isTest).toBe(false)
    expect(
      toSteelAgentRunDTO(createFakeSteelAgentRun({ isTest: true })).isTest,
    ).toBe(true)
  })
})
