import z from 'zod'
import {
  AI_SKILL_SLUG_MAX,
  AI_SKILL_SLUG_PATTERN,
  normalizeSkillSlug,
} from '@/src/lib/ai/context/skill-command'

export const AI_SKILL_MAX_TOOLS = 30

export const AiScopeSchema = z.enum(['WORKSPACE', 'PERSONAL'])

const slugField = z
  .string()
  .transform(normalizeSkillSlug)
  .pipe(
    z
      .string()
      .min(1, 'Informe o comando')
      .max(AI_SKILL_SLUG_MAX, `No máximo ${AI_SKILL_SLUG_MAX} caracteres`)
      .regex(
        AI_SKILL_SLUG_PATTERN,
        'Use letras minúsculas, números e hífens (ex.: meu-trabalho)',
      ),
  )

const fields = {
  slug: slugField,
  name: z.string().trim().min(1, 'Informe o nome').max(80),
  description: z.string().trim().min(1, 'Descreva a skill').max(300),
  instructions: z
    .string()
    .trim()
    .min(1, 'Escreva as instruções')
    .max(8000, 'No máximo 8.000 caracteres'),
  mode: z.enum(['EXPLORE', 'AGENT', 'AUTOPILOT', 'TEST']).nullable(),
  toolNames: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9_]{1,63}$/, 'Nome de ferramenta inválido'),
    )
    .max(AI_SKILL_MAX_TOOLS)
    .refine((names) => new Set(names).size === names.length, {
      message: 'Ferramenta repetida',
    }),
  enabled: z.boolean(),
}

export const CreateAiSkillSchema = z.object({
  /** PERSONAL (default) for anyone; WORKSPACE for OWNER/ADMIN only. */
  scope: AiScopeSchema.default('PERSONAL'),
  slug: fields.slug,
  name: fields.name,
  description: fields.description,
  instructions: fields.instructions,
  mode: fields.mode.default(null),
  toolNames: fields.toolNames.default([]),
  enabled: fields.enabled.default(true),
})

/**
 * Partial update. A built-in skill (`builtin:<slug>`) only takes `enabled`.
 * The scope never changes (delete and create again).
 */
export const UpdateAiSkillSchema = z
  .object({
    slug: fields.slug,
    name: fields.name,
    description: fields.description,
    instructions: fields.instructions,
    mode: fields.mode,
    toolNames: fields.toolNames,
    enabled: fields.enabled,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nada para atualizar',
  })

export type CreateAiSkillDTO = z.infer<typeof CreateAiSkillSchema>
export type UpdateAiSkillDTO = z.infer<typeof UpdateAiSkillSchema>
