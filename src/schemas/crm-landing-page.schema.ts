import z from 'zod'

export const CreateCrmLandingPageSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  html: z.string().max(500_000).default(''),
})

export type CreateCrmLandingPageDTO = z.infer<typeof CreateCrmLandingPageSchema>

const LandingPageStatusEnum = z.enum(['DRAFT', 'PUBLISHED'])

export const UpdateCrmLandingPageSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).optional(),
  html: z.string().max(500_000).optional(),
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
