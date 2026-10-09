import type {
  EmailBuilderFeature,
  EmailBuilderProduct,
  EmailBuilderSectionType,
} from '@/src/schemas/crm-email-builder.schema'
import { CAMPAIGN_LINK } from './variables'

/**
 * What the bottom panel shows for each section type. Keys match the
 * section props in `crm-email-builder.schema.ts`; limits mirror the schema.
 */

export type ScalarFieldKind = 'text' | 'textarea' | 'richtext' | 'link'

export type ScalarField = {
  kind: ScalarFieldKind
  key: string
  label: string
  max: number
  placeholder?: string
}

export type ImageField = {
  kind: 'image'
  key: string
  altKey: string
  label: string
}

export type ItemsField = {
  kind: 'items'
  key: 'items'
  label: string
  itemLabel: string
  min: number
  max: number
  fields: (ScalarField | ImageField)[]
  createItem: () => EmailBuilderProduct | EmailBuilderFeature
}

export type FieldSpec = ScalarField | ImageField | ItemsField

const text = (key: string, label: string, max: number, placeholder?: string) =>
  ({ kind: 'text', key, label, max, placeholder }) as ScalarField
const textarea = (key: string, label: string, max: number) =>
  ({ kind: 'textarea', key, label, max }) as ScalarField
const rich = (key: string, label: string) =>
  ({ kind: 'richtext', key, label, max: 10_000 }) as ScalarField
const link = (key: string, label: string) =>
  ({ kind: 'link', key, label, max: 2000 }) as ScalarField
const image = (key: string, altKey: string, label = 'Imagem') =>
  ({ kind: 'image', key, altKey, label }) as ImageField

export const SECTION_FIELDS: Record<EmailBuilderSectionType, FieldSpec[]> = {
  header: [],
  hero: [
    text('eyebrow', 'Chamada acima do título', 80, 'Ex.: Lançamento'),
    text('heading', 'Título', 200),
    rich('body', 'Texto'),
    image('imageSrc', 'imageAlt'),
    text('buttonLabel', 'Texto do botão', 60, 'Vazio = sem botão'),
    link('buttonUrl', 'Link do botão'),
  ],
  text: [text('heading', 'Título', 200, 'Opcional'), rich('body', 'Texto')],
  image: [
    image('imageSrc', 'imageAlt'),
    link('linkUrl', 'Link ao clicar'),
    text('caption', 'Legenda', 200, 'Opcional'),
  ],
  button: [
    text('label', 'Texto do botão', 60),
    link('url', 'Link do botão'),
    text('note', 'Observação abaixo do botão', 200, 'Opcional'),
  ],
  products: [
    text('heading', 'Título', 200),
    text('buttonLabel', 'Texto do link de cada produto', 60),
    {
      kind: 'items',
      key: 'items',
      label: 'Produtos',
      itemLabel: 'Produto',
      min: 1,
      max: 6,
      fields: [
        text('name', 'Nome', 120),
        textarea('description', 'Descrição', 300),
        text('price', 'Preço', 40, 'R$ 99,90'),
        text('oldPrice', 'Preço anterior (riscado)', 40, 'Opcional'),
        image('imageSrc', 'imageAlt', 'Foto'),
        link('url', 'Link do produto'),
      ],
      createItem: (): EmailBuilderProduct => ({
        name: 'Novo produto',
        description: '',
        price: '',
        oldPrice: '',
        imageSrc: '',
        imageAlt: '',
        url: CAMPAIGN_LINK,
      }),
    },
  ],
  features: [
    text('heading', 'Título', 200),
    {
      kind: 'items',
      key: 'items',
      label: 'Itens',
      itemLabel: 'Item',
      min: 1,
      max: 6,
      fields: [text('title', 'Título', 120), textarea('text', 'Texto', 300)],
      createItem: (): EmailBuilderFeature => ({ title: 'Novo item', text: '' }),
    },
  ],
  event: [
    text('heading', 'Título', 200),
    text('date', 'Data', 80),
    text('time', 'Horário', 80),
    text('location', 'Local', 200),
    text('buttonLabel', 'Texto do botão', 60, 'Vazio = sem botão'),
    link('buttonUrl', 'Link do botão'),
  ],
  nps: [
    text('question', 'Pergunta', 200),
    text('lowLabel', 'Rótulo do 0', 60),
    text('highLabel', 'Rótulo do 10', 60),
    link('url', 'Link da resposta (recebe ?nota=0…10)'),
  ],
  quote: [
    textarea('text', 'Depoimento', 500),
    text('author', 'Autor', 120),
    text('role', 'Cargo / empresa', 120),
  ],
  coupon: [
    text('label', 'Chamada', 120),
    text('code', 'Código', 40),
    text('expiry', 'Validade', 120),
  ],
  signature: [
    text('closing', 'Despedida', 80),
    text('name', 'Nome', 120),
    text('role', 'Cargo', 120),
    text('contact', 'Contato', 200),
  ],
  footer: [textarea('note', 'Observação no rodapé', 300)],
}
