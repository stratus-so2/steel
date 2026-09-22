import z from 'zod'

/**
 * Peças comuns aos schemas de configuração do ServiceDesk (`sd-*`).
 */

export const sdId = z.string().min(1).max(64)

export const sdName = z
  .string()
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(120, 'Nome muito longo')

export const sdDescription = z.string().trim().max(2000).nullable().optional()

export const sdColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use #RRGGBB)')
  .nullable()
  .optional()

export const SD_PHASE_CATEGORIES = [
  'NEW',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'CANCELED',
] as const
export const SdPhaseCategoryEnum = z.enum(SD_PHASE_CATEGORIES)

export const ReorderSdConfigSchema = z.object({
  orderedIds: z.array(sdId).min(1).max(500),
})
export type ReorderSdConfigDTO = z.infer<typeof ReorderSdConfigSchema>

/** `?includeInactive=true` nas listagens de configuração. */
export const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true')

export const ListSdAgentsSchema = z.object({
  /** Inclui também os solicitantes (membros sem departamento). */
  includeRequesters: booleanQuery,
})
export type ListSdAgentsDTO = z.infer<typeof ListSdAgentsSchema>
