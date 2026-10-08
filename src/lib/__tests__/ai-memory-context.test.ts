import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeAiMemory } from '@/src/__tests__/factories/ai-skill-memory.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { aiMemoryNotFound, validationError } from '@/src/errors/app-error'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/ai-memory.service')

import {
  MEMORY_PROMPT_TOKEN_BUDGET,
  memoryForPrompt,
  pickMemoriesForPrompt,
  renderMemorySection,
} from '@/src/lib/ai/context/memory'
import {
  isNearDuplicateMemory,
  MEMORY_GUARD_MESSAGES,
  memoryGuardProblem,
  memorySimilarity,
  normalizeMemoryText,
} from '@/src/lib/ai/context/memory-guard'
import { readMemoryRef } from '@/src/lib/ai/context/memory-tool-names'
import {
  memoryForgetTool,
  memorySaveTool,
  STEEL_AI_MEMORY_TOOLS,
} from '@/src/lib/ai/context/memory-tools'
import { STEEL_AI_TOOLS } from '@/src/lib/ai/tools'
import { toolMeta } from '@/src/lib/ai/tools/registry'
import type { AiToolContext } from '@/src/lib/ai/tools/types'
import { AiMemoryService } from '@/src/services/ai-memory.service'

const service = vi.mocked(AiMemoryService)
const ctx: AiToolContext = {
  workspaceId: 'ws1',
  actorId: 'u1',
  source: 'assistant',
  conversationId: 'conv1',
}

beforeEach(() => {
  service.markUsed.mockResolvedValue(undefined)
})

describe('memory guard', () => {
  it.each([
    'A senha do Wi-Fi é abc12345',
    'Password do painel: hunter2',
    'Chave de API da Meta: 123',
    'token: sk-proj-abcdefghijklmnopqrstuvwxyz',
    'AWS AKIAABCDEFGHIJKLMNOP',
    'GitHub ghp_abcdefghijklmnopqrstuvwxyz1234',
    'slack xoxb-1234567890-abcdef',
    'jwt eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4f',
    '-----BEGIN RSA PRIVATE KEY-----',
    'id 8f14e45fceea167a5a36dedd4bea2543c3a8f8d1e0b1',
  ])('refuses credentials: %s', (content) => {
    expect(memoryGuardProblem(content)).toBe(MEMORY_GUARD_MESSAGES.credential)
  })

  it.each([
    'Cartão 4111 1111 1111 1111',
    'cartao 4111-1111-1111-1111',
    'CPF da Ana: 123.456.789-09',
    'o cpf dela é 12345678909',
  ])('refuses documents: %s', (content) => {
    expect(memoryGuardProblem(content)).toBe(MEMORY_GUARD_MESSAGES.document)
  })

  it.each([
    'Bruno está em tratamento médico para depressão',
    'A Carla é homossexual',
    'O cliente é filiado ao partido X',
    'Religião do João: católico',
    'Diagnóstico: CID 10',
  ])('refuses sensitive personal data: %s', (content) => {
    expect(memoryGuardProblem(content)).toBe(MEMORY_GUARD_MESSAGES.sensitive)
  })

  it.each([
    'O time de suporte atende das 8h às 18h.',
    'Ana prefere respostas em tópicos.',
    'Pedido 1234 5678 é do cliente Acme',
    'Usamos https://docs.exemplo.com/abcdefghijklmnopqrstuvwxyz0123456789 como base',
    'O CNPJ da Acme é 12.345.678/0001-90',
  ])('accepts ordinary facts: %s', (content) => {
    expect(memoryGuardProblem(content)).toBeNull()
  })

  it('normalizes and compares facts', () => {
    expect(normalizeMemoryText('  Olá, Ação! ')).toBe('ola acao')
    expect(memorySimilarity('', '')).toBe(1)
    expect(memorySimilarity('a b', 'c d')).toBe(0)
    expect(
      isNearDuplicateMemory('Ana prefere tópicos.', 'ana prefere TOPICOS'),
    ).toBe(true)
    expect(
      isNearDuplicateMemory(
        'O suporte atende das 8h às 18h de segunda a sexta',
        'O suporte atende das 8h às 18h de segunda a sexta-feira',
      ),
    ).toBe(true)
    expect(
      isNearDuplicateMemory('Ana prefere tópicos', 'Ana prefere tabelas'),
    ).toBe(false)
  })
})

describe('readMemoryRef()', () => {
  const ref = { id: 'm1', scope: 'PERSONAL', content: 'x', action: 'saved' }

  it('reads a valid ref', () => {
    expect(readMemoryRef({ memoryRef: ref })).toEqual(ref)
  })

  it.each([
    null,
    'text',
    {},
    { memoryRef: null },
    { memoryRef: { ...ref, id: 1 } },
    { memoryRef: { ...ref, scope: 'OTHER' } },
    { memoryRef: { ...ref, content: null } },
    { memoryRef: { ...ref, action: 3 } },
    { memoryRef: { ...ref, action: 'edited' } },
  ])('rejects %j', (data) => {
    expect(readMemoryRef(data)).toBeNull()
  })

  it('labels the memory tools in the transcript', () => {
    expect(toolMeta('memory_save')).toEqual({
      label: 'Salvando na memória',
      module: null,
    })
    expect(toolMeta('memory_forget').label).toBe('Esquecendo da memória')
  })
})

