export interface CrmActivityDTO {
  id: string
  workspaceId: string
  actorUserId: string | null
  action: string
  entity: string
  entityId: string
  companyId: string | null
  personId: string | null
  opportunityId: string | null
  summary: string | null
  createdAt: string
}
