import z from 'zod'

/**
 * Vocabulário compartilhado de tipos de seção entre os 10 templates fixos.
 * Cada template habilita um subconjunto (definido no catálogo estático em
 * `src/lib/landing-page-templates/`), na ordem que o usuário escolher — uma
 * página pode repetir o mesmo tipo mais de uma vez (ex.: dois blocos de
 * Testimonial), então não há unicidade por tipo aqui.
 */
export const CrmLandingPageSectionTypeEnum = z.enum([
  'HEADER',
  'HERO',
  'SERVICES',
  'FACTS',
  'ABOUT',
  'TESTIMONIAL',
  'FEATURES',
  'WORKS',
  'FOOTER',
])

export type CrmLandingPageSectionType = z.infer<
  typeof CrmLandingPageSectionTypeEnum
>

const LinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(500),
})

const HeaderContentSchema = z.object({
  type: z.literal('HEADER'),
  logoText: z.string().trim().min(1, 'Texto do logo é obrigatório').max(60),
  navLinks: z.array(LinkSchema).max(8).default([]),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaHref: z.string().trim().max(500).optional(),
})

const HeroContentSchema = z.object({
  type: z.literal('HERO'),
  eyebrow: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaHref: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().min(1).optional(),
})

const ServiceItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
})

const ServicesContentSchema = z.object({
  type: z.literal('SERVICES'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  items: z.array(ServiceItemSchema).max(12).default([]),
})

const FactItemSchema = z.object({
  value: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(200),
})

const FactsContentSchema = z.object({
  type: z.literal('FACTS'),
  items: z.array(FactItemSchema).max(8).default([]),
})

const AboutContentSchema = z.object({
  type: z.literal('ABOUT'),
  eyebrow: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  description: z.string().trim().max(4_000).default(''),
  imageUrl: z.string().trim().min(1).optional(),
})

const TestimonialContentSchema = z.object({
  type: z.literal('TESTIMONIAL'),
  quote: z.string().trim().min(1, 'Depoimento é obrigatório').max(1_000),
  authorName: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  authorRole: z.string().trim().max(160).optional(),
  avatarUrl: z.string().trim().min(1).optional(),
})

const FeatureItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
})

const FeaturesContentSchema = z.object({
  type: z.literal('FEATURES'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  items: z.array(FeatureItemSchema).max(12).default([]),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaHref: z.string().trim().max(500).optional(),
})

const WorkItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().max(120).default(''),
  imageUrl: z.string().trim().min(1).optional(),
})

const WorksContentSchema = z.object({
  type: z.literal('WORKS'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  items: z.array(WorkItemSchema).max(12).default([]),
})

const FooterContentSchema = z.object({
  type: z.literal('FOOTER'),
  text: z.string().trim().max(300).optional(),
  links: z.array(LinkSchema).max(12).default([]),
})

export const CrmLandingPageSectionContentSchema = z.discriminatedUnion('type', [
  HeaderContentSchema,
  HeroContentSchema,
  ServicesContentSchema,
  FactsContentSchema,
  AboutContentSchema,
  TestimonialContentSchema,
  FeaturesContentSchema,
  WorksContentSchema,
  FooterContentSchema,
])

export type CrmLandingPageSectionContent = z.infer<
  typeof CrmLandingPageSectionContentSchema
>

// Valida que `content.type` bate com `type` do envelope da seção — mesma
// checagem usada em CrmProposalSection (src/schemas/crm-proposal.schema.ts).
export const CrmLandingPageSectionInputSchema = z
  .object({
    type: CrmLandingPageSectionTypeEnum,
    order: z.number().int().nonnegative(),
    enabled: z.boolean().default(true),
    content: CrmLandingPageSectionContentSchema,
  })
  .refine((section) => section.content.type === section.type, {
    message: 'O conteúdo da seção não corresponde ao tipo declarado',
    path: ['content'],
  })

export type CrmLandingPageSectionInputDTO = z.infer<
  typeof CrmLandingPageSectionInputSchema
>
