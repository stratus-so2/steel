import { WorkspaceExportJob } from './jobs'
import { getWorkspaceExportQueue } from './queues'

/** Attempts of one export job: a second try covers a transient failure. */
export const WORKSPACE_EXPORT_ATTEMPTS = 2

/** Enqueues the build of one requested export (job id = export id). */
export async function enqueueWorkspaceExport(exportId: string): Promise<void> {
  await getWorkspaceExportQueue().add(
    WorkspaceExportJob.Run,
    { exportId },
    {
      jobId: `workspace-export-${exportId}`,
      attempts: WORKSPACE_EXPORT_ATTEMPTS,
    },
  )
}
