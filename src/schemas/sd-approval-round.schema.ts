import z from 'zod'
import { sdId } from './sd-config.schema'
import { SD_APPROVAL_DEFAULT_DAYS } from './sd-ticket-approval.schema'

/**
 * Rodada de aprovação do CAB (`SdApprovalRound`): dispara um
 * `SdTicketApproval` por membro do comitê e fecha sozinha ao bater o quórum
 * (ou na primeira reprovação, quando `rejectEnds`). Sem `boardId` o comitê é
 * escolhido pelas condições dos comitês ativos, na ordem de `position`.
 */
export const OpenSdApprovalRoundSchema = z.object({
  /** Comitê explícito; sem ele vale a seleção por condições. */
  boardId: sdId.optional(),
  message: z.string().trim().max(2000).nullable().optional(),
  expiresInDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(SD_APPROVAL_DEFAULT_DAYS),
})
export type OpenSdApprovalRoundDTO = z.infer<typeof OpenSdApprovalRoundSchema>
