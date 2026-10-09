import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume, type Limiter } from '@/src/lib/rate-limit'
import type { WhiteboardBinary } from '@/src/services/whiteboard-file.service'
import { handleError, standardError } from '@/utils/http-response'

/**
 * Steps every whiteboard route shares: session, rate limit and — for
 * writes — the LGPD consent gate. Returns the user id or the response to
 * send back.
 */
export async function whiteboardActor(options: {
  consent?: string
  limiter?: Limiter
}): Promise<{ userId: string } | { response: NextResponse }> {
  const auth = await getAuthSession()
  if (!auth.ok) return { response: handleError(auth.error) }

  const userId = auth.value.user.id
  const limit = await consume(options.limiter ?? apiLimiter, `user:${userId}`)
  if (!limit.ok) return { response: handleError(limit.error) }

  if (options.consent) {
    const consent = await requireConsent(userId, options.consent)
    if (!consent.ok) return { response: handleError(consent.error) }
  }

  return { userId }
}

/** Parses a JSON body with a schema, or the 422/400 response. */
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  const body = await request.json().catch(() => undefined)
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    return {
      response: standardError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Dados inválidos',
        parsed.error.issues,
      ),
    }
  }
  return { data: parsed.data }
}

/**
 * Serves a stored image same-origin. `sandbox` + `nosniff` keep an uploaded
 * SVG from ever running script when opened directly.
 */
export function binaryResponse(file: WhiteboardBinary, cacheSeconds: number) {
  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.body.byteLength),
      'Cache-Control': `private, max-age=${cacheSeconds}`,
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
