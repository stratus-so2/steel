import z from 'zod'
import {
  CrmProposalSectionContentSchema,
  CrmProposalSectionTypeEnum,
} from './crm-proposal.schema'

const CrmProposalTemplateSectionInputSchema = z
  .object({
    type: CrmProposalSectionTypeEnum,
    order: z.number().int().nonnegative(),
    enabled: z.boolean().default(true),
    defaultContent: CrmProposalSectionContentSchema.optional(),
  })
  .refine(
    (section) =>
      !section.defaultContent || section.defaultContent.type === section.type,
    {
      message: 'O conteúdo padrão da seção não corresponde ao tipo declarado',
      path: ['defaultContent'],
    },
  )

export type CrmProposalTemplateSectionInputDTO = z.infer<
  typeof CrmProposalTemplateSectionInputSchema
>

export const CreateCrmProposalTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(2_000).optional(),
  logoUrl: z.string().url().optional(),
  sections: z.array(CrmProposalTemplateSectionInputSchema).default([]),
})

export type CreateCrmProposalTemplateDTO = z.infer<
  typeof CreateCrmProposalTemplateSchema
>

export const UpdateCrmProposalTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  description: z.string().max(2_000).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  sections: z.array(CrmProposalTemplateSectionInputSchema).optional(),
})

export type UpdateCrmProposalTemplateDTO = z.infer<
  typeof UpdateCrmProposalTemplateSchema
>
