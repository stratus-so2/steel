import type { NextRequest } from 'next/server'
import { auditMutation } from '@/lib/axiom/audit'
import { withAxiom } from '@/lib/axiom/server'
import { unauthorized } from '@/src/errors'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { toCrmLeadDTO } from '@/src/mappers/crm-lead.mapper'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { IngestCrmLeadSchema } from '@/src/schemas/crm-integration-key.schema'
import { CrmIntegrationKeyService } from '@/src/services/crm-integration-key.service'
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

  const result = await CrmLeadRepository.create({
    workspaceId: context.value.workspaceId,
    createdById: context.value.createdById,
    name: parsed.data.name,
    emails: parsed.data.emails,
    phones: parsed.data.phones,
    company: parsed.data.company,
    source: parsed.data.source,
    score: 0,
  })
  if (!result.ok) return handleError(result.error)

  auditMutation({
    entity: 'crm_lead',
    action: 'create',
    actorId: context.value.createdById,
    targetId: result.value.id,
    meta: { via: 'integration_api_key', keyId: context.value.keyId },
  })

  return successResponse(toCrmLeadDTO(result.value), 201)
})
