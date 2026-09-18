import type { NextRequest } from 'next/server'
import { logger } from '@/lib/axiom/logger'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { getObjectStream } from '@/src/lib/storage/s3'
import { BackupDownloadQuerySchema } from '@/src/schemas/admin.schema'
import { AdminBackupService } from '@/src/services/admin-backup.service'
import { handleError, standardError } from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

/**
 * Transmite o arquivo do backup (cifrado, como está no MinIO). Exige a
 * sessão do admin E a assinatura do link gerado em `download-link`.
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const parsed = BackupDownloadQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return standardError(
      'BACKUP_DOWNLOAD_LINK_INVALID',
      'Link de download inválido ou expirado',
    )
  }

  const { id } = await ctx.params
  const target = await AdminBackupService.authorizeDownload(
    auth.value.user.id,
    id,
    parsed.data,
  )
  if (!target.ok) return handleError(target.error)

  try {
    const object = await getObjectStream(target.value)
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${target.value.filename}"`,
        'Cache-Control': 'no-store',
        ...(object.contentLength !== undefined && {
          'Content-Length': String(object.contentLength),
        }),
      },
    })
  } catch (error) {
    logger.error('admin.backup.download_failed', {
      backupId: id,
      message: error instanceof Error ? error.message : String(error),
    })
    return standardError('STORAGE_ERROR', 'Arquivo do backup indisponível')
  }
})
