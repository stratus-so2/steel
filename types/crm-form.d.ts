export type CrmFormStatusDTO = 'DRAFT' | 'PUBLISHED'
export type CrmFormActionDTO = 'COMPANY' | 'PERSON' | 'LEAD'
export type CrmFormFieldTypeDTO =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'url'
  | 'date'
export type CrmFormFieldTargetDTO = 'person' | 'company' | 'lead'

export interface CrmFormFieldMapping {
  target: CrmFormFieldTargetDTO
  attribute: string
}

export interface CrmFormFieldOption {
  label: string
  value: string
}

export interface CrmFormFieldDefinition {
  key: string
  label: string
  type: CrmFormFieldTypeDTO
  required: boolean
  placeholder?: string
  options?: CrmFormFieldOption[]
  mapping: CrmFormFieldMapping
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
  values: Record<string, string | boolean>
  action: CrmFormActionDTO
  createdPersonId: string | null
  createdCompanyId: string | null
  createdLeadId: string | null
  referrer: string | null
  createdAt: string
}
