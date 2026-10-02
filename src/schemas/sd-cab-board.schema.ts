import z from 'zod'
import { sdDescription, sdId, sdName } from './sd-config.schema'
import { SdConditionsSchema } from './sd-rule.schema'

/**
 * Comitês de mudança (CAB, `SdCabBoard` + `SdCabMember`): quem aprova, quais
 * votos são obrigatórios e quantas aprovações fecham a rodada. As condições
 * (`SdConditionsSchema`) escolhem o comitê responsável pelo chamado — mesma
 * semântica das regras de SLA/automação (`src/lib/servicedesk/conditions.ts`).
 *
 * `quorum: 0` = **todos os membros**. Um quórum maior que o número de membros
 * é recusado pelo service com `SD_CAB_QUORUM_INVALID`.
 */

export const SdCabMemberInputSchema = z.object({
  userId: sdId,
  /** Voto obrigatório: a rodada não fecha sem ele, mesmo com quórum. */
  required: z.boolean().default(false),
})
export type SdCabMemberInput = z.infer<typeof SdCabMemberInputSchema>

const members = z
  .array(SdCabMemberInputSchema)
  .max(30, 'No máximo 30 membros por comitê')
  .refine(
    (list) => new Set(list.map((m) => m.userId)).size === list.length,
    'Há membros repetidos no comitê',
  )

export const CreateSdCabBoardSchema = z.object({
  name: sdName,
  description: sdDescription,
  /** 0 = todos os membros. */
  quorum: z.number().int().min(0).max(30).default(0),
  /** Uma reprovação encerra a rodada como reprovada. */
  rejectEnds: z.boolean().default(true),
  conditions: SdConditionsSchema.default([]),
  active: z.boolean().default(true),
  position: z.number().int().min(0).max(999).optional(),
  members: members.default([]),
})
export type CreateSdCabBoardDTO = z.infer<typeof CreateSdCabBoardSchema>

export const UpdateSdCabBoardSchema = z
  .object({
    name: sdName.optional(),
    description: sdDescription,
    quorum: z.number().int().min(0).max(30).optional(),
    rejectEnds: z.boolean().optional(),
    conditions: SdConditionsSchema.optional(),
    active: z.boolean().optional(),
    position: z.number().int().min(0).max(999).optional(),
    /** Lista completa: substitui os membros atuais. */
    members: members.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdCabBoardDTO = z.infer<typeof UpdateSdCabBoardSchema>
