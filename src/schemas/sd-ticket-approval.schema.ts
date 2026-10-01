import z from 'zod'
import { sdId } from './sd-config.schema'

/** Validade padrão do link de aprovação (dias). */
export const SD_APPROVAL_DEFAULT_DAYS = 7

const approver = z.union([
  z.object({ userId: sdId }),
  z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .pipe(z.email('E-mail inválido')),
    name: z.string().trim().min(1).max(120).nullable().optional(),
  }),
])
export type SdApproverInput = z.infer<typeof approver>

/**
 * Pedido de aprovação para um ou mais aprovadores (usuários do workspace ou
 * e-mails externos). Cada aprovador recebe um link próprio; a **primeira
 * resposta decide** e cancela os demais pedidos pendentes do chamado.
 */
export const RequestSdTicketApprovalSchema = z.object({
  approvers: z
    .array(approver)
    .min(1, 'Informe ao menos um aprovador')
    .max(10, 'No máximo 10 aprovadores por pedido'),
  message: z.string().trim().max(2000).nullable().optional(),
  expiresInDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(SD_APPROVAL_DEFAULT_DAYS),
})
export type RequestSdTicketApprovalDTO = z.infer<
  typeof RequestSdTicketApprovalSchema
>

export const ResendSdTicketApprovalSchema = z.object({
  expiresInDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .default(SD_APPROVAL_DEFAULT_DAYS),
})
export type ResendSdTicketApprovalDTO = z.infer<
  typeof ResendSdTicketApprovalSchema
>

/** Token do link público: 32 bytes em base64url. */
export const SdApprovalTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Link de aprovação inválido')

export const RespondSdApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().trim().max(2000).nullable().optional(),
})
export type RespondSdApprovalDTO = z.infer<typeof RespondSdApprovalSchema>
