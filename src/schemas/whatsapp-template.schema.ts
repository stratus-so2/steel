import { z } from 'zod'

export const WHATSAPP_TEMPLATE_CATEGORIES = [
  'UTILITY',
  'MARKETING',
  'AUTHENTICATION',
] as const
export type WhatsAppTemplateCategory =
  (typeof WHATSAPP_TEMPLATE_CATEGORIES)[number]

// Meta exige nome em snake_case (minúsculas, números e "_").
const NAME_PATTERN = /^[a-z0-9_]+$/

const ButtonTextSchema = z.string().trim().min(1).max(25)

export const CreateWhatsAppTemplateButtonSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('QUICK_REPLY'), text: ButtonTextSchema }),
  z.object({
    type: z.literal('URL'),
    text: ButtonTextSchema,
    url: z.string().trim().url(),
  }),
  z.object({
    type: z.literal('PHONE_NUMBER'),
    text: ButtonTextSchema,
    phone_number: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal('COPY_CODE'),
    text: ButtonTextSchema.optional(),
  }),
])

export const CreateWhatsAppTemplateSchema = z.object({
  connectionId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(NAME_PATTERN, 'Use apenas letras minúsculas, números e "_"'),
  language: z.string().trim().min(1).max(10),
  category: z.enum(WHATSAPP_TEMPLATE_CATEGORIES),
  headerText: z.string().trim().max(60).optional(),
  body: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(CreateWhatsAppTemplateButtonSchema).max(3).optional(),
})

export type CreateWhatsAppTemplateInput = z.infer<
  typeof CreateWhatsAppTemplateSchema
>
