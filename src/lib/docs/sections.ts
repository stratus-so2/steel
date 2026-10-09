import type { DocsSectionSlug } from '@/src/schemas/docs-page.schema'

export interface DocsSection {
  slug: DocsSectionSlug
  label: string
  description: string
}

/** Labels and blurbs of the manual's sections, in reading order. */
export const DOCS_SECTIONS: readonly DocsSection[] = [
  {
    slug: 'comecando',
    label: 'Começando',
    description:
      'Crie a conta, monte o workspace, convide a equipe e ligue os módulos.',
  },
  {
    slug: 'workspace',
    label: 'Workspace',
    description:
      'Início, caixa de entrada, busca, atalhos, wiki, notificações e ajustes.',
  },
  {
    slug: 'servicedesk',
    label: 'ServiceDesk',
    description:
      'Chamados ITIL 4, SLA, catálogo, CMDB, base de conhecimento e portal.',
  },
  {
    slug: 'crm',
    label: 'CRM',
    description:
      'Leads, oportunidades, propostas, campanhas, formulários e automações.',
  },
  {
    slug: 'comunicacao',
    label: 'Comunicação',
    description:
      'WhatsApp Business: conexões, conversas, templates e transmissões.',
  },
  {
    slug: 'steel-ai',
    label: 'Steel AI',
    description:
      'Modos, modelos, skills, memória, Steel Agents e acompanhamento de uso.',
  },
  {
    slug: 'seguranca',
    label: 'Segurança e privacidade',
    description:
      'Verificação em duas etapas, LGPD, exportação de dados e exclusão.',
  },
  {
    slug: 'suporte',
    label: 'Status e suporte',
    description: 'Página de status, canais de atendimento e novidades.',
  },
  {
    slug: 'faq',
    label: 'Perguntas frequentes',
    description: 'Respostas rápidas para as dúvidas mais comuns.',
  },
]

const LABELS = Object.fromEntries(
  DOCS_SECTIONS.map((section) => [section.slug, section.label]),
) as Record<DocsSectionSlug, string>

export function docsSectionLabel(slug: DocsSectionSlug): string {
  return LABELS[slug]
}

export function docsSectionRank(slug: DocsSectionSlug): number {
  return DOCS_SECTIONS.findIndex((section) => section.slug === slug)
}
