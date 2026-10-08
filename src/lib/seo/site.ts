import { NEXT_PUBLIC_URL } from '@/lib/env/env'

/**
 * Absolute origin for canonical urls, sitemaps and structured data. Builds
 * that skip env validation (CI) have no NEXT_PUBLIC_URL, and
 * `new URL(undefined)` in the root layout's metadataBase would fail the
 * build; the image build always passes the real one (Dockerfile build-arg).
 */
export const SITE_URL = NEXT_PUBLIC_URL || 'http://localhost:3001'

export const SITE_NAME = 'Steel'
export const SITE_TITLE = 'Steel — ServiceDesk, CRM e WhatsApp num só workspace'
export const SITE_DESCRIPTION =
  'O Steel reúne ServiceDesk ITIL 4, CRM e atendimento por WhatsApp Business num só workspace, com a Steel AI trabalhando nos três módulos.'

export const PUBLISHER = {
  name: 'Stratus Telecom',
  url: 'https://stratustelecom.com.br',
} as const

/**
 * Site-wide structured data (schema.org) for search and answer engines:
 * who publishes Steel, what the product is and the site itself. `sameAs` is
 * left out until real social profiles exist.
 */
export function siteJsonLd() {
  const organizationId = `${SITE_URL}/#organization`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/brand/logo.png`,
        parentOrganization: {
          '@type': 'Organization',
          name: PUBLISHER.name,
          url: PUBLISHER.url,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: 'pt-BR',
        publisher: { '@id': organizationId },
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'pt-BR',
        publisher: { '@id': organizationId },
        featureList: [
          'ServiceDesk ITIL 4: incidentes, requisições, mudanças e problemas',
          'SLA e OLA sobre calendários úteis',
          'CMDB e base de conhecimento',
          'Portal do solicitante',
          'CRM: leads, funis, oportunidades, propostas e previsão de vendas',
          'Campanhas de e-mail, landing pages e formulários',
          'WhatsApp Business: caixa de entrada, disparos e templates',
          'Steel AI: assistente com confirmação antes de agir',
        ],
      },
    ],
  }
}
