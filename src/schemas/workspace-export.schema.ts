import { z } from 'zod'

/**
 * Ajustes › Exportações. `DATA` = complete workspace data (ZIP with one
 * JSON + CSV per table); `LOGS` = the workspace's logs in Axiom (ZIP with
 * CSV + NDJSON) for the last 1, 7 or 30 days. Each kind once per workspace
 * per day (São Paulo).
 */

export const WORKSPACE_EXPORT_KINDS = ['DATA', 'LOGS'] as const
export type WorkspaceExportKindValue = (typeof WORKSPACE_EXPORT_KINDS)[number]

export const CreateWorkspaceExportSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('DATA').meta({
      description: 'Dados completos do workspace (todas as tabelas).',
    }),
  }),
  z.object({
    kind: z.literal('LOGS').meta({
      description: 'Logs do workspace no Axiom (requisições e auditoria).',
    }),
    periodDays: z
      .union([z.literal(1), z.literal(7), z.literal(30)])
      .default(7)
      .meta({ description: 'Últimos 1, 7 ou 30 dias.' }),
  }),
])

export type CreateWorkspaceExportDTO = z.infer<
  typeof CreateWorkspaceExportSchema
>
