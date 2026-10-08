import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { parseMemberImportCsv } from '@/src/lib/members/member-import-csv'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { MemberService } from '@/src/services/member.service'
import { readUploadFile } from '@/utils/form-data'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

const MAX_CSV_BYTES = 1024 * 1024

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params

  const file = await readUploadFile(request, 'file', {
    invalidBody: 'Formulário inválido',
    invalidFile: 'Arquivo CSV não enviado',
  })
  if (!file.ok) return handleError(file.error)
  if (file.value.size > MAX_CSV_BYTES) {
    return standardError('VALIDATION_ERROR', 'O arquivo pode ter até 1 MB')
  }

  const rows = parseMemberImportCsv(await file.value.text())
  if (!rows.ok) return handleError(rows.error)

  const result = await MemberService.import(auth.value.user.id, id, rows.value)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
