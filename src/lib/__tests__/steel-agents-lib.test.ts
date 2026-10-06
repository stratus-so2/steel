import { describe, expect, it } from 'vitest'
import {
  STEEL_AGENT_EVENT_KEYS,
  steelAgentEvent,
} from '@/src/lib/steel-agents/events'
import {
  buildSteelAgentDecisionMessage,
  buildSteelAgentSystemPrompt,
  buildSteelAgentTriggerMessage,
} from '@/src/lib/steel-agents/prompt'
import {
  currentSteelAgentContext,
  runInSteelAgentContext,
} from '@/src/lib/steel-agents/run-context'
import {
  isValidCron,
  isValidTimeZone,
  nextCronRun,
  normalizeSteelAgentTrigger,
  previousCronRun,
  steelAgentTriggerProblem,
} from '@/src/lib/steel-agents/schedule'
import { effectiveToolMode } from '@/src/lib/steel-agents/tool-mode'

const NOW = new Date('2026-10-06T12:00:20.000Z')

describe('steel agents schedule', () => {
  it('should validate timezones and 5-field crons', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true)
    expect(isValidTimeZone('Mars/Base')).toBe(false)
    expect(isValidCron('0 8 * * 1-5', 'UTC')).toBe(true)
    expect(isValidCron('0 0 8 * * 1-5', 'UTC')).toBe(false)
    expect(isValidCron('99 * * * *', 'UTC')).toBe(false)
  })

  it('should compute next and previous occurrences in the timezone', () => {
    expect(nextCronRun('0 9 * * *', 'America/Sao_Paulo', NOW)).toEqual(
      new Date('2026-10-07T12:00:00.000Z'),
    )
    expect(previousCronRun('0 9 * * *', 'America/Sao_Paulo', NOW)).toEqual(
      new Date('2026-10-06T12:00:00.000Z'),
    )
    expect(nextCronRun('bad', 'UTC', NOW)).toBeNull()
    expect(previousCronRun('0 9 * * *', 'Mars/Base', NOW)).toBeNull()
    expect(nextCronRun('0 9 * * *', 'UTC')).toBeInstanceOf(Date)
    expect(previousCronRun('0 9 * * *', 'UTC')).toBeInstanceOf(Date)
  })

  it('should report trigger problems', () => {
    expect(steelAgentTriggerProblem({ triggerType: 'MANUAL' })).toBeNull()
    expect(
      steelAgentTriggerProblem({ triggerType: 'SCHEDULE', cron: '0 8 * * *' }),
    ).toBeNull()
    expect(
      steelAgentTriggerProblem({
        triggerType: 'SCHEDULE',
        cron: '0 8 * * *',
        timezone: 'Mars/Base',
      }),
    ).toBe('Fuso horário inválido')
    expect(steelAgentTriggerProblem({ triggerType: 'SCHEDULE' })).toContain(
      'cron',
    )
    expect(steelAgentTriggerProblem({ triggerType: 'EVENT' })).toContain(
      'evento',
    )
    expect(
      steelAgentTriggerProblem({ triggerType: 'EVENT', eventKey: 'x' }),
    ).toContain('evento')
    expect(
      steelAgentTriggerProblem({
        triggerType: 'EVENT',
        eventKey: 'sd.ticket.created',
      }),
    ).toBeNull()
  })

  it('should normalize trigger columns', () => {
    expect(
      normalizeSteelAgentTrigger(
        { triggerType: 'SCHEDULE', cron: ' 0  9 * * * ', eventKey: 'x' },
        NOW,
      ),
    ).toEqual({
      cron: '0 9 * * *',
      timezone: 'America/Sao_Paulo',
      eventKey: null,
      nextRunAt: new Date('2026-10-07T12:00:00.000Z'),
    })
    expect(
      normalizeSteelAgentTrigger({
        triggerType: 'EVENT',
        eventKey: 'crm.lead.created',
        cron: '0 9 * * *',
        timezone: 'UTC',
      }),
    ).toEqual({
      cron: null,
      timezone: 'UTC',
      eventKey: 'crm.lead.created',
      nextRunAt: null,
    })
    expect(normalizeSteelAgentTrigger({ triggerType: 'EVENT' }).eventKey).toBe(
      null,
    )
    expect(
      normalizeSteelAgentTrigger({ triggerType: 'MANUAL', eventKey: 'x' })
        .eventKey,
    ).toBeNull()
  })
})

describe('steel agents events and tool mode', () => {
  it('should expose the event catalog', () => {
    expect(STEEL_AGENT_EVENT_KEYS).toContain('sd.ticket.created')
    expect(steelAgentEvent('zap.ai.handoff')?.module).toBe('COMMUNICATION')
    expect(steelAgentEvent('nope')).toBeUndefined()
  })

  it('should lock DELETE tools to approval', () => {
    expect(effectiveToolMode('DELETE', 'AUTO')).toBe('APPROVAL')
    expect(effectiveToolMode('CREATE', 'AUTO')).toBe('AUTO')
    expect(effectiveToolMode(undefined, 'APPROVAL')).toBe('APPROVAL')
  })
})

describe('steel agents prompt', () => {
  it('should build the system prompt with instructions and modules', () => {
    const prompt = buildSteelAgentSystemPrompt({
      agentName: 'Triagem',
      instructions: 'Classifique.',
      workspaceName: 'Acme',
      ownerName: 'Ana',
      now: NOW,
      timezone: 'America/Sao_Paulo',
      modules: ['SERVICE_DESK', 'CRM'],
    })
    expect(prompt).toContain('"Triagem"')
    expect(prompt).toContain('Classifique.')
    expect(prompt).toContain('ServiceDesk, CRM')
    expect(
      buildSteelAgentSystemPrompt({
        agentName: 'X',
        instructions: 'Y',
        workspaceName: 'W',
        ownerName: 'O',
        now: NOW,
        timezone: 'UTC',
        modules: [],
      }),
    ).toContain('nenhum módulo habilitado')
  })

  it('should describe each trigger', () => {
    expect(
      buildSteelAgentTriggerMessage({ triggerType: 'MANUAL', payload: null }),
    ).toContain('manual')
    expect(
      buildSteelAgentTriggerMessage({
        triggerType: 'SCHEDULE',
        payload: { scheduledFor: 'x' },
      }),
    ).toContain('<dados>')
    expect(
      buildSteelAgentTriggerMessage({
        triggerType: 'EVENT',
        payload: {},
        eventKey: 'unknown.event',
      }),
    ).toContain('unknown.event')
    expect(
      buildSteelAgentTriggerMessage({ triggerType: 'EVENT', payload: 'x' }),
    ).toContain('desconhecido')
  })

  it('should describe decisions, including undecided ones', () => {
    const message = buildSteelAgentDecisionMessage([
      { title: 'A', status: 'EXECUTED', resultSummary: null, error: null },
      { title: 'B', status: 'PENDING', resultSummary: null, error: null },
    ])
    expect(message).toContain('- A: aprovada e executada.')
    expect(message).toContain('- B: ainda sem decisão.')
  })
})

describe('steel agents run context', () => {
  it('should expose the agent context only inside the callback', async () => {
    expect(currentSteelAgentContext()).toBeUndefined()
    const seen = await runInSteelAgentContext(
      { agentId: 'a1', runId: 'r1' },
      async () => currentSteelAgentContext(),
    )
    expect(seen).toEqual({ agentId: 'a1', runId: 'r1' })
    expect(currentSteelAgentContext()).toBeUndefined()
  })
})
