import { logger } from '@/lib/axiom/logger'
import type { AppError } from '@/src/errors/app-error'
import type { Result } from '@/src/lib/result'
import { SearchIndexService } from '@/src/services/search-index.service'
import type { SearchEntityType } from './search-entities'

/**
 * Fire-and-forget index maintenance, called by the domain services right
 * after a successful write. Never awaited by the caller and never throws:
 * a failure only logs — the business operation already succeeded and the
 * nightly `search-reindex` job repairs whatever was missed.
 */

function track(
  op: 'index' | 'remove',
  entityType: SearchEntityType,
  workspaceId: string,
  promise: Promise<Result<unknown, AppError>>,
): Promise<void> {
  return promise.then(
    (result) => {
      if (!result.ok) {
        logger.warn('search.index.failed', {
          component: 'SearchIndex',
          op,
          entityType,
          workspaceId,
          code: result.error.code,
        })
      }
    },
    (error: unknown) => {
      logger.error('search.index.crashed', {
        component: 'SearchIndex',
        op,
        entityType,
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
    },
  )
}

function idsOf(entityId: string | readonly string[]): string[] {
  return typeof entityId === 'string' ? [entityId] : [...entityId]
}

/** Re-reads the record(s) and refreshes their search documents. */
export function indexSearchDocument(
  entityType: SearchEntityType,
  workspaceId: string,
  entityId: string | readonly string[],
): Promise<void> {
  return track(
    'index',
    entityType,
    workspaceId,
    SearchIndexService.refresh(entityType, workspaceId, idsOf(entityId)),
  )
}

/** Drops the record(s) from the index (hard delete, membership removal). */
export function removeSearchDocument(
  entityType: SearchEntityType,
  workspaceId: string,
  entityId: string | readonly string[],
): Promise<void> {
  return track(
    'remove',
    entityType,
    workspaceId,
    SearchIndexService.remove(entityType, workspaceId, idsOf(entityId)),
  )
}
