export type WorkspaceCompanySizeDTO =
  | 'SIZE_1_10'
  | 'SIZE_11_50'
  | 'SIZE_51_200'
  | 'SIZE_201_1000'
  | 'SIZE_1000_PLUS'

export interface WorkspaceDTO {
  id: string
  name: string
  slug: string
  activePlan: string
  trialEndsAt: string | null
  /** Public logo URL (MinIO `workspace-logos`), `null` without a logo. */
  logoUrl: string | null
  companySize: WorkspaceCompanySizeDTO | null
  createdAt: string
  updatedAt: string
}

export interface WorkspaceSlugAvailabilityDTO {
  slug: string
  available: boolean
  /** `current` = the workspace's own slug; `null` when simply free. */
  reason: 'current' | 'invalid' | 'reserved' | 'taken' | null
  /** pt-BR message for the field when unavailable. */
  message: string | null
}

/** Owner deletion request: queued, runs in the worker. */
export interface WorkspaceDeletionDTO {
  operationId: string
  status: 'QUEUED'
  requestedAt: string
}
