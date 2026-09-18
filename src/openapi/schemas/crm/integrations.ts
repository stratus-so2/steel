import { z } from 'zod'
import { dto } from '../../common'

/** DTOs das chaves de API de integração (`types/crm-integration-key.d.ts`). */

const integrationKeyShape = {
  id: z.string().meta({ example: 'ckw1key00000ab7d3k1e5xyz' }),
  name: z.string().meta({ example: 'Site institucional' }),
  prefix: z.string().meta({
    description:
      'Início da chave, para identificá-la na listagem (o valor completo não é recuperável).',
    example: 'crm_live_a1b2',
  }),
  workspaceId: z.string(),
  createdById: z.string(),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable().meta({
    description:
      'Preenchido quando a chave foi revogada (deixa de autenticar).',
  }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}

export const CrmIntegrationKeyDTO = dto(
  'CrmIntegrationKey',
  z.object(integrationKeyShape),
)

export const CrmIntegrationKeyCreatedDTO = dto(
  'CrmIntegrationKeyCreated',
  z.object({
    ...integrationKeyShape,
    plaintextKey: z.string().meta({
      description:
        'Chave completa em texto puro — **só é devolvida nesta resposta**. Use como `Authorization: Bearer <plaintextKey>`.',
      example: 'crm_live_a1b2c3d4e5f6g7h8i9j0',
    }),
  }),
)
