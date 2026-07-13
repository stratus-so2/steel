import { z } from 'zod'

export const ModuleKindSchema = z.enum(['SERVICE_DESK', 'CRM', 'COMMUNICATION'])

export const SaveWorkspaceConnectionSchema = z.object({
  host: z.string().min(1, 'Host é obrigatório').max(255),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, 'Usuário é obrigatório').max(255),
  password: z.string().min(1, 'Senha é obrigatória').max(255),
  database: z.string().min(1, 'Banco de dados é obrigatório').max(255),
  sslEnabled: z.boolean().optional().default(true),
})

export type SaveWorkspaceConnectionDTO = z.infer<
  typeof SaveWorkspaceConnectionSchema
>

export const TestWorkspaceConnectionSchema =
  SaveWorkspaceConnectionSchema.extend({
    module: ModuleKindSchema,
  })

export type TestWorkspaceConnectionDTO = z.infer<
  typeof TestWorkspaceConnectionSchema
>
