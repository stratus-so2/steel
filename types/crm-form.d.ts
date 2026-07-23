export type CrmFormStatusDTO = 'DRAFT' | 'PUBLISHED'
export type CrmFormActionDTO = 'COMPANY' | 'PERSON' | 'LEAD'

export interface CrmFormFieldDefinition {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'textarea'
  required: boolean
}

export interface CrmFormDTO {
  id: string
  name: string
  description: string | null
  status: CrmFormStatusDTO
  publicToken: string
  action: CrmFormActionDTO
  fields: CrmFormFieldDefinition[]
  successMessage: string | null
  redirectUrl: string | null
  submissionCount: number
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CrmFormPublicDTO {
  id: string
  name: string
  description: string | null
  fields: CrmFormFieldDefinition[]
  successMessage: string | null
  redirectUrl: string | null
}

export interface CrmFormSubmissionDTO {
  id: string
  formId: string
  values: Record<string, string>
  action: CrmFormActionDTO
  createdPersonId: string | null
  createdCompanyId: string | null
  createdLeadId: string | null
  createdAt: string
}
