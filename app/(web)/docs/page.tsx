import { ApiIcon, ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { JsonLd } from '@/components/seo/json-ld'
import { getDocsNav } from '@/src/lib/docs/pages'
import { publicPageMetadata } from '@/src/lib/seo/metadata'
import { SITE_URL } from '@/src/lib/seo/site'

const TITLE = 'Documentação | Steel'
const DESCRIPTION =
  'Manual do Steel: como usar o ServiceDesk, o CRM, a Comunicação por WhatsApp e a Steel AI, do primeiro acesso aos ajustes do workspace.'

export const metadata: Metadata = publicPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/docs',
})

export default async function DocsIndexPage() {
  const nav = await getDocsNav()

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/docs`,
    inLanguage: 'pt-BR',
    about: { '@type': 'SoftwareApplication', name: 'Steel' },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: nav
        .flatMap((section) => section.pages)
        .map((page, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${SITE_URL}${page.href}`,
          name: page.title,
        })),
    },
  }

  return (
    <main className='flex flex-col gap-12 py-10 lg:py-16 lg:pr-8'>
      <JsonLd data={collectionSchema} />
      <header className='flex max-w-3xl flex-col gap-4'>
        <span className='text-sm text-muted-foreground'>Documentação</span>
        <h1 className='text-4xl font-normal sm:text-5xl'>Manual do Steel</h1>
        <p className='text-lg text-muted-foreground'>
          Tudo o que você precisa para usar o Steel no dia a dia: criar o
          workspace, convidar a equipe, atender chamados no ServiceDesk, vender
          com o CRM, conversar pelo WhatsApp e trabalhar com a Steel AI.
        </p>
      </header>

      <section
        aria-label='Seções do manual'
        className='grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3'
      >
        {nav.map((section) => (
          <div
            key={section.slug}
            className='flex flex-col gap-4 rounded-xl border border-border p-5'
          >
            <div className='flex flex-col gap-1'>
              <h2 className='text-lg font-medium'>
                <Link href={section.pages[0].href} className='hover:underline'>
                  {section.label}
                </Link>
              </h2>
              <p className='text-sm text-muted-foreground'>
                {section.description}
              </p>
            </div>
            <ul className='flex flex-col gap-1.5 text-sm'>
              {section.pages.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className='text-muted-foreground transition-colors hover:text-primary'
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside className='flex flex-col gap-3 rounded-xl border border-border p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex gap-3'>
          <SteelIcon icon={ApiIcon} size={22} className='mt-0.5 shrink-0' />
          <div className='flex flex-col gap-1'>
            <h2 className='text-base font-medium'>Para desenvolvedores</h2>
            <p className='text-sm text-muted-foreground'>
              Vai integrar outro sistema ao Steel? A API e a referência ficam no
              site de desenvolvedores.
            </p>
          </div>
        </div>
        <Link
          href='/dev'
          className='flex shrink-0 items-center gap-1 text-sm font-medium hover:underline'
        >
          Documentação técnica
          <SteelIcon icon={ArrowRight01Icon} size={16} />
        </Link>
      </aside>
    </main>
  )
}
