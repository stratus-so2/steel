import type { CrmNote } from '@prisma/client'
import type { CrmNoteDTO } from '@/types/crm-note'

export function toCrmNoteDTO(note: CrmNote): CrmNoteDTO {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    companyId: note.companyId,
    personId: note.personId,
    opportunityId: note.opportunityId,
    leadId: note.leadId,
    workspaceId: note.workspaceId,
    createdById: note.createdById,
    updatedById: note.updatedById,
    position: note.position,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}
