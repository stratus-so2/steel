import type { CrmPerson } from '@prisma/client'
import type { CrmPersonDTO } from '@/types/crm-person'

export function toCrmPersonDTO(person: CrmPerson): CrmPersonDTO {
  return {
    id: person.id,
    name: person.name,
    emails: person.emails,
    phones: person.phones,
    city: person.city,
    jobTitle: person.jobTitle,
    linkedin: person.linkedin,
    avatar: person.avatar,
    companyId: person.companyId,
    workspaceId: person.workspaceId,
    createdById: person.createdById,
    updatedById: person.updatedById,
    position: person.position,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  }
}
