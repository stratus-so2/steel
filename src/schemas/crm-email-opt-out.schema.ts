import z from 'zod'

/**
 * Token do link de descadastro (`/unsubscribe/<token>`): assinado por HMAC,
 * não exige sessão. Formato `<recipientIdBase64url>.<assinaturaBase64url>`.
 */
export const CrmEmailUnsubscribeSchema = z.object({
  token: z
    .string()
    .min(10, 'Link de descadastro inválido')
    .max(512, 'Link de descadastro inválido')
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Link de descadastro inválido'),
})

export type CrmEmailUnsubscribeDTO = z.infer<typeof CrmEmailUnsubscribeSchema>
