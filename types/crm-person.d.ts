export interface CrmPersonDTO {
  id: string
  name: string
  emails: string[]
  phones: string[]
  city: string | null
  jobTitle: string | null
  linkedin: string | null
  avatar: string | null
  companyId: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}
