import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdKbMediaService } from '@/src/services/sd-kb-media.service'
import { handleError } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; articleId: string; fileName: string }>
}

/**
 * Serve a mídia do artigo (bucket privado) conferindo o acesso de leitura a
 * cada pedido. Cache privado: a URL é estável, o conteúdo não muda.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, articleId, fileName } = await ctx.params
  const result = await SdKbMediaService.download(
    auth.value.user.id,
    id,
    articleId,
    fileName,
  )
  if (!result.ok) return handleError(result.error)

  return new Response(new Uint8Array(result.value.body), {
    headers: {
      'Content-Type': result.value.contentType,
      'Content-Length': String(result.value.body.byteLength),
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${fileName}"`,
    },
  })
})
