import type {
  EmailBuilderDocument,
  EmailBuilderFeature,
  EmailBuilderLayoutId,
  EmailBuilderProduct,
  EmailBuilderSection,
  EmailBuilderSectionType,
} from '@/src/schemas/crm-email-builder.schema'
import { CAMPAIGN_LINK } from './variables'

/**
 * Gallery of the visual e-mail builder. Each layout is a locked list of
 * sections: users edit content, hide the optional ones and reorder the
 * movable ones — never add, remove or retype a section.
 *
 * Layouts are our own code on top of React Email components, styled with
 * the type scale and colors of the official "Barebone" template of
 * react-email (github.com/resend/react-email, MIT, © Plus Five Five, Inc).
 */

export type LayoutSection = {
  section: EmailBuilderSection
  /** Short pt-BR name shown in the panel ("Destaque", "Rodapé"). */
  label: string
  /** Can be hidden. Header and footer never are (footer = unsubscribe). */
  optional: boolean
  /** Can swap places with other movable sections. */
  movable: boolean
}

export type EmailLayout = {
  id: EmailBuilderLayoutId
  label: string
  description: string
  category: 'Marketing' | 'Relacionamento' | 'Vendas' | 'Eventos'
  defaultSubject: string
  previewText: string
  sections: LayoutSection[]
}

/** pt-BR name of each section type (panel headings, aria labels). */
export const SECTION_TYPE_LABEL: Record<EmailBuilderSectionType, string> = {
  header: 'Cabeçalho',
  hero: 'Destaque',
  text: 'Texto',
  image: 'Imagem',
  button: 'Botão',
  products: 'Produtos',
  features: 'Lista',
  event: 'Evento',
  nps: 'Pesquisa NPS',
  quote: 'Depoimento',
  coupon: 'Cupom',
  signature: 'Assinatura',
  footer: 'Rodapé',
}

const header = (): LayoutSection => ({
  section: { id: 'header', type: 'header', hidden: false, props: {} },
  label: 'Cabeçalho',
  optional: false,
  movable: false,
})

const footer = (note = ''): LayoutSection => ({
  section: { id: 'footer', type: 'footer', hidden: false, props: { note } },
  label: 'Rodapé',
  optional: false,
  movable: false,
})

const product = (
  name: string,
  description: string,
  price: string,
  oldPrice = '',
): EmailBuilderProduct => ({
  name,
  description,
  price,
  oldPrice,
  imageSrc: '',
  imageAlt: name,
  url: CAMPAIGN_LINK,
})

const feature = (title: string, text: string): EmailBuilderFeature => ({
  title,
  text,
})

