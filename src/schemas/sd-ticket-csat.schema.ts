import z from 'zod'

/**
 * Avaliação do atendimento (CSAT) pelo solicitante: 1–5 estrelas e um
 * comentário opcional. Só depois de resolvido/fechado e uma única vez.
 */
export const SubmitSdTicketCsatSchema = z.object({
  score: z
    .number({ error: 'Escolha de 1 a 5 estrelas' })
    .int('Escolha de 1 a 5 estrelas')
    .min(1, 'Escolha de 1 a 5 estrelas')
    .max(5, 'Escolha de 1 a 5 estrelas'),
  comment: z
    .string()
    .trim()
    .max(2000, 'Comentário muito longo (máx. 2000 caracteres)')
    .optional()
    .transform((value) => (value ? value : undefined)),
})

export type SubmitSdTicketCsatDTO = z.input<typeof SubmitSdTicketCsatSchema>
