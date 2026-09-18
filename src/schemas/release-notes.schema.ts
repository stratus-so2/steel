import { z } from 'zod'

/**
 * Pedido de rascunho do e-mail de novidades: busca a última release do GitHub
 * ou converte notas coladas pelo admin.
 */
export const ReleaseDraftRequestSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('github') }),
  z.object({
    source: z.literal('manual'),
    markdown: z
      .string()
      .trim()
      .min(1, 'Cole as notas da release')
      .max(50_000, 'Notas muito longas'),
  }),
])

export type ReleaseDraftRequest = z.infer<typeof ReleaseDraftRequestSchema>
