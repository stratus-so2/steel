import { z } from 'zod'

/** Sem `ids`, marca todas as notificações do usuário no workspace. */
export const MarkNotificationsReadSchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(),
})

export type MarkNotificationsReadDTO = z.infer<
  typeof MarkNotificationsReadSchema
>
