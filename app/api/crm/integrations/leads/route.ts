import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { unauthorized } from '@/src/errors'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { IngestCrmLeadSchema } from '@/src/schemas/crm-integration-key.schema'
import { CrmIntegrationKeyService } from '@/src/services/crm-integration-key.service'
import { CrmLeadService } from '@/src/services/crm-lead.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

export const POST = withAxiom(async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization')
  const plaintextKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null

  if (!plaintextKey) return handleError(unauthorized('API key ausente'))

  const limit = await consume(apiLimiter, `crm-integration-key:${plaintextKey}`)
  if (!limit.ok) return handleError(limit.error)

  const context = await CrmIntegrationKeyService.verify(plaintextKey)
  if (!context.ok) return handleError(context.error)

  const body = await request.json().catch(() => ({}))
  const parsed = IngestCrmLeadSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  // Mesmo pipeline da criação manual: validação, dedupe, score e roteamento.
  const result = await CrmLeadService.intake(
    context.value.workspaceId,
    {
      kind: 'system',
      createdById: context.value.createdById,
      via: 'integration_api_key',
      refId: context.value.keyId,
    },
    {
      ...parsed.data,
      source: parsed.data.source ?? 'integration',
      channel: parsed.data.channel ?? 'API',
    },
  )
  if (!result.ok) return handleError(result.error)

  // 200 = lead em aberto já existente (dedupe); 201 = lead novo.
  return successResponse(result.value.lead, result.value.created ? 201 : 200)
})
