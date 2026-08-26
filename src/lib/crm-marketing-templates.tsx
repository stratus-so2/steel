import type { ReactElement } from 'react'
import { NewsletterUpdateEmail } from '@/components/emails/marketing/newsletter-update'
import { PromoAnnouncementEmail } from '@/components/emails/marketing/promo-announcement'

export type MarketingTemplateFieldType = 'text' | 'textarea' | 'image' | 'url'

export type MarketingTemplateField = {
  key: string
  label: string
  type: MarketingTemplateFieldType
  placeholder?: string
  required?: boolean
}

export type MarketingTemplateId = 'promo-announcement' | 'newsletter-update'

export type MarketingTemplateDefinition = {
  id: MarketingTemplateId
  label: string
  description: string
  fields: MarketingTemplateField[]
  defaultProps: Record<string, string>
  render: (props: Record<string, string>) => ReactElement
}

/**
 * Layouts fixos baseados em react-email: o usuário só edita os campos
 * declarados em `fields` (texto/imagem) — estrutura e estilo do email não
 * são editáveis, ao contrário do editor de blocos livre das campanhas.
 */
export const MARKETING_TEMPLATES: Record<
  MarketingTemplateId,
  MarketingTemplateDefinition
> = {
  'promo-announcement': {
    id: 'promo-announcement',
    label: 'Anúncio / Promoção',
    description: 'Imagem de destaque, título, texto e botão de ação.',
    fields: [
      { key: 'heading', label: 'Título', type: 'text', required: true },
      { key: 'subheading', label: 'Subtítulo', type: 'text' },
      { key: 'body', label: 'Texto', type: 'textarea', required: true },
      { key: 'imageUrl', label: 'Imagem', type: 'image' },
      { key: 'ctaLabel', label: 'Texto do botão', type: 'text' },
      { key: 'ctaUrl', label: 'Link do botão', type: 'url' },
    ],
    defaultProps: {
      heading: 'Novidade por aqui',
      subheading: '',
      body: 'Conte a novidade para seus contatos.',
      imageUrl: '',
      ctaLabel: 'Saiba mais',
      ctaUrl: '',
    },
    render: (props) => (
      <PromoAnnouncementEmail
        heading={props.heading}
        subheading={props.subheading || undefined}
        body={props.body}
        imageUrl={props.imageUrl || undefined}
        ctaLabel={props.ctaLabel || undefined}
        ctaUrl={props.ctaUrl || undefined}
      />
    ),
  },
  'newsletter-update': {
    id: 'newsletter-update',
    label: 'Newsletter / Atualização',
    description: 'Título, imagem opcional, texto e botão de ação.',
    fields: [
      { key: 'heading', label: 'Título', type: 'text', required: true },
      { key: 'body', label: 'Texto', type: 'textarea', required: true },
      { key: 'imageUrl', label: 'Imagem', type: 'image' },
      { key: 'ctaLabel', label: 'Texto do botão', type: 'text' },
      { key: 'ctaUrl', label: 'Link do botão', type: 'url' },
    ],
    defaultProps: {
      heading: 'Atualizações deste mês',
      body: 'Resumo do que aconteceu.',
      imageUrl: '',
      ctaLabel: 'Ver mais',
      ctaUrl: '',
    },
    render: (props) => (
      <NewsletterUpdateEmail
        heading={props.heading}
        body={props.body}
        imageUrl={props.imageUrl || undefined}
        ctaLabel={props.ctaLabel || undefined}
        ctaUrl={props.ctaUrl || undefined}
      />
    ),
  },
}

export function isMarketingTemplateId(
  value: string,
): value is MarketingTemplateId {
  return value in MARKETING_TEMPLATES
}

export function resolveMarketingTemplateProps(
  templateId: MarketingTemplateId,
  props: Record<string, string> | undefined,
): Record<string, string> {
  return { ...MARKETING_TEMPLATES[templateId].defaultProps, ...props }
}
