/** Ajustes › Exportações (`/api/workspaces/:id/exports`). */

export type WorkspaceExportKind = 'DATA' | 'LOGS'

export type WorkspaceExportStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'

export interface WorkspaceExportDTO {
  id: string
  kind: WorkspaceExportKind
  status: WorkspaceExportStatus
  requestedBy: { id: string; name: string; email: string } | null
  /** Logs only: covered window (ISO). */
  periodFrom: string | null
  periodTo: string | null
  fileName: string | null
  sizeBytes: number | null
  /** Tables (DATA) or events (LOGS) in the file. */
  itemCount: number | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
  expiresAt: string | null
  /** Authenticated app route; `null` unless COMPLETED and not expired. */
  downloadUrl: string | null
}

export interface WorkspaceExportAvailabilityDTO {
  kind: WorkspaceExportKind
  /** A new export of this kind can be requested now. */
  available: boolean
  /** When the daily slot opens again (ISO), if `available` is false. */
  nextAvailableAt: string | null
  /** LOGS only: Axiom query is configured on this server. */
  configured: boolean
}

export interface WorkspaceExportOverviewDTO {
  items: WorkspaceExportDTO[]
  availability: WorkspaceExportAvailabilityDTO[]
  retentionDays: number
  logsPeriodDays: number[]
}
