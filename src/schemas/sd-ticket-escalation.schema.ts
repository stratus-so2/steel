import z from 'zod'

const id = z.string().min(1).max(64)

/**
 * Escalonamento manual. FUNCTIONAL = outro time/pessoa (exige destino);
 * HIERARCHICAL = sobe um nível (líder do departamento; destino opcional).
 */
export const EscalateSdTicketSchema = z
  .object({
    kind: z.enum(['FUNCTIONAL', 'HIERARCHICAL']),
    toDepartmentId: id.optional(),
    toUserId: id.optional(),
    reason: z.string().trim().min(1, 'Informe o motivo').max(500),
  })
  .refine(
    (d) =>
      d.kind !== 'FUNCTIONAL' ||
      d.toDepartmentId !== undefined ||
      d.toUserId !== undefined,
    {
      message: 'Escalonamento funcional exige um departamento ou responsável',
      path: ['toDepartmentId'],
    },
  )

export type EscalateSdTicketDTO = z.infer<typeof EscalateSdTicketSchema>
