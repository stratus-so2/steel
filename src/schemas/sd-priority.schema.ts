import z from 'zod'
import { sdColor, sdDescription, sdId, sdName } from './sd-config.schema'

/**
 * Escalas ITIL customizáveis: impacto, urgência, prioridade e severidade.
 * `level` é único por workspace dentro de cada escala (maior = mais).
 */
export const SD_SCALE_KINDS = [
  'impact',
  'urgency',
  'priority',
  'severity',
] as const
export const SdScaleKindEnum = z.enum(SD_SCALE_KINDS)
export type SdScaleKind = (typeof SD_SCALE_KINDS)[number]

const level = z.number().int().min(1).max(100)

export const CreateSdScaleItemSchema = z.object({
  name: sdName,
  /** Impacto, urgência e severidade. */
  description: sdDescription,
  /** Prioridade e severidade. */
  color: sdColor,
  level,
  /** Só prioridade: a padrão quando o chamado não informa. */
  isDefault: z.boolean().default(false),
})
export type CreateSdScaleItemDTO = z.infer<typeof CreateSdScaleItemSchema>

export const UpdateSdScaleItemSchema = z
  .object({
    name: sdName.optional(),
    description: sdDescription,
    color: sdColor,
    level: level.optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdScaleItemDTO = z.infer<typeof UpdateSdScaleItemSchema>

export const SdPriorityMatrixCellSchema = z.object({
  impactId: sdId,
  urgencyId: sdId,
  priorityId: sdId,
})

/** Grade inteira impacto × urgência → prioridade (substitui a atual). */
export const SaveSdPriorityMatrixSchema = z.object({
  cells: z
    .array(SdPriorityMatrixCellSchema)
    .max(400)
    .refine(
      (cells) =>
        new Set(cells.map((c) => `${c.impactId}:${c.urgencyId}`)).size ===
        cells.length,
      { message: 'Cada combinação impacto × urgência aparece uma única vez' },
    ),
})
export type SaveSdPriorityMatrixDTO = z.infer<typeof SaveSdPriorityMatrixSchema>
