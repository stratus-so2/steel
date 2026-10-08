import type { NextRequest } from 'next/server'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { getObjectStream } from '@/src/lib/storage/s3'
import { WorkspaceExportService } from '@/src/services/workspace-export.service'
import { handleError, standardError } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; exportId: string }> }

/**
 * Streams the export ZIP from MinIO (the storage API is never public).
 * OWNER/ADMIN only, while the file has not expired; audited.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, exportId } = await ctx.params
  const target = await WorkspaceExportService.authorizeDownload(
    auth.value.user.id,
    id,
    exportId,
  )
  if (!target.ok) return handleError(target.error)

  try {
    const object = await getObjectStream(target.value)
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${target.value.fileName}"`,
        'Cache-Control': 'no-store',
        ...(object.contentLength !== undefined && {
          'Content-Length': String(object.contentLength),
        }),
      },
    })
  } catch (error) {
    logger.error(
      'workspace_export.download_failed',
      logFields({
        component: 'WorkspaceExport',
        workspaceId: id,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    return standardError('STORAGE_ERROR', 'Arquivo da exportação indisponível')
  }
})
