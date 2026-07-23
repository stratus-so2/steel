import { createId } from '@paralleldrive/cuid2'
import type { CrmNote } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmNoteDTO } from '@/types/crm-note'

export function createFakeCrmNote(overrides?: Partial<CrmNote>): CrmNote {
  const now = new Date()
  return {
    id: createId(),
    title: null,
    body: 'Nota de reunião',
    companyId: null,
    personId: null,
    opportunityId: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmNoteDTO(
  overrides?: Partial<CrmNoteDTO>,
): CrmNoteDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: null,
    body: 'Nota de reunião',
    companyId: null,
    personId: null,
    opportunityId: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmNote(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmNote,
      | 'title'
      | 'body'
      | 'companyId'
      | 'personId'
      | 'opportunityId'
      | 'position'
      | 'deletedAt'
    >
  >,
) {
  return prisma.crmNote.create({
    data: { body: 'Seed Note', workspaceId, createdById, ...overrides },
  })
}
