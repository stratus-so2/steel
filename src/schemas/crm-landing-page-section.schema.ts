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
  'PRICING',
  'FAQ',
  'STEPS',
  'NEWSLETTER',
  'LOGOS',
  'PRODUCTS',
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
  // Opcional — templates cujo grid de serviços/categorias tem uma imagem por
  // card (ex. categorias de e-commerce, salas de coworking) usam este campo;
  // os que não têm (Agency) simplesmente não o definem.
  imageUrl: z.string().trim().min(1).optional(),
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
  // Colagem de fotos adicionais (0-2), pra templates cujo layout tem mais de
  // uma imagem — `imageUrl` continua sendo a foto principal.
  imageUrls: z.array(z.string().trim().min(1)).max(2).optional().default([]),
})

const TestimonialContentSchema = z.object({
  type: z.literal('TESTIMONIAL'),
  quote: z.string().trim().min(1, 'Depoimento é obrigatório').max(1_000),
  authorName: z.string().trim().min(1, 'Nome é obrigatório').max(120),
  authorRole: z.string().trim().max(160).optional(),
  avatarUrl: z.string().trim().min(1).optional(),
  // 'default' = avatar ao lado do texto, sobre o fundo da página.
  // 'spotlight' = bloco full-bleed com cor de destaque, conteúdo centralizado
  // — cobre o padrão de "seção de depoimento em destaque" usado por vários
  // templates (ex. o segundo bloco de Testimonial do Agency).
  style: z.enum(['default', 'spotlight']).optional().default('default'),
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
  // Faixa de CTA opcional embaixo da grade de itens (título + texto próprios,
  // além do botão) — padrão usado por vários templates pra fechar a seção
  // com uma chamada pra ação.
  ctaTitle: z.string().trim().max(200).optional(),
  ctaDescription: z.string().trim().max(400).optional(),
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

const FooterLinkGroupSchema = z.object({
  title: z.string().trim().min(1).max(60),
  links: z.array(LinkSchema).max(8).default([]),
})

const SocialLinkSchema = z.object({
  // String livre (não enum) pra não travar em templates futuros com outras
  // redes — o componente casa por nome conhecido e cai num ícone genérico
  // de link pro resto.
  platform: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(500),
})

const FooterContentSchema = z.object({
  type: z.literal('FOOTER'),
  logoText: z.string().trim().max(60).optional(),
  text: z.string().trim().max(300).optional(),
  linkGroups: z.array(FooterLinkGroupSchema).max(6).optional().default([]),
  socialLinks: z.array(SocialLinkSchema).max(8).optional().default([]),
  // Mesma faixa de CTA opcional que Features usa antes da grade de links.
  ctaTitle: z.string().trim().max(200).optional(),
  ctaDescription: z.string().trim().max(400).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaHref: z.string().trim().max(500).optional(),
})

const PricingPlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // String (não number) — mantém formatação livre: "$19", "Grátis", "Sob consulta".
  price: z.string().trim().min(1).max(40),
  period: z.string().trim().max(40).optional(),
  features: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaHref: z.string().trim().max(500).optional(),
  highlighted: z.boolean().optional().default(false),
})

const PricingContentSchema = z.object({
  type: z.literal('PRICING'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  plans: z.array(PricingPlanSchema).max(6).default([]),
})

const FaqItemSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().max(1_000).default(''),
})

const FaqContentSchema = z.object({
  type: z.literal('FAQ'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  items: z.array(FaqItemSchema).max(20).default([]),
})

const StepItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).default(''),
})

const StepsContentSchema = z.object({
  type: z.literal('STEPS'),
  eyebrow: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  imageUrl: z.string().trim().min(1).optional(),
  items: z.array(StepItemSchema).max(8).default([]),
})

const NewsletterContentSchema = z.object({
  type: z.literal('NEWSLETTER'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  description: z.string().trim().max(400).optional(),
  placeholder: z.string().trim().max(80).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
})

const LogoItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  imageUrl: z.string().trim().min(1).optional(),
})

const LogosContentSchema = z.object({
  type: z.literal('LOGOS'),
  title: z.string().trim().max(200).optional(),
  logos: z.array(LogoItemSchema).max(12).default([]),
})

const ProductItemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  price: z.string().trim().min(1).max(40),
  originalPrice: z.string().trim().max(40).optional(),
  rating: z.number().min(0).max(5).optional(),
  imageUrl: z.string().trim().min(1).optional(),
})

const ProductsContentSchema = z.object({
  type: z.literal('PRODUCTS'),
  title: z.string().trim().min(1, 'Título é obrigatório').max(200),
  subtitle: z.string().trim().max(400).optional(),
  items: z.array(ProductItemSchema).max(16).default([]),
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
  PricingContentSchema,
  FaqContentSchema,
  StepsContentSchema,
  NewsletterContentSchema,
  LogosContentSchema,
  ProductsContentSchema,
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
