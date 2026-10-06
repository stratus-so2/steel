import { z } from 'zod'
import { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'
import { dto } from '../../common'

/** DTO do Hook Vault (`types/crm-hook-vault.d.ts`). */

const dateTime = () => z.iso.datetime()

export const CrmHookVaultItemDTO = dto(
  'CrmHookVaultItem',
  z
    .object({
      id: z.string(),
      text: z.string().meta({
        example: 'Você está perdendo leads por um motivo simples…',
      }),
      platform: z.enum(CRM_SOCIAL_PLATFORMS).nullable(),
      usageCount: z.number().int(),
      notes: z.string().nullable(),
      workspaceId: z.string(),
      createdById: z.string(),
      updatedById: z.string().nullable(),
      position: z.number(),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    })
    .meta({
      description:
        'Gancho (hook) de conteúdo salvo no Hook Vault para reutilizar em posts.',
    }),
)
