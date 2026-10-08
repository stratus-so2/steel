import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { SearchIndexService } from '@/src/services/search-index.service'
import { SearchReindexJob } from '../jobs'

export async function processSearchReindex(job: Job): Promise<unknown> {
  switch (job.name) {
    case SearchReindexJob.ReindexAll: {
      const result = await SearchIndexService.reindexAll()
      if (!result.ok) {
        // Could not even list the workspaces: let BullMQ retry.
        throw new Error(
          `Failed to reindex search: ${result.error.code} (${result.error.message})`,
        )
      }
      logger.info('queue.search_reindex.completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }
    case SearchReindexJob.ReindexWorkspace: {
      const { workspaceId } = job.data as { workspaceId: string }
      const result = await SearchIndexService.reindexWorkspace(workspaceId)
      if (!result.ok) {
        throw new Error(
          `Failed to reindex search for workspace ${workspaceId}: ${result.error.code}`,
        )
      }
      logger.info('queue.search_reindex.workspace_completed', {
        component: 'Worker',
        jobId: job.id,
        workspaceId,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown search-reindex job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