export const EMAIL_LAYOUTS: Record<EmailBuilderLayoutId, EmailLayout> = {
  newsletter: {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Destaque com imagem, texto, lista de novidades e botão.',
    category: 'Marketing',
    defaultSubject: '{{primeiro_nome|Olá}}, as novidades do mês chegaram',
    previewText: 'Um resumo rápido do que aconteceu por aqui.',
    sections: [
      header(),
      {
        section: {
          id: 'hero',
          type: 'hero',
          hidden: false,
          props: {
            eyebrow: 'Newsletter',
            heading: 'Novidades deste mês',
            body: '<p>Olá, {{primeiro_nome|tudo bem}}! Reunimos as principais novidades para você ficar por dentro.</p>',
            imageSrc: '',
            imageAlt: '',
            buttonLabel: 'Ler a edição completa',
            buttonUrl: CAMPAIGN_LINK,
          },
        },
        label: 'Destaque',
        optional: false,
        movable: true,
      },
      {
        section: {
          id: 'intro',
          type: 'text',
          hidden: false,
          props: {
            heading: 'O que mudou',
            body: '<p>Conte aqui a história principal da edição. Use <strong>negrito</strong> para destacar o que importa.</p>',
          },
        },
        label: 'Texto',
        optional: true,
        movable: true,
      },
      {
        section: {
          id: 'highlights',
          type: 'features',
          hidden: false,
          props: {
            heading: 'Destaques',
            items: [
              feature(
                'Lançamento',
                'Uma frase sobre a novidade mais importante.',
              ),
              feature('Dica do mês', 'Um conselho prático para quem lê.'),
              feature('Agenda', 'O próximo evento ou data importante.'),
            ],
          },
        },
        label: 'Destaques',
        optional: true,
        movable: true,
      },
      {
        section: {
          id: 'image',
          type: 'image',
          hidden: true,
          props: { imageSrc: '', imageAlt: '', linkUrl: '', caption: '' },
        },
        label: 'Imagem',
        optional: true,
        movable: true,
      },
      {
        section: {
          id: 'cta',
          type: 'button',
          hidden: false,
          props: {
            label: 'Ver todas as novidades',
            url: CAMPAIGN_LINK,
            note: '',
          },
        },
        label: 'Botão',
        optional: true,
        movable: true,
      },
      footer(),
    ],
  },

  promocao: {
    id: 'promocao',
    label: 'Promoção / oferta',
    description: 'Oferta em destaque, cupom de desconto e vitrine de produtos.',
    category: 'Vendas',
    defaultSubject: '{{primeiro_nome|Oi}}, separamos uma oferta para você',
    previewText: 'Desconto por tempo limitado — aproveite.',
    sections: [
      header(),
      {
        section: {
          id: 'hero',
          type: 'hero',
          hidden: false,
          props: {
            eyebrow: 'Oferta especial',
            heading: 'Até 30% de desconto nesta semana',
            body: '<p>Aproveite condições exclusivas para clientes como você. A oferta vale até domingo.</p>',
            imageSrc: '',
            imageAlt: '',
            buttonLabel: 'Aproveitar a oferta',
            buttonUrl: CAMPAIGN_LINK,
          },
        },
        label: 'Destaque',
        optional: false,
        movable: true,
      },
      {
        section: {
          id: 'coupon',
          type: 'coupon',
          hidden: false,
          props: {
            label: 'Use o cupom no checkout',
            code: 'OFERTA30',
            expiry: 'Válido até domingo',
          },
        },
        label: 'Cupom',
        optional: true,
        movable: true,
      },
      {
        section: {
          id: 'products',
          type: 'products',
          hidden: false,
          props: {
            heading: 'Mais procurados',
            buttonLabel: 'Comprar',
            items: [
              product(
                'Plano Essencial',
                'Tudo o que você precisa para começar.',
                'R$ 69,90',
                'R$ 99,90',
              ),
              product(
                'Plano Profissional',
                'Para equipes que querem crescer.',
                'R$ 139,90',
                'R$ 199,90',
              ),
            ],
          },
        },
        label: 'Produtos',
        optional: false,
        movable: true,
      },
      {
        section: {
          id: 'cta',
          type: 'button',
          hidden: false,
          props: {
            label: 'Ver todas as ofertas',
            url: CAMPAIGN_LINK,
            note: 'Oferta sujeita à disponibilidade.',
          },
        },
        label: 'Botão',
        optional: true,
        movable: true,
      },
      footer(),
    ],
  },

  'convite-evento': {
    id: 'convite-evento',
    label: 'Convite para evento',
    description: 'Chamada do evento com data, horário, local e confirmação.',
    category: 'Eventos',
    defaultSubject: '{{primeiro_nome|Olá}}, você está convidado',
    previewText: 'Reserve a data — as vagas são limitadas.',
    sections: [
      header(),
      {
        section: {
          id: 'hero',
          type: 'hero',
          hidden: false,
          props: {
            eyebrow: 'Convite',
            heading: 'Encontro de clientes 2026',
            body: '<p>Uma tarde de conversas, cases e novidades. Queremos muito a sua presença.</p>',
            imageSrc: '',
            imageAlt: '',
            buttonLabel: '',
            buttonUrl: '',
          },
        },
        label: 'Destaque',
        optional: false,
        movable: false,
      },
      {
        section: {
          id: 'event',
          type: 'event',
          hidden: false,
          props: {
            heading: 'Quando e onde',
            date: '12 de novembro de 2026',
            time: '14h às 18h',
            location: 'Av. Paulista, 1000 — São Paulo, SP',
            buttonLabel: 'Confirmar presença',
            buttonUrl: CAMPAIGN_LINK,
          },
        },
        label: 'Evento',
        optional: false,
        movable: true,
      },
      {
        section: {
          id: 'agenda',
          type: 'text',
          hidden: false,
          props: {
            heading: 'Programação',
            body: '<ul><li>14h — Abertura</li><li>15h — Painel com clientes</li><li>17h — Networking</li></ul>',
          },
        },
        label: 'Programação',
        optional: true,
        movable: true,
      },
      footer(),
    ],
  },

  'boas-vindas': {
    id: 'boas-vindas',
    label: 'Boas-vindas',
    description: 'Recepção calorosa com próximos passos e assinatura.',
    category: 'Relacionamento',
    defaultSubject: 'Boas-vindas! Que bom ter você com a gente',
    previewText: 'Que bom ter você com a gente. Veja por onde começar.',
    sections: [
      header(),
      {
        section: {
          id: 'hero',
          type: 'hero',
          hidden: false,
          props: {
            eyebrow: '',
            heading: '{{primeiro_nome|Olá}}, que bom ter você aqui!',
            body: '<p>Preparamos alguns passos para você aproveitar ao máximo desde o primeiro dia.</p>',
            imageSrc: '',
            imageAlt: '',
            buttonLabel: '',
            buttonUrl: '',
          },
        },
        label: 'Destaque',
        optional: false,
        movable: false,
      },
      {
        section: {
          id: 'steps',
          type: 'features',
          hidden: false,
          props: {
            heading: 'Próximos passos',
            items: [
              feature('Complete o seu cadastro', 'Leva menos de dois minutos.'),
              feature(
                'Conheça a equipe',
                'Seu contato direto para qualquer dúvida.',
              ),
              feature('Dê o primeiro passo', 'Comece pelo recurso mais usado.'),
            ],
          },
        },
        label: 'Próximos passos',
        optional: false,
        movable: true,
      },
      {
        section: {
          id: 'cta',
          type: 'button',
          hidden: false,
          props: { label: 'Começar agora', url: CAMPAIGN_LINK, note: '' },
        },
        label: 'Botão',
        optional: false,
        movable: true,
      },
      {
        section: {
          id: 'signature',
          type: 'signature',
          hidden: false,
          props: {
            closing: 'Um abraço,',
            name: 'Equipe de sucesso do cliente',
            role: '',
            contact: '',
          },
        },
        label: 'Assinatura',
        optional: true,
        movable: false,
      },
      footer(),
    ],
  },

  'follow-up-proposta': {
    id: 'follow-up-proposta',
    label: 'Follow-up de proposta',
    description: 'E-mail pessoal e direto para retomar uma proposta.',
    category: 'Vendas',
    defaultSubject: 'Sobre a proposta para a {{empresa|sua empresa}}',
    previewText: 'Ficou alguma dúvida? Estou à disposição.',
    sections: [
      header(),
      {
        section: {
          id: 'message',
          type: 'text',
          hidden: false,
          props: {
            heading: '',
            body: '<p>Olá, {{primeiro_nome|tudo bem}}?</p><p>Passando para saber se você conseguiu analisar a proposta que enviamos para a {{empresa|sua empresa}}. Posso ajustar o escopo, o prazo ou as condições de pagamento se for preciso.</p><p>Que tal uma conversa rápida esta semana?</p>',
          },
        },
        label: 'Mensagem',
        optional: false,
        movable: false,
      },
      {
        section: {
          id: 'cta',
          type: 'button',
          hidden: false,
          props: { label: 'Ver a proposta', url: CAMPAIGN_LINK, note: '' },
        },
        label: 'Botão',
        optional: true,
        movable: false,
      },
      {
        section: {
          id: 'signature',
          type: 'signature',
          hidden: false,
          props: {
            closing: 'Obrigado,',
            name: 'Seu nome',
            role: 'Executivo de contas',
            contact: '(11) 4000-0000',
          },
        },
        label: 'Assinatura',
        optional: false,
        movable: false,
      },
      footer(),
    ],
  },

  'pesquisa-nps': {
    id: 'pesquisa-nps',
    label: 'Pesquisa NPS',
    description:
      'Pergunta de 0 a 10 com um clique, ideal para medir satisfação.',
    category: 'Relacionamento',
    defaultSubject: '{{primeiro_nome|Olá}}, você tem 10 segundos?',
    previewText: 'Uma pergunta só — sua opinião faz diferença.',
    sections: [
      header(),
      {
        section: {
          id: 'intro',
          type: 'text',
          hidden: false,
          props: {
            heading: 'Sua opinião importa',
            body: '<p>Olá, {{primeiro_nome|tudo bem}}! Queremos melhorar a cada dia e a sua resposta ajuda muito.</p>',
          },
        },
        label: 'Texto',
        optional: false,
        movable: false,
      },
      {
        section: {
          id: 'nps',
          type: 'nps',
          hidden: false,
          props: {
            question:
              'De 0 a 10, quanto você recomendaria a nossa empresa a um amigo?',
            lowLabel: 'Nada provável',
            highLabel: 'Muito provável',
            url: CAMPAIGN_LINK,
          },
        },
        label: 'Pesquisa NPS',
        optional: false,
        movable: false,
      },
      footer('Leva menos de 10 segundos e é anônimo para a equipe.'),
    ],
  },

  'anuncio-produto': {
    id: 'anuncio-produto',
    label: 'Anúncio de produto',
    description: 'Lançamento com imagem, recursos, depoimento e botão.',
    category: 'Marketing',
    defaultSubject: 'Lançamento: conheça o nosso novo produto',
    previewText: 'Chegou o que você estava esperando.',
    sections: [
      header(),
      {
        section: {
          id: 'hero',
          type: 'hero',
          hidden: false,
          props: {
            eyebrow: 'Lançamento',
            heading: 'Apresentamos o novo produto',
            body: '<p>Mais rápido, mais simples e feito a partir do que nossos clientes pediram.</p>',
            imageSrc: '',
            imageAlt: '',
            buttonLabel: 'Conhecer agora',
            buttonUrl: CAMPAIGN_LINK,
          },
        },
        label: 'Destaque',
        optional: false,
        movable: false,
      },
      {
        section: {
          id: 'details',
          type: 'text',
          hidden: false,
          props: {
            heading: 'Por que ele é diferente',
            body: '<p>Explique em poucas linhas o problema que o produto resolve.</p>',
          },
        },
        label: 'Texto',
        optional: true,
        movable: true,
      },
      {
        section: {
          id: 'features',
          type: 'features',
          hidden: false,
          props: {
            heading: 'Recursos',
            items: [
              feature(
                'Configuração em minutos',
                'Sem instalação e sem treinamento.',
              ),
              feature(
                'Integrações',
                'Conecta com as ferramentas que você já usa.',
              ),
              feature('Suporte dedicado', 'Gente de verdade para ajudar.'),
            ],
          },
        },
        label: 'Recursos',
        optional: true,
        movable: true,
      },
      {
        section: {
          id: 'quote',
          type: 'quote',
          hidden: false,
          props: {
            text: 'Reduzimos pela metade o tempo de atendimento na primeira semana.',
            author: 'Ana Souza',
            role: 'Diretora de operações',
          },
        },
        label: 'Depoimento',
        optional: true,
        movable: true,
      },
      {
        section: {
          id: 'cta',
          type: 'button',
          hidden: false,
          props: { label: 'Quero conhecer', url: CAMPAIGN_LINK, note: '' },
        },
        label: 'Botão',
        optional: false,
        movable: true,
      },
      footer(),
    ],
  },

  lembrete: {
    id: 'lembrete',
    label: 'Lembrete',
    description: 'Aviso curto com data, horário e um botão de ação.',
    category: 'Eventos',
    defaultSubject: '{{primeiro_nome|Olá}}, lembrete do nosso compromisso',
    previewText: 'Só passando para lembrar do nosso compromisso.',
    sections: [
      header(),
      {
        section: {
          id: 'message',
          type: 'text',
          hidden: false,
          props: {
            heading: 'Não esqueça!',
            body: '<p>Olá, {{primeiro_nome|tudo bem}}! Este é um lembrete do nosso compromisso.</p>',
          },
        },
        label: 'Mensagem',
        optional: false,
        movable: false,
      },
      {
        section: {
          id: 'event',
          type: 'event',
          hidden: false,
          props: {
            heading: 'Detalhes',
            date: 'Amanhã, 10 de outubro',
            time: '10h',
            location: 'Online — o link segue abaixo',
            buttonLabel: '',
            buttonUrl: '',
          },
        },
        label: 'Detalhes',
        optional: false,
        movable: true,
      },
      {
        section: {
          id: 'cta',
          type: 'button',
          hidden: false,
          props: {
            label: 'Acessar',
            url: CAMPAIGN_LINK,
            note: 'Precisa remarcar? Responda a este e-mail.',
          },
        },
        label: 'Botão',
        optional: true,
        movable: true,
      },
      footer(),
    ],
  },
}

