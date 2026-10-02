import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { consume, otpLimiter } from '@/src/lib/rate-limit'
import {
  confirmTotpSchema,
  disableTotpSchema,
} from '@/src/schemas/two-factor.schema'
import { TwoFactorService } from '@/src/services/two-factor.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

/**
 * Aplicativo autenticador (TOTP) da conta da sessão.
 *
 * - `GET` — estado que a aba de segurança desenha.
 * - `POST` — confirma o cadastro com o primeiro código do aplicativo.
 * - `DELETE` — desliga o aplicativo; exige a senha.
 *
 * Ativar/desativar a 2FA, pedir o OTP por e-mail, consumir código de backup e
 * gerar os códigos de recuperação continuam sendo endpoints do próprio
 * better-auth (`/api/auth/two-factor/*`). O que mora aqui é só o passo que o
 * plugin 1.6 não tem: registrar que o QR foi de fato escaneado.
 *
 * O `userId` vem sempre de `getAuthSession()`, nunca do corpo — não existe
 * caminho para mexer no segundo fator de outra conta.
 */

export const GET = withAxiom(async () => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const result = await TwoFactorService.status(auth.value.user.id)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const POST = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  // `otpLimiter`, não `apiLimiter`: cada POST é uma tentativa de adivinhar um
  // código de 6 dígitos. O lockout do plugin cobre o login; esta rota roda
  // com sessão viva, fora dele.
  const limit = await consume(otpLimiter, `totp-confirm:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)

  const parsed = confirmTotpSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Body inválido',
      parsed.error.issues,
    )
  }

  const result = await TwoFactorService.confirmTotp(
    auth.value.user.id,
    parsed.data.code,
    request.headers,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const DELETE = withAxiom(async (request: NextRequest) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(otpLimiter, `totp-disable:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)

  const parsed = disableTotpSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Body inválido',
      parsed.error.issues,
    )
  }

  const result = await TwoFactorService.disableTotp(
    auth.value.user.id,
    parsed.data.password,
    request.headers,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
