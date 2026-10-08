import { createId } from '@paralleldrive/cuid2'
import type { AiMemory, AiSkill, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

const NOW = new Date('2026-10-08T12:00:00.000Z')

export function createFakeAiSkill(overrides?: Partial<AiSkill>): AiSkill {
  return {
    id: createId(),
    workspaceId: createId(),
    scope: 'PERSONAL',
    ownerId: createId(),
    slug: 'resumo-cliente',
    name: 'Resumo do cliente',
    description: 'Resumo de um cliente com chamados e oportunidades.',
    instructions: 'Resuma os chamados e as oportunidades do cliente citado.',
    mode: null,
    toolNames: [],
    enabled: true,
    builtIn: false,
    createdById: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeAiMemory(overrides?: Partial<AiMemory>): AiMemory {
  return {
    id: createId(),
    workspaceId: createId(),
    scope: 'PERSONAL',
    userId: createId(),
    content: 'Ana prefere respostas em tópicos.',
    source: 'AUTO',
    sourceConversationId: null,
    createdById: null,
    lastUsedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedAiSkill(
  workspaceId: string,
  overrides?: Partial<Omit<Prisma.AiSkillUncheckedCreateInput, 'workspaceId'>>,
) {
  return prisma.aiSkill.create({
    data: {
      workspaceId,
      scope: 'WORKSPACE',
      slug: `skill-${createId().slice(0, 8)}`,
      name: 'Skill de teste',
      description: 'Descrição da skill',
      instructions: 'Instruções da skill',
      ...overrides,
    },
  })
}

export async function seedAiMemory(
  workspaceId: string,
  overrides?: Partial<Omit<Prisma.AiMemoryUncheckedCreateInput, 'workspaceId'>>,
) {
  return prisma.aiMemory.create({
    data: {
      workspaceId,
      scope: 'WORKSPACE',
      content: 'O suporte atende das 8h às 18h.',
      source: 'MANUAL',
      ...overrides,
    },
  })
}
