import z from 'zod'
import { CrmLandingPageSectionInputSchema } from './crm-landing-page-section.schema'

export const CreateCrmLandingPageSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  templateKey: z.string().min(1, 'Modelo é obrigatório').max(60),
  sections: z.array(CrmLandingPageSectionInputSchema).max(30).default([]),
})

export type CreateCrmLandingPageDTO = z.infer<typeof CreateCrmLandingPageSchema>

const LandingPageStatusEnum = z.enum(['DRAFT', 'PUBLISHED'])

export const UpdateCrmLandingPageSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).optional(),
  sections: z.array(CrmLandingPageSectionInputSchema).max(30).optional(),
  // Alterna online/offline; o service carimba publishedAt no 1º publish.
  status: LandingPageStatusEnum.optional(),
})

export type UpdateCrmLandingPageDTO = z.infer<typeof UpdateCrmLandingPageSchema>

export const ReorderCrmLandingPagesSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmLandingPagesDTO = z.infer<
  typeof ReorderCrmLandingPagesSchema
>

export const RecordCrmLandingPageViewSchema = z.object({
  viewId: z.string().min(1),
  durationMs: z.number().int().min(0).default(0),
  ctaClicks: z.number().int().min(0).default(0),
  referrer: z.string().max(500).optional(),
})

export type RecordCrmLandingPageViewDTO = z.infer<
  typeof RecordCrmLandingPageViewSchema
>
