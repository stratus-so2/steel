import { z } from 'zod'
import { FEATURE_KEYS } from '../config/features'

export const FeatureKeySchema = z.enum(FEATURE_KEYS)

/**
 * Override de uma feature num workspace, feito pelo admin global.
 * `enabled: null` remove o override (volta ao default do plano).
 * `expiresAt` opcional: depois dele o override deixa de valer sozinho.
 */
export const SetFeatureOverrideSchema = z
  .object({
    key: FeatureKeySchema,
    enabled: z.boolean().nullable(),
    note: z
      .string()
      .trim()
      .max(500, 'Nota muito longa')
      .nullish()
      .transform((v) => (v ? v : null)),
    expiresAt: z.iso
      .datetime({ offset: true })
      .nullish()
      .transform((v) => (v ? new Date(v) : null)),
  })
  .refine((v) => !v.expiresAt || v.expiresAt.getTime() > Date.now(), {
    message: 'A validade precisa estar no futuro',
    path: ['expiresAt'],
  })

export type SetFeatureOverrideInput = z.infer<typeof SetFeatureOverrideSchema>
