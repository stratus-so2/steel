import { z } from 'zod'

export const ModuleKindSchema = z.enum(['SERVICE_DESK', 'CRM', 'COMMUNICATION'])

export const SetWorkspaceModuleAccessSchema = z.object({
  module: ModuleKindSchema,
  enabled: z.boolean(),
})

export type SetWorkspaceModuleAccessDTO = z.infer<
  typeof SetWorkspaceModuleAccessSchema
>
