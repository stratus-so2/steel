import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { validationError } from '@/src/errors/app-error'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/ai-action-log.repository')
vi.mock('@/src/services/ai-memory.service')

import { AiActionLogRepository } from '@/src/repositories/ai-action-log.repository'
import { AiMemoryService } from '@/src/services/ai-memory.service'
import { memoryForgetTool, memorySaveTool } from '../ai/context/memory-tools'
import { buildSteelAiSystemPrompt } from '../ai/steel-ai-prompt'
import {
  type AiToolAccess,
  availableTools,
  isToolAllowed,
  isWriteMode,
  simulateWriteTool,
} from '../ai/tools/registry'
import {
  readSimulation,
  SIMULATED_NOTE,
  simulatedToolResult,
} from '../ai/tools/simulation'
import { parseToolResult } from '../ai/tools/tool-result'
import type { AnySteelAiTool } from '../ai/tools/types'

const logs = vi.mocked(AiActionLogRepository)
const ctx = { workspaceId: 'ws1', actorId: 'u1', source: 'assistant' as const }

function tool(overrides: Partial<AnySteelAiTool>): AnySteelAiTool {
  return {
    name: 'x_tool',
    label: 'Ferramenta',
    module: null,
    kind: 'READ',
    description: 'd',
    parameters: { type: 'object', properties: {} },
    parse: (args) => ok(args),
    execute: vi.fn(async () => ok({ data: { a: 1 }, summary: 'ok' })),
    ...overrides,
  }
}

const PREVIEW = {
  title: 'Criar o lead “Mariana”',
  summary: 'Novo lead',
  fields: [{ label: 'Nome', after: 'Mariana' }],
  target: { type: 'crm_lead', id: 'lead1', label: 'Mariana' },
}

const access = (overrides: Partial<AiToolAccess> = {}): AiToolAccess => ({
  modules: ['CRM'],
  isPrivileged: true,
  permissions: null,
  agentModeEnabled: true,
  aiEnabled: true,
  agentsEnabled: true,
  autopilotEnabled: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  logs.create.mockResolvedValue(ok({} as never))
})

describe('TEST mode filter', () => {
  const read = tool({ name: 'crm_list', module: 'CRM' })
  const write = tool({
    name: 'crm_create',
    module: 'CRM',
    kind: 'CREATE',
    preview: vi.fn(),
  })

  it('should offer writes in TEST even with the agent mode switched off', () => {
    expect(isWriteMode('TEST')).toBe(true)
    const names = availableTools(access({ agentModeEnabled: false }), 'TEST', [
      read,
      write,
    ]).map((t) => t.name)
    expect(names).toEqual(['crm_list', 'crm_create'])
    // Build still needs the switch.
    expect(
      isToolAllowed(write, access({ agentModeEnabled: false }), 'AGENT'),
    ).toBe(false)
  })

  it('should still filter by module in TEST', () => {
    expect(isToolAllowed(write, access({ modules: [] }), 'TEST')).toBe(false)
  })
})

describe('simulateWriteTool()', () => {
  it('should preview, log as simulated and never execute', async () => {
    const execute = vi.fn()
    const write = tool({
      name: 'crm_create_lead',
      module: 'CRM',
      kind: 'CREATE',
      preview: vi.fn(async () => ok(PREVIEW)),
      execute,
    })

    const result = await simulateWriteTool(
      write,
      ctx,
      { name: 'Mariana' },
      { actorId: 'u1' },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(execute).not.toHaveBeenCalled()
    expect(result.simulation).toEqual({ kind: 'CREATE', preview: PREVIEW })
    const payload = parseToolResult(result.content)
    expect(payload.status).toBe('simulated')
    expect(payload.note).toBe(SIMULATED_NOTE)
    expect(readSimulation(payload)).toEqual(result.simulation)
    expect(logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        source: 'ASSISTANT',
        actorId: 'u1',
        agentId: null,
        toolName: 'crm_create_lead',
        kind: 'CREATE',
        module: 'CRM',
        targetType: 'crm_lead',
        targetId: 'lead1',
        outcome: 'simulated',
        summary: PREVIEW.title,
      }),
    )
  })

  it('should log agent simulations as AGENT with the given actor', async () => {
    const write = tool({
      kind: 'ACTION',
      preview: vi.fn(async () => ok({ title: 'Enviar', summary: 's' })),
    })
    await simulateWriteTool(
      write,
      { ...ctx, source: 'agent', agentId: 'ag1' },
      {},
      { actorId: null },
    )
    expect(logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'AGENT',
        actorId: null,
        agentId: 'ag1',
        targetType: null,
        targetId: null,
      }),
    )
  })

  it('should keep going when the action log cannot be written', async () => {
    logs.create.mockResolvedValue(err(databaseError()))
    const write = tool({
      kind: 'UPDATE',
      preview: vi.fn(async () => ok({ title: 'Alterar', summary: 's' })),
    })
    const result = await simulateWriteTool(write, ctx, {}, { actorId: 'u1' })
    expect(result.ok).toBe(true)
  })

  it('should refuse READ tools and writes without preview', async () => {
    const read = await simulateWriteTool(tool({}), ctx, {}, { actorId: 'u1' })
    expect(read.ok).toBe(false)
    if (!read.ok) expect(read.error.code).toBe('AI_TOOL_NOT_ALLOWED')
    const noPreview = await simulateWriteTool(
      tool({ kind: 'DELETE' }),
      ctx,
      {},
      { actorId: 'u1' },
    )
    expect(noPreview.ok).toBe(false)
    expect(logs.create).not.toHaveBeenCalled()
  })

  it('should answer parse and preview failures as tool errors', async () => {
    const badArgs = tool({
      kind: 'CREATE',
      parse: () => err(validationError('Argumentos inválidos')),
      preview: vi.fn(),
    })
    const parsed = await simulateWriteTool(badArgs, ctx, {}, { actorId: 'u1' })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parseToolResult(parsed.content).status).toBe('error')
    }

    const refused = tool({
      kind: 'CREATE',
      preview: vi.fn(async () => err(validationError('Lead não existe'))),
    })
    const preview = await simulateWriteTool(refused, ctx, {}, { actorId: 'u1' })
    expect(preview.ok).toBe(false)
    if (!preview.ok) expect(preview.error.message).toBe('Lead não existe')

    const throws = tool({
      kind: 'CREATE',
      preview: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const thrown = await simulateWriteTool(throws, ctx, {}, { actorId: 'u1' })
    expect(thrown.ok).toBe(false)
    if (!thrown.ok) expect(thrown.error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(logs.create).not.toHaveBeenCalled()
  })
})

