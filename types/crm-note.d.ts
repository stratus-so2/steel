export interface CrmNoteDTO {
  id: string
  title: string | null
  body: string | null
  companyId: string | null
  personId: string | null
  opportunityId: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}
