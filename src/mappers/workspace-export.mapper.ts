import type { WorkspaceExportWithRelations } from '@/src/repositories/workspace-export.repository'
import type { WorkspaceExportDTO } from '@/types/workspace-export'

/** Authenticated download route of one export. */
export function workspaceExportDownloadPath(
  workspaceId: string,
  exportId: string,
): string {
  return `/api/workspaces/${workspaceId}/exports/${exportId}/download`
}

export function isWorkspaceExportDownloadable(
  row: Pick<
    WorkspaceExportWithRelations,
    'status' | 'storageKey' | 'expiresAt'
  >,
  now: Date,
): boolean {
  return (
    row.status === 'COMPLETED' &&
    row.storageKey !== null &&
    row.expiresAt !== null &&
    row.expiresAt.getTime() > now.getTime()
  )
}

export function toWorkspaceExportDTO(
  row: WorkspaceExportWithRelations,
  now: Date,
): WorkspaceExportDTO {
  const downloadable = isWorkspaceExportDownloadable(row, now)
  return {
    id: row.id,
    kind: row.kind,
    // A COMPLETED row past its expiry is shown as expired before the prune
    // job gets to it.
    status:
      row.status === 'COMPLETED' && !downloadable ? 'EXPIRED' : row.status,
    requestedBy: row.requestedBy,
    periodFrom: row.periodFrom?.toISOString() ?? null,
    periodTo: row.periodTo?.toISOString() ?? null,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    itemCount: row.itemCount,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    downloadUrl: downloadable
      ? workspaceExportDownloadPath(row.workspaceId, row.id)
      : null,
  }
}