describe('readSimulation()', () => {
  it('should read back what simulatedToolResult wrote', () => {
    const payload = simulatedToolResult('DELETE', {
      title: 'Excluir',
      summary: 'x',
    })
    expect(readSimulation(payload)).toEqual({
      kind: 'DELETE',
      preview: { title: 'Excluir', summary: 'x' },
    })
  })

  it('should default a missing summary to an empty string', () => {
    expect(
      readSimulation({
        status: 'simulated',
        data: { kind: 'ACTION', preview: { title: 'Enviar' } },
      }),
    ).toEqual({ kind: 'ACTION', preview: { title: 'Enviar', summary: '' } })
  })

  it('should ignore anything that is not a well-formed simulation', () => {
    expect(readSimulation({ status: 'done', data: {} })).toBeNull()
    expect(readSimulation({ status: 'simulated' })).toBeNull()
    expect(readSimulation({ status: 'simulated', data: 'x…' })).toBeNull()
    expect(
      readSimulation({
        status: 'simulated',
        data: { kind: 'READ', preview: { title: 't' } },
      }),
    ).toBeNull()
    expect(
      readSimulation({ status: 'simulated', data: { kind: 'CREATE' } }),
    ).toBeNull()
    expect(
      readSimulation({
        status: 'simulated',
        data: { kind: 'CREATE', preview: { title: 1 } },
      }),
    ).toBeNull()
  })
})

describe('memory tools in TEST', () => {
  it('should preview a save without touching the memory', async () => {
    const parsed = memorySaveTool.parse({
      content: 'Ana prefere tópicos',
      scope: 'workspace',
    })
    if (!parsed.ok) throw new Error('parse')
    const preview = await memorySaveTool.preview?.(ctx, parsed.value)
    expect(preview).toEqual(
      ok({
        title: 'Salvar na memória',
        summary: 'Ana prefere tópicos',
        fields: [{ label: 'Escopo', after: 'Workspace' }],
      }),
    )
    const personal = memorySaveTool.parse({ content: 'Ana prefere tópicos' })
    if (!personal.ok) throw new Error('parse')
    const personalPreview = await memorySaveTool.preview?.(ctx, personal.value)
    expect(personalPreview?.ok && personalPreview.value.fields).toEqual([
      { label: 'Escopo', after: 'Pessoal' },
    ])
    expect(AiMemoryService.saveFromModel).not.toHaveBeenCalled()
  })

  it('should simulate a forget without deleting anything', async () => {
    const result = await simulateWriteTool(
      memoryForgetTool,
      ctx,
      { id: 'mem1' },
      { actorId: 'u1' },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.simulation).toEqual({
        kind: 'DELETE',
        preview: { title: 'Esquecer um fato da memória', summary: 'Fato mem1' },
      })
    }
    expect(AiMemoryService.forgetFromModel).not.toHaveBeenCalled()
  })
})

describe('TEST prompt', () => {
  it('should tell the model that every write is simulated', () => {
    const prompt = buildSteelAiSystemPrompt({
      userName: 'Ana',
      workspaceName: 'Acme',
      now: new Date('2026-10-08T12:00:00Z'),
      timezone: 'America/Sao_Paulo',
      modules: ['CRM'],
      mode: 'TEST',
    })
    expect(prompt).toContain('Modo atual: TESTE (simulação).')
    expect(prompt).toContain('SIMULADA')
  })
})
