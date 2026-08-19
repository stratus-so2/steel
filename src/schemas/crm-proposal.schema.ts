import z from 'zod'

export const CrmProposalSectionTypeEnum = z.enum([
  'COVER',
  'COMPANY_PRESENTATION',
  'CLIENT_NEEDS',
  'SOLUTION',
  'SCOPE',
  'PRODUCTS_PRICING',
  'COMMERCIAL_TERMS',
  'TERMS_CONDITIONS',
  'SIGNATURE',
])

export type CrmProposalSectionType = z.infer<typeof CrmProposalSectionTypeEnum>

export const CrmProposalStatusEnum = z.enum([
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
])

const CoverContentSchema = z.object({
  type: z.literal('COVER'),
  title: z.string().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().max(300).optional(),
  coverImageUrl: z.string().url().optional(),
})

const CompanyPresentationContentSchema = z.object({
  type: z.literal('COMPANY_PRESENTATION'),
  headline: z.string().max(200).optional(),
  description: z.string().min(1, 'Descrição é obrigatória').max(10_000),
  imageUrls: z.array(z.string().url()).max(6).default([]),
})

const ListItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2_000).default(''),
})

const ClientNeedsContentSchema = z.object({
  type: z.literal('CLIENT_NEEDS'),
  items: z.array(ListItemSchema).min(1, 'Adicione ao menos um item'),
})

const SolutionContentSchema = z.object({
  type: z.literal('SOLUTION'),
  description: z.string().min(1, 'Descrição é obrigatória').max(10_000),
  imageUrls: z.array(z.string().url()).max(6).default([]),
})

const ScopeContentSchema = z.object({
  type: z.literal('SCOPE'),
  items: z.array(ListItemSchema).min(1, 'Adicione ao menos um item'),
})

const ProductLineItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  total: z.number().nonnegative(),
})

const ProductsPricingContentSchema = z.object({
  type: z.literal('PRODUCTS_PRICING'),
  items: z.array(ProductLineItemSchema).min(1, 'Adicione ao menos um item'),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
})

const CommercialTermsContentSchema = z.object({
  type: z.literal('COMMERCIAL_TERMS'),
  paymentTerms: z
    .string()
    .min(1, 'Condições de pagamento são obrigatórias')
    .max(5_000),
  deliveryTerms: z.string().max(5_000).optional(),
  notes: z.string().max(5_000).optional(),
})

const TermsConditionsContentSchema = z.object({
  type: z.literal('TERMS_CONDITIONS'),
  text: z.string().min(1, 'Texto é obrigatório').max(20_000),
})

const SignatureContentSchema = z.object({
  type: z.literal('SIGNATURE'),
  companySignerName: z
    .string()
    .min(1, 'Nome do responsável é obrigatório')
    .max(200),
  companySignerRole: z.string().max(200).optional(),
  clientSignerName: z.string().max(200).optional(),
  signatureImageUrl: z.string().url().optional(),
})

export const CrmProposalSectionContentSchema = z.discriminatedUnion('type', [
  CoverContentSchema,
  CompanyPresentationContentSchema,
  ClientNeedsContentSchema,
  SolutionContentSchema,
  ScopeContentSchema,
  ProductsPricingContentSchema,
  CommercialTermsContentSchema,
  TermsConditionsContentSchema,
  SignatureContentSchema,
])

export type CrmProposalSectionContent = z.infer<
  typeof CrmProposalSectionContentSchema
>

// Valida que `content.type` bate com `type` do envelope da seção.
const CrmProposalSectionInputSchema = z
  .object({
    type: CrmProposalSectionTypeEnum,
    order: z.number().int().nonnegative(),
    enabled: z.boolean().default(true),
    content: CrmProposalSectionContentSchema,
  })
  .refine((section) => section.content.type === section.type, {
    message: 'O conteúdo da seção não corresponde ao tipo declarado',
    path: ['content'],
  })

export type CrmProposalSectionInputDTO = z.infer<
  typeof CrmProposalSectionInputSchema
>

export const CreateCrmProposalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  templateId: z.string().optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  opportunityId: z.string().optional(),
  responsibleId: z.string().min(1, 'Responsável é obrigatório'),
  validUntil: z.coerce.date().optional(),
  sections: z.array(CrmProposalSectionInputSchema).default([]),
})

export type CreateCrmProposalDTO = z.infer<typeof CreateCrmProposalSchema>

export const UpdateCrmProposalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
  responsibleId: z.string().min(1).optional(),
  validUntil: z.coerce.date().nullable().optional(),
  status: CrmProposalStatusEnum.optional(),
  sections: z.array(CrmProposalSectionInputSchema).optional(),
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
