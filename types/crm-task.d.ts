export type CrmTaskStatusDTO = 'TODO' | 'IN_PROGRESS' | 'DONE'

export interface CrmTaskDTO {
  id: string
  title: string
  status: CrmTaskStatusDTO
  body: string | null
  dueDate: string | null
  assigneeId: string | null
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
