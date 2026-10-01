import z from 'zod'

/** PNG da assinatura em data URL: até ~1,5 MB decodificado. */
export const SD_SIGNATURE_MAX_DATA_URL = 2_000_000

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/

export const CreateSdTicketSignatureSchema = z.object({
  signerName: z
    .string()
    .trim()
    .min(2, 'Informe o nome de quem assina')
    .max(120),
  /** CPF, RG ou outro documento (texto livre). */
  signerDocument: z.string().trim().max(32).nullable().optional(),
  signerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('E-mail inválido'))
    .nullable()
    .optional(),
  purpose: z.string().trim().min(1).max(200).optional(),
  /** `data:image/png;base64,...` gerado pelo canvas. */
  image: z
    .string()
    .max(SD_SIGNATURE_MAX_DATA_URL, 'Imagem da assinatura muito grande')
    .regex(PNG_DATA_URL, 'A assinatura deve ser um PNG'),
})
export type CreateSdTicketSignatureDTO = z.infer<
  typeof CreateSdTicketSignatureSchema
>
