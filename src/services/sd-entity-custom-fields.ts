import type { Prisma, SdCustomFieldEntity } from '@prisma/client'
import { ok, type Result } from '@/src/lib/result'
import { validateSdCustomFieldValues } from '@/src/lib/servicedesk/custom-fields'
import { SdCustomFieldRepository } from '@/src/repositories/sd-custom-field.repository'

/**
 * Valida os `customFields` de um cadastro (cliente, contato, CI) contra as
 * definições da entidade. `values` ausente → nada a gravar (`undefined`).
 * Criação: validação completa (padrões e obrigatórios). Edição (`existing`
 * informado): só as chaves enviadas, mescladas sobre o valor atual; limpar
 * um campo opcional remove a chave.
 */
export async function validateSdEntityCustomFields(
  workspaceId: string,
  entity: SdCustomFieldEntity,
  values: Record<string, unknown> | undefined,
  existing?: unknown,
): Promise<Result<Prisma.InputJsonObject | undefined>> {
  if (values === undefined) return ok(undefined)
  const defs = await SdCustomFieldRepository.list(workspaceId, { entity })
  if (!defs.ok) return defs

  const partial = existing !== undefined
  const result = validateSdCustomFieldValues(defs.value, values, { partial })
  if (!result.ok) return result
  if (!partial) return ok(result.value as Prisma.InputJsonObject)

  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  const merged: Record<string, unknown> = { ...base, ...result.value }
  for (const [key, value] of Object.entries(merged)) {
    if (value === null) delete merged[key]
  }
  return ok(merged as Prisma.InputJsonObject)
}