describe('memory in the prompt', () => {
  const ws = createFakeAiMemory({
    id: 'w1',
    scope: 'WORKSPACE',
    content: 'Suporte das 8h às 18h',
  })
  const mine = createFakeAiMemory({
    id: 'p1',
    scope: 'PERSONAL',
    content: 'Prefere\n tabelas',
  })

  it('keeps the newest facts within the token budget', () => {
    const big = (id: string) =>
      createFakeAiMemory({ id, content: 'x'.repeat(1_000) })
    const rows = [big('a'), big('b'), big('c'), big('d'), ws]
    const picked = pickMemoriesForPrompt(rows)
    expect(picked.map((r) => r.id)).toEqual(['a', 'b', 'c', 'w1'])
    const chars = picked.reduce((sum, r) => sum + r.content.length + 30, 0)
    expect(chars / 4).toBeLessThanOrEqual(MEMORY_PROMPT_TOKEN_BUDGET)
    expect(pickMemoriesForPrompt(rows, 10)).toEqual([ws])
  })

  it('renders both layers, ids and the tool guide', () => {
    const text = renderMemorySection([ws, mine], true)
    expect(text).toContain('Do workspace (vale para todos):\n- [w1] Suporte')
    expect(text).toContain(
      'Pessoais (só deste usuário):\n- [p1] Prefere tabelas',
    )
    expect(text).toContain('memory_save')
    expect(text).toContain('memory_forget')
    expect(renderMemorySection([], false)).toContain(
      '(nenhum fato salvo ainda)',
    )
    expect(renderMemorySection([ws], false)).not.toContain('memory_save')
  })

  it('injects memories and stamps lastUsedAt', async () => {
    service.forPrompt.mockResolvedValue(ok([ws, mine]))
    const text = await memoryForPrompt(ctx)
    expect(text).toContain('[w1]')
    expect(text).toContain('memory_save')
    expect(service.markUsed).toHaveBeenCalledWith(['w1', 'p1'])
  })

  it('tells about the tools even with no memory yet, without touching', async () => {
    service.forPrompt.mockResolvedValue(ok([]))
    expect(await memoryForPrompt(ctx)).toContain('memory_save')
    expect(service.markUsed).not.toHaveBeenCalled()
  })

  it('omits the tool guide for Steel Agents', async () => {
    service.forPrompt.mockResolvedValue(ok([ws]))
    const text = await memoryForPrompt({ ...ctx, source: 'agent' })
    expect(text).toContain('[w1]')
    expect(text).not.toContain('memory_save')
  })

  it('is empty when memory is off or the database fails', async () => {
    service.forPrompt.mockResolvedValue(ok(null))
    expect(await memoryForPrompt(ctx)).toBe('')
    service.forPrompt.mockResolvedValue(err(databaseError('down')))
    expect(await memoryForPrompt(ctx)).toBe('')
  })
})

describe('memory tools', () => {
  const memory = createFakeAiMemory({
    id: 'm1',
    scope: 'PERSONAL',
    content: 'Ana prefere tópicos',
  })

  it('are kept out of the general registry', () => {
    for (const tool of STEEL_AI_MEMORY_TOOLS) {
      expect(STEEL_AI_TOOLS).not.toContain(tool)
    }
  })

  it('parses the save arguments (scope defaults to personal)', () => {
    expect(expectOk(memorySaveTool.parse({ content: ' Fato ' }))).toEqual({
      content: 'Fato',
      scope: 'PERSONAL',
    })
    expect(
      expectOk(memorySaveTool.parse({ content: 'x', scope: 'workspace' }))
        .scope,
    ).toBe('WORKSPACE')
    expectErr(memorySaveTool.parse({ content: '' }), 'VALIDATION_ERROR')
    expectErr(
      memorySaveTool.parse({ content: 'x'.repeat(501) }),
      'VALIDATION_ERROR',
    )
    expectErr(
      memorySaveTool.parse(undefined as unknown as Record<string, unknown>),
      'VALIDATION_ERROR',
    )
  })

  it.each([
    ['saved', false, 'Memória salva'],
    ['duplicate', false, 'Já estava na memória'],
    ['saved', true, 'Memória pessoal salva'],
  ] as const)(
    'summarizes %s (downgraded=%s)',
    async (action, downgraded, summary) => {
      service.saveFromModel.mockResolvedValue(
        ok({ memory, action, downgraded }),
      )
      const out = expectOk(
        await memorySaveTool.execute(ctx, { content: 'x', scope: 'PERSONAL' }),
      )
      expect(out.summary).toContain(summary)
      expect(out.data).toEqual({
        memoryRef: {
          id: 'm1',
          scope: 'PERSONAL',
          content: 'Ana prefere tópicos',
          action,
        },
      })
    },
  )

  it('propagates a refused save', async () => {
    service.saveFromModel.mockResolvedValue(err(validationError('Não guardo')))
    expectErr(
      await memorySaveTool.execute(ctx, { content: 'x', scope: 'PERSONAL' }),
      'VALIDATION_ERROR',
    )
  })

  it('forgets a memory by id', async () => {
    expect(expectOk(memoryForgetTool.parse({ id: ' m1 ' }))).toEqual({
      id: 'm1',
    })
    expectErr(memoryForgetTool.parse({}), 'VALIDATION_ERROR')

    service.forgetFromModel.mockResolvedValue(ok(memory))
    const out = expectOk(await memoryForgetTool.execute(ctx, { id: 'm1' }))
    expect(out.summary).toBe('Memória esquecida')
    expect(readMemoryRef(out.data)?.action).toBe('forgotten')
    expect(service.forgetFromModel).toHaveBeenCalledWith(ctx, 'm1')

    service.forgetFromModel.mockResolvedValue(err(aiMemoryNotFound()))
    expectErr(
      await memoryForgetTool.execute(ctx, { id: 'm1' }),
      'AI_MEMORY_NOT_FOUND',
    )
  })
})
