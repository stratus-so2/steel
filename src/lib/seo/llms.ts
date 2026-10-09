import { CHANGELOG_TAG_LABELS } from '@/src/lib/changelog/labels'
import type { DocsPage, DocsPageMeta } from '@/src/lib/docs/pages'
import { docsSectionLabel } from '@/src/lib/docs/sections'
import { SITE_DESCRIPTION, SITE_URL } from '@/src/lib/seo/site'
import type {
  ChangelogEntryDTO,
  ChangelogEntryMetaDTO,
} from '@/types/changelog-entry'

const url = (path: string) => `${SITE_URL}${path}`

const PRODUCT_OVERVIEW = `## O que é o Steel

O Steel é a plataforma multi-tenant da Stratus Telecom que junta três módulos num só workspace, com a Steel AI trabalhando nos três:

- **ServiceDesk (ITIL 4):** incidentes, requisições de serviço, mudanças (com CAB) e problemas; matriz impacto × urgência; SLA e OLA sobre calendários úteis; catálogo de serviços; CMDB; base de conhecimento com KCS; portal do solicitante; aprovação por e-mail; painéis com modo TV; relatórios de SLA agendados.
- **CRM:** leads com pontuação e roteamento, pessoas, empresas, funis e oportunidades, propostas com modelos, produtos, previsão de vendas e metas, campanhas de e-mail, landing pages, formulários, workflows e redes sociais.
- **Comunicação (WhatsApp Business):** conexões pela Meta Cloud API ou Z-API, caixa de entrada em tempo real, contatos, grupos, templates, respostas rápidas, disparos em massa e resposta automática e análise de sentimento por IA.
- **Steel AI:** assistente com modos Ask (consulta), Build (propõe ações e pede confirmação) e Autopilot; Steel Agents que rodam por agenda, evento ou sob demanda; skills e memória. O provedor (OpenAI ou Anthropic) é escolhido por workspace.

Cada módulo é habilitado por workspace, e um workspace pode apontar um módulo para o próprio banco PostgreSQL. A plataforma segue a LGPD: consentimento de cookies, exportação de dados e trilha de auditoria.`

function changelogIndex(entries: ChangelogEntryMetaDTO[]): string {
  return entries
    .map(
      (entry) =>
        `- [${entry.title}](${url(`/changelog/${entry.slug}`)}) (${entry.date.slice(0, 10)}): ${entry.summary}`,
    )
    .join('\n')
}

function docsIndex(docs: DocsPageMeta[]): string {
  return docs
    .map(
      (page) =>
        `- [${docsSectionLabel(page.section)}: ${page.title}](${url(page.href)}): ${page.description}`,
    )
    .join('\n')
}

/** `/llms.txt` (llmstxt.org): a short markdown map for answer engines. */
export function buildLlmsTxt(
  entries: ChangelogEntryMetaDTO[],
  docs: DocsPageMeta[] = [],
): string {
  const manual =
    docs.length > 0
      ? `\n## Documentação (manual do usuário)\n\n${docsIndex(docs)}\n`
      : ''

  return `# Steel

> ${SITE_DESCRIPTION}

${PRODUCT_OVERVIEW}

## Páginas

- [Documentação](${url('/docs')}): manual de uso do Steel, módulo a módulo.
- [Para desenvolvedores](${url('/dev')}): integração com a API do Steel e a [referência da API](${url('/dev/api')}).
- [Sobre](${url('/about')}): por que o Steel existe e para quem ele é feito.
- [Manifesto](${url('/manifesto')}): os princípios de produto e engenharia do Steel.
- [Changelog](${url('/changelog')}): novidades, release a release ([RSS](${url('/changelog/rss.xml')})).
- [Planos e preços](${url('/pricing')}): planos por assento.
- [Fale com vendas](${url('/talk-to-sales')}): demonstração, preços e implantação.
- [Contato](${url('/contact')}): canais de vendas, suporte e outros assuntos.
- [Status](${url('/status')}): status em tempo real dos serviços e histórico de incidentes.
${manual}
## Changelog recente

${changelogIndex(entries.slice(0, 10))}

## Legal

- [Política de Privacidade](${url('/legals/privacy')})
- [Termos de Serviço](${url('/legals/terms')})
- [Segurança](${url('/legals/security')})
- [Subprocessadores](${url('/legals/subprocessors')})

## Opcional

- [Versão completa deste arquivo](${url('/llms-full.txt')}): inclui o texto integral do manual e de cada novidade do changelog.
`
}

/** `/llms-full.txt`: the overview, the whole manual and every changelog entry. */
export function buildLlmsFullTxt(
  entries: ChangelogEntryDTO[],
  docs: DocsPage[] = [],
): string {
  const manual = docs
    .map((page) => {
      // Page headings are demoted one level so they nest under the title.
      const body = page.source.replace(/^(#{2,5}) /gm, '#$1 ')
      return `## ${docsSectionLabel(page.section)}: ${page.title}

${url(page.href)}

> ${page.description}

${body}`
    })
    .join('\n\n---\n\n')
  const manualPart = manual ? `# Documentação\n\n${manual}\n\n` : ''

  const bodies = entries
    .map((entry) => {
      const tags = entry.tags.map((tag) => CHANGELOG_TAG_LABELS[tag]).join(', ')
      // Entry headings are demoted one level so they nest under the title.
      const body = entry.source.replace(/^(#{2,5}) /gm, '#$1 ')
      return `## ${entry.title}

Publicado em ${entry.date.slice(0, 10)} · ${tags} · ${url(`/changelog/${entry.slug}`)}

> ${entry.summary}

${body}`
    })
    .join('\n\n---\n\n')

  return `# Steel

> ${SITE_DESCRIPTION}

${PRODUCT_OVERVIEW}

${manualPart}# Changelog

${bodies}
`
}
