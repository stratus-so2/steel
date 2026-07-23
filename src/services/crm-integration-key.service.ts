import { createHash, randomBytes } from 'node:crypto'
import { auditMutation } from '@/lib/axiom/audit'
import { crmIntegrationKeyInvalid } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toCrmIntegrationKeyDTO } from '@/src/mappers/crm-integration-key.mapper'
import { CrmIntegrationKeyRepository } from '@/src/repositories/crm-integration-key.repository'
import type { CreateCrmIntegrationKeyDTO } from '@/src/schemas/crm-integration-key.schema'
import type {
  CrmIntegrationKeyCreatedDTO,
  CrmIntegrationKeyDTO,
} from '@/types/crm-integration-key'
import { assertPrivileged } from './authz'

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

function generateKey(): { plaintextKey: string; prefix: string } {
  const raw = randomBytes(24).toString('base64url')
  const plaintextKey = `crm_live_${raw}`
  const prefix = plaintextKey.slice(0, 14)
  return { plaintextKey, prefix }
}

export const CrmIntegrationKeyService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmIntegrationKeyDTO[]>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await CrmIntegrationKeyRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmIntegrationKeyDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmIntegrationKeyDTO,
  ): Promise<Result<CrmIntegrationKeyCreatedDTO>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const { plaintextKey, prefix } = generateKey()

    const result = await CrmIntegrationKeyRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      keyHash: hashKey(plaintextKey),
      prefix,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_integration_api_key',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_integration_api_key',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok({ ...toCrmIntegrationKeyDTO(result.value), plaintextKey })
  },

  async revoke(
    actorId: string,
    workspaceId: string,
    keyId: string,
  ): Promise<Result<void>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmIntegrationKeyRepository.findById(
      keyId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmIntegrationKeyRepository.revoke(keyId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_integration_api_key',
      action: 'delete',
      actorId,
      targetId: keyId,
    })

    return ok(undefined)
  },

  async verify(
    plaintextKey: string,
  ): Promise<
    Result<{ workspaceId: string; createdById: string; keyId: string }>
  > {
    const result = await CrmIntegrationKeyRepository.findActiveByHash(
      hashKey(plaintextKey),
    )
    if (!result.ok) return result
    if (!result.value) return err(crmIntegrationKeyInvalid())

    await CrmIntegrationKeyRepository.markUsed(result.value.id)

    return ok({
      workspaceId: result.value.workspaceId,
      createdById: result.value.createdById,
      keyId: result.value.id,
    })
  },
}
