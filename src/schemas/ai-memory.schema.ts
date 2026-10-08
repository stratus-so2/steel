import z from 'zod'
import { MEMORY_MAX_CHARS } from '@/src/lib/ai/context/memory-guard'
import { AiScopeSchema } from './ai-skill.schema'

const contentField = z
  .string()
  .trim()
  .min(1, 'Escreva o que o Steel AI deve lembrar')
  .max(MEMORY_MAX_CHARS, `No máximo ${MEMORY_MAX_CHARS} caracteres`)

export const ListAiMemoriesQuerySchema = z.object({
  /** Case-insensitive text search over the content. */
  q: z.string().trim().max(200).optional(),
})

export const CreateAiMemorySchema = z.object({
  /** PERSONAL (default) for anyone; WORKSPACE for OWNER/ADMIN only. */
  scope: AiScopeSchema.default('PERSONAL'),
  content: contentField,
})

export const UpdateAiMemorySchema = z.object({ content: contentField })

/** Arguments of the `memory_save` tool (what the model sends). */
export const MemorySaveArgsSchema = z.object({
  content: contentField,
  scope: z
    .enum(['workspace', 'personal', 'WORKSPACE', 'PERSONAL'])
    .default('personal')
    .transform((scope) => scope.toUpperCase() as 'WORKSPACE' | 'PERSONAL'),
})

/** Arguments of the `memory_forget` tool. */
export const MemoryForgetArgsSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

export type ListAiMemoriesQueryDTO = z.infer<typeof ListAiMemoriesQuerySchema>
export type CreateAiMemoryDTO = z.infer<typeof CreateAiMemorySchema>
export type UpdateAiMemoryDTO = z.infer<typeof UpdateAiMemorySchema>
export type MemorySaveArgs = z.infer<typeof MemorySaveArgsSchema>
export type MemoryForgetArgs = z.infer<typeof MemoryForgetArgsSchema>
