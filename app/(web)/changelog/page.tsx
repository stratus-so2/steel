import { ArrowRight02Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { JsonLd } from '@/components/seo/json-ld'
import { Muted } from '@/components/typography/text/muted'
import { getAllEntriesMeta } from '@/src/lib/changelog/entries'
import {
  CHANGELOG_TAG_LABELS,
  formatChangelogDate,
} from '@/src/lib/changelog/labels'
import { SITE_URL } from '@/src/lib/seo/site'
import { WebFooter } from '../_components/footer'
import { SubTitle } from '../_components/text/sub-title'
import { Title } from '../_components/text/title'

const TITLE = 'Changelog | Steel'
const DESCRIPTION =
  'O que mudou no Steel: novidades do ServiceDesk, do CRM, da Comunicação e da Steel AI, release a release.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/changelog',
    types: { 'application/rss+xml': '/changelog/rss.xml' },
  },
  openGraph: {
    type: 'website',
    url: '/changelog',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/twitter-image'],
  },
}

export default async function ChangelogPage() {
  const entries = await getAllEntriesMeta()

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/changelog`,
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: entries.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}/changelog/${entry.slug}`,
        name: entry.title,
      })),
    },
  }

  return (
    <>
      <main className='w-full flex flex-col items-center flex-1 mx-auto'>
        <JsonLd data={collectionSchema} />
        <div className='mx-auto w-full px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384 py-16 space-y-16'>
          <div className='space-y-4 text-center'>
            <Title>Changelog</Title>
            <SubTitle>
              Tudo o que entrou no Steel, do mais recente ao mais antigo.
            </SubTitle>
          </div>

          {entries.length === 0 ? (
            <Muted className='text-center'>
              Nenhuma novidade publicada ainda.
            </Muted>
          ) : (
            <ol className='mx-auto w-full max-w-4xl'>
              {entries.map((entry) => (
                <li
                  key={entry.slug}
                  className='grid grid-cols-1 gap-3 border-t border-border py-10 md:grid-cols-[200px_1fr] md:gap-10'
                >
                  <div className='space-y-1'>
                    <time
                      dateTime={entry.date}
                      className='text-sm font-medium text-primary'
                    >
                      {formatChangelogDate(entry.date)}
                    </time>
                    {entry.version && (
                      <Muted className='font-mono text-xs'>
                        v{entry.version}
                      </Muted>
                    )}
                  </div>
                  <article className='space-y-4'>
                    <div className='flex flex-wrap gap-2'>
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className='rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground'
                        >
                          {CHANGELOG_TAG_LABELS[tag]}
                        </span>
                      ))}
                    </div>
                    <h2 className='text-2xl font-normal'>
                      <Link
                        href={`/changelog/${entry.slug}`}
                        className='hover:underline underline-offset-4'
                      >
                        {entry.title}
                      </Link>
                    </h2>
                    <p className='text-base text-muted-foreground'>
                      {entry.summary}
                    </p>
                    <Link
                      href={`/changelog/${entry.slug}`}
                      className='inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4'
                    >
                      Ler a novidade
                      <SteelIcon icon={ArrowRight02Icon} size={16} />
                    </Link>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>
      <WebFooter showBanner={false} />
    </>
  )
}
