import z from 'zod'
import { isMarketingTemplateId } from '@/src/lib/crm-marketing-templates'

const TemplatePropsSchema = z.record(z.string(), z.string())

/** IDs válidos de layout fixo (ver MARKETING_TEMPLATES). */
const MarketingTemplateIdSchema = z
  .string()
  .refine(isMarketingTemplateId, 'Layout desconhecido')

export const CreateCrmEmailTemplateSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório').max(200),
    subject: z.string().min(1, 'Assunto é obrigatório').max(300),
    // Livre (editor de blocos) OU a partir de um layout fixo — quando
    // `templateId` é informado, o service renderiza o HTML a partir dele e
    // `contentHtml` pode ser omitido.
    contentHtml: z.string().max(200_000).optional(),
    contentJson: z.string().max(200_000).optional(),
    templateId: MarketingTemplateIdSchema.optional(),
    templateProps: TemplatePropsSchema.optional(),
  })
  .refine((data) => Boolean(data.templateId) || Boolean(data.contentHtml), {
    message: 'Informe o conteúdo ou escolha um layout',
    path: ['contentHtml'],
  })

export type CreateCrmEmailTemplateDTO = z.infer<
  typeof CreateCrmEmailTemplateSchema
>

export const UpdateCrmEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  subject: z.string().min(1, 'Assunto é obrigatório').max(300).optional(),
  contentHtml: z.string().min(1).max(200_000).optional(),
  contentJson: z.string().max(200_000).optional(),
  templateId: MarketingTemplateIdSchema.optional(),
  templateProps: TemplatePropsSchema.optional(),
})

export type UpdateCrmEmailTemplateDTO = z.infer<
  typeof UpdateCrmEmailTemplateSchema
>

export const PreviewCrmEmailTemplateLayoutSchema = z.object({
  templateId: MarketingTemplateIdSchema,
  templateProps: TemplatePropsSchema.optional(),
})

export type PreviewCrmEmailTemplateLayoutDTO = z.infer<
  typeof PreviewCrmEmailTemplateLayoutSchema
>
