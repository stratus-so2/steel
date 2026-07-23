import z from 'zod'

// Não há sync real contra Gmail/Outlook (exige client OAuth por provedor,
// não fornecido). Esta conta serve apenas como contexto/agrupamento para
// e-mails e eventos registrados manualmente pelo usuário.
export const CreateCrmEmailAccountSchema = z.object({
  provider: z.enum(['GMAIL', 'OUTLOOK']),
  email: z.email(),
})

export type CreateCrmEmailAccountDTO = z.infer<
  typeof CreateCrmEmailAccountSchema
>

export const CreateCrmEmailMessageSchema = z.object({
  accountId: z.string().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  subject: z.string().max(300).optional(),
  snippet: z.string().max(10_000).optional(),
  fromEmail: z.email(),
  toEmails: z.array(z.email()).default([]),
  personId: z.string().optional(),
  opportunityId: z.string().optional(),
  sentAt: z.coerce.date(),
})

export type CreateCrmEmailMessageDTO = z.infer<
  typeof CreateCrmEmailMessageSchema
>

export const CreateCrmCalendarEventSchema = z.object({
  accountId: z.string().optional(),
  title: z.string().min(1, 'Título é obrigatório').max(300),
  description: z.string().max(10_000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  attendees: z.array(z.email()).default([]),
  personId: z.string().optional(),
  opportunityId: z.string().optional(),
})

export type CreateCrmCalendarEventDTO = z.infer<
  typeof CreateCrmCalendarEventSchema
>

export const UpdateCrmCalendarEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(300).optional(),
  description: z.string().max(10_000).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  attendees: z.array(z.email()).optional(),
})

export type UpdateCrmCalendarEventDTO = z.infer<
  typeof UpdateCrmCalendarEventSchema
>
