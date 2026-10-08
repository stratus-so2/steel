import { describe, expect, it } from 'vitest'
import {
  createFakeAiMemory,
  createFakeAiSkill,
} from '@/src/__tests__/factories/ai-skill-memory.factory'
import { createFakeAiMessage } from '@/src/__tests__/factories/steel-ai.factory'
import type { BuiltInSkill } from '@/src/lib/ai/context/builtin-skills'
import { findBuiltInSkill } from '@/src/lib/ai/context/builtin-skills'
import { toAiMessageDTOs } from '../ai-conversation.mapper'
import { toAiMemoryDTO, toAiMemoryRefDTO } from '../ai-memory.mapper'
import { toAiSkillDTO, toBuiltInAiSkillDTO } from '../ai-skill.mapper'

const at = new Date('2026-10-08T10:00:00.000Z')

describe('toAiSkillDTO()', () => {
  it('lets the owner manage a personal skill', () => {
    const row = createFakeAiSkill({ id: 's1', ownerId: 'u1', updatedAt: at })
    expect(
      toAiSkillDTO(row, { actorId: 'u1', canManageWorkspace: false }),
    ).toEqual({
      id: 's1',
      kind: 'PERSONAL',
      slug: row.slug,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      mode: null,
      toolNames: [],
      enabled: true,
      canEdit: true,
      canToggle: true,
      canDelete: true,
      updatedAt: at.toISOString(),
    })
    expect(
      toAiSkillDTO(row, { actorId: 'u2', canManageWorkspace: true }).canEdit,
    ).toBe(false)
  })

  it('lets only admins manage a workspace skill', () => {
    const row = createFakeAiSkill({ scope: 'WORKSPACE', ownerId: null })
    expect(
      toAiSkillDTO(row, { actorId: 'u1', canManageWorkspace: true }).canDelete,
    ).toBe(true)
    expect(
      toAiSkillDTO(row, { actorId: 'u1', canManageWorkspace: false }).canEdit,
    ).toBe(false)
  })
})

describe('toBuiltInAiSkillDTO()', () => {
  const sla = findBuiltInSkill('sla') as BuiltInSkill

  it('defaults to enabled and never editable', () => {
    expect(toBuiltInAiSkillDTO(sla, null, true)).toMatchObject({
      id: 'builtin:sla',
      kind: 'BUILT_IN',
      enabled: true,
      canEdit: false,
      canToggle: true,
      canDelete: false,
      updatedAt: null,
    })
  })

  it('reads enabled from the override row', () => {
    const override = createFakeAiSkill({
      builtIn: true,
      enabled: false,
      updatedAt: at,
    })
    const dto = toBuiltInAiSkillDTO(sla, override, false)
    expect(dto).toMatchObject({
      enabled: false,
      canToggle: false,
      updatedAt: at.toISOString(),
    })
    expect(dto.toolNames).not.toBe(sla.toolNames)
  })
})

describe('toAiMemoryDTO()', () => {
  it('shows the source conversation only to who saved it', () => {
    const row = createFakeAiMemory({
      id: 'm1',
      scope: 'PERSONAL',
      userId: 'u1',
      createdById: 'u1',
      sourceConversationId: 'conv1',
      lastUsedAt: at,
      createdAt: at,
      updatedAt: at,
    })
    expect(
      toAiMemoryDTO(row, { actorId: 'u1', canManageWorkspace: false }),
    ).toEqual({
      id: 'm1',
      scope: 'PERSONAL',
      content: row.content,
      source: 'AUTO',
      sourceConversationId: 'conv1',
      lastUsedAt: at.toISOString(),
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      canEdit: true,
    })
    const shared = createFakeAiMemory({
      scope: 'WORKSPACE',
      userId: null,
      createdById: 'u1',
      sourceConversationId: 'conv1',
    })
    const dto = toAiMemoryDTO(shared, {
      actorId: 'u2',
      canManageWorkspace: false,
    })
    expect(dto.sourceConversationId).toBeNull()
    expect(dto.lastUsedAt).toBeNull()
    expect(dto.canEdit).toBe(false)
    expect(
      toAiMemoryDTO(shared, { actorId: 'u2', canManageWorkspace: true })
        .canEdit,
    ).toBe(true)
  })

  it('builds the chip reference', () => {
    const row = createFakeAiMemory({ id: 'm1', content: 'Fato' })
    expect(toAiMemoryRefDTO(row, 'duplicate')).toEqual({
      id: 'm1',
      scope: 'PERSONAL',
      content: 'Fato',
      action: 'duplicate',
    })
  })
})

describe('memory chip in the transcript', () => {
  it('restores the memory ref from the TOOL row', () => {
    const rows = [
      createFakeAiMessage({ role: 'USER', content: 'prefiro tabelas' }),
      createFakeAiMessage({
        role: 'ASSISTANT',
        content: '',
        toolCalls: [{ id: 'c1', name: 'memory_save', arguments: {} }] as never,
      }),
      createFakeAiMessage({
        role: 'TOOL',
        toolCallId: 'c1',
        toolName: 'memory_save',
        content: JSON.stringify({
          status: 'done',
          summary: 'Memória salva',
          data: {
            memoryRef: {
              id: 'm1',
              scope: 'PERSONAL',
              content: 'Prefere tabelas',
              action: 'saved',
            },
          },
        }),
      }),
    ]
    const [, assistant] = toAiMessageDTOs(rows, [], (name) => ({
      label: name,
      module: null,
    }))
    expect(assistant.toolCalls[0]).toMatchObject({
      status: 'done',
      summary: 'Memória salva',
      memory: { id: 'm1', action: 'saved' },
    })
  })
})