export const EMAIL_LAYOUT_LIST: readonly EmailLayout[] =
  Object.values(EMAIL_LAYOUTS)

/** A fresh document with the layout's default content. */
export function createBuilderDocument(
  layoutId: EmailBuilderLayoutId,
): EmailBuilderDocument {
  const layout = EMAIL_LAYOUTS[layoutId]
  return {
    version: 1,
    layout: layoutId,
    previewText: layout.previewText,
    sections: layout.sections.map((entry) => structuredClone(entry.section)),
  }
}

export function getLayoutSection(
  layoutId: EmailBuilderLayoutId,
  sectionId: string,
): LayoutSection | undefined {
  return EMAIL_LAYOUTS[layoutId].sections.find(
    (entry) => entry.section.id === sectionId,
  )
}

/**
 * Checks a document against its layout's locked structure. Returns `null`
 * when valid, or a pt-BR message describing the first violation.
 */
export function validateLayoutStructure(
  document: EmailBuilderDocument,
): string | null {
  const layout = EMAIL_LAYOUTS[document.layout]
  const expected = layout.sections
  if (document.sections.length !== expected.length) {
    return 'As seções do modelo não podem ser adicionadas nem removidas'
  }

  const seen = new Set<string>()
  for (const [index, section] of document.sections.entries()) {
    const entry = expected.find((e) => e.section.id === section.id)
    if (!entry || seen.has(section.id)) {
      return 'As seções do modelo não podem ser adicionadas nem removidas'
    }
    seen.add(section.id)
    if (entry.section.type !== section.type) {
      return `A seção "${entry.label}" não pode mudar de tipo`
    }
    if (section.hidden && !entry.optional) {
      return `A seção "${entry.label}" não pode ser ocultada`
    }
    const slot = expected[index]
    if ((!slot.movable || !entry.movable) && slot.section.id !== section.id) {
      return `A seção "${entry.label}" não pode mudar de posição`
    }
  }
  return null
}

/** Whether a section can swap with its neighbour (reorder controls). */
export function canMoveSection(
  document: EmailBuilderDocument,
  sectionId: string,
  direction: -1 | 1,
): boolean {
  const index = document.sections.findIndex((s) => s.id === sectionId)
  const target = index + direction
  if (index === -1 || target < 0 || target >= document.sections.length) {
    return false
  }
  const layout = EMAIL_LAYOUTS[document.layout]
  const slots = layout.sections
  const current = getLayoutSection(document.layout, sectionId)
  const other = getLayoutSection(document.layout, document.sections[target].id)
  return Boolean(
    current?.movable &&
      other?.movable &&
      slots[index].movable &&
      slots[target].movable,
  )
}

export function moveSection(
  document: EmailBuilderDocument,
  sectionId: string,
  direction: -1 | 1,
): EmailBuilderDocument {
  if (!canMoveSection(document, sectionId, direction)) return document
  const index = document.sections.findIndex((s) => s.id === sectionId)
  const sections = [...document.sections]
  const [moved] = sections.splice(index, 1)
  sections.splice(index + direction, 0, moved)
  return { ...document, sections }
}
