import { z } from 'zod'

/** Motivo obrigatório das ações destrutivas do admin (vai para a auditoria). */
export const AdminReasonSchema = z
  .string()
  .trim()
  .min(5, 'Descreva o motivo (mínimo 5 caracteres)')
  .max(500, 'Motivo muito longo (máximo 500 caracteres)')

export const SetWorkspaceStatusSchema = z.object({
  action: z.enum(['suspend', 'reactivate']),
  reason: AdminReasonSchema,
})
export type SetWorkspaceStatusInput = z.infer<typeof SetWorkspaceStatusSchema>

export const ChangeWorkspacePlanSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  reason: AdminReasonSchema,
})
export type ChangeWorkspacePlanInput = z.infer<typeof ChangeWorkspacePlanSchema>

/** Exclusão definitiva e restore: o admin digita o slug para confirmar. */
export const ConfirmedWorkspaceActionSchema = z.object({
  confirmSlug: z.string().trim().min(1, 'Digite o slug do workspace'),
  reason: AdminReasonSchema,
})
export type ConfirmedWorkspaceActionInput = z.infer<
  typeof ConfirmedWorkspaceActionSchema
>

export const TriggerBackupSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('FULL') }),
  z.object({ scope: z.literal('WORKSPACE'), workspaceId: z.string().min(1) }),
])
export type TriggerBackupInput = z.infer<typeof TriggerBackupSchema>

export const ListBackupsQuerySchema = z.object({
  scope: z.enum(['FULL', 'WORKSPACE']).optional(),
  workspaceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
export type ListBackupsQuery = z.infer<typeof ListBackupsQuerySchema>

export const BackupDownloadQuerySchema = z.object({
  exp: z.coerce.number().int().positive(),
  sig: z.string().regex(/^[a-f0-9]{64}$/),
})
