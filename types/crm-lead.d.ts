export type CrmLeadStatusDTO =
  | 'NEW'
  | 'WORKING'
  | 'QUALIFIED'
  | 'UNQUALIFIED'
  | 'CONVERTED'

export type CrmLeadRuleFieldDTO =
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'jobTitle'
  | 'source'
  | 'city'

export type CrmLeadRuleOperatorDTO =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty'

export interface CrmLeadDTO {
  id: string
  workspaceId: string
  name: string
  emails: string[]
  phones: string[]
  company: string | null
  jobTitle: string | null
  city: string | null
  linkedin: string | null
  source: string | null
  status: CrmLeadStatusDTO
  score: number
  ownerId: string | null
  convertedPersonId: string | null
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export interface CrmLeadScoringRuleDTO {
  id: string
  workspaceId: string
  field: CrmLeadRuleFieldDTO
  operator: CrmLeadRuleOperatorDTO
  value: string | null
  points: number
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface CrmLeadRoutingRuleDTO {
  id: string
  workspaceId: string
  field: CrmLeadRuleFieldDTO
  operator: CrmLeadRuleOperatorDTO
  value: string | null
  ownerId: string
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}
