export interface CrmIntegrationKeyDTO {
  id: string
  name: string
  prefix: string
  workspaceId: string
  createdById: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CrmIntegrationKeyCreatedDTO extends CrmIntegrationKeyDTO {
  /** Plaintext API key — only ever returned once, at creation time. */
  plaintextKey: string
}
