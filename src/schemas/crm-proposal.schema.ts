import z from 'zod'

const DocumentTypeEnum = z.enum([
  'PREMISES',
  'PORTFOLIO',
  'PROPOSAL',
  'CONTRACT',
])

const DocumentStatusEnum = z.enum(['DRAFT', 'PUBLISHED'])

export const CreateCrmProposalSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  content: z.string().max(200_000).default(''),
  type: DocumentTypeEnum.default('PROPOSAL'),
})

export type CreateCrmProposalDTO = z.infer<typeof CreateCrmProposalSchema>

export const UpdateCrmProposalSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).optional(),
  content: z.string().max(200_000).optional(),
  type: DocumentTypeEnum.optional(),
  // Alterna online/offline; o service carimba publishedAt no 1º publish.
  status: DocumentStatusEnum.optional(),
})

export type UpdateCrmProposalDTO = z.infer<typeof UpdateCrmProposalSchema>

export const ReorderCrmProposalsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
})

export type ReorderCrmProposalsDTO = z.infer<typeof ReorderCrmProposalsSchema>

export const RecordCrmProposalViewSchema = z.object({
  viewId: z.string().min(1),
  durationMs: z.number().int().min(0).default(0),
  reachedEnd: z.boolean().default(false),
  scrolledPct: z.number().int().min(0).max(100).default(0),
  referrer: z.string().max(500).optional(),
})

export type RecordCrmProposalViewDTO = z.infer<
  typeof RecordCrmProposalViewSchema
>
