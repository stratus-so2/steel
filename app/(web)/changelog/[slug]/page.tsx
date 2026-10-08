import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { Muted } from '@/components/typography/text/muted'
import { getAllEntriesMeta, getEntryBySlug } from '@/src/lib/changelog/entries'
import {
  CHANGELOG_TAG_LABELS,
  formatChangelogDate,
} from '@/src/lib/changelog/labels'
import { SITE_URL } from '@/src/lib/seo/site'
import { WebFooter } from '../../_components/footer'
import { ChangelogMdx } from './changelog-mdx'
import { CopyMarkdownButton } from './copy-markdown-button'
import { TableOfContents } from './table-of-contents'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const entries = await getAllEntriesMeta()
  return entries.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const entry = await getEntryBySlug(slug)
  if (!entry) return { title: 'Novidade não encontrada | Steel' }

  const title = `${entry.title} | Changelog Steel`
  const image = entry.cover ?? '/opengraph-image'

  return {
    title,
    description: entry.summary,
    alternates: { canonical: `/changelog/${entry.slug}` },
    openGraph: {
      type: 'article',
      url: `/changelog/${entry.slug}`,
      title,
      description: entry.summary,
      publishedTime: entry.date,
      tags: entry.tags.map((tag) => CHANGELOG_TAG_LABELS[tag]),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: entry.summary,
      images: [entry.cover ?? '/twitter-image'],
    },
  }
}

export default async function ChangelogEntryPage({ params }: Props) {
  const { slug } = await params
  const entry = await getEntryBySlug(slug)
  if (!entry) notFound()

  const entryUrl = `${SITE_URL}/changelog/${entry.slug}`
  const entryImage = entry.cover
    ? new URL(entry.cover, SITE_URL).toString()
    : `${SITE_URL}/opengraph-image`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: entry.title,
    description: entry.summary,
    image: [entryImage],
    datePublished: entry.date,
    dateModified: entry.date,
    inLanguage: 'pt-BR',
    keywords: entry.tags.map((tag) => CHANGELOG_TAG_LABELS[tag]).join(', '),
    author: { '@type': 'Organization', name: 'Stratus Telecom' },
    publisher: {
      '@type': 'Organization',
      name: 'Steel',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/brand/logo.png`,
      },
    },
    about: { '@type': 'SoftwareApplication', name: 'Steel' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': entryUrl },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Changelog',
        item: `${SITE_URL}/changelog`,
      },
      { '@type': 'ListItem', position: 2, name: entry.title, item: entryUrl },
    ],
  }

  return (
    <>
      <main className='mx-auto w-full flex flex-col px-4 py-3 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384 gap-10'>
        <JsonLd data={articleSchema} />
        <JsonLd data={breadcrumbSchema} />
        <div className='w-full flex flex-col gap-10 xl:max-w-[80%] mx-auto py-16'>
          <div className='w-full flex flex-col gap-4 pb-2'>
            <Muted>
              <Link href='/changelog' className='text-muted-foreground'>
                Changelog /
              </Link>{' '}
              {entry.tags.map((tag) => CHANGELOG_TAG_LABELS[tag]).join(' · ')}
            </Muted>
            <div className='space-y-4'>
              <h1 className='text-4xl font-normal'>{entry.title}</h1>
              <Muted className='text-lg font-normal'>{entry.summary}</Muted>
              <Muted className='font-light'>
                <time dateTime={entry.date}>
                  {formatChangelogDate(entry.date)}
                </time>
                {entry.version && (
                  <span className='font-mono'> · v{entry.version}</span>
                )}
              </Muted>
            </div>
          </div>
          <div className='w-full flex flex-col gap-8 lg:flex-row lg:justify-between'>
            <aside className='space-y-6 w-full lg:sticky top-24 h-fit lg:w-80 shrink-0 lg:pr-8'>
              <CopyMarkdownButton
                markdown={`# ${entry.title}\n\n${entry.source}`}
              />
              <TableOfContents headings={entry.headings} />
            </aside>
            <article className='min-w-0 flex-1'>
              <ChangelogMdx source={entry.source} />
            </article>
          </div>
        </div>
      </main>
      <WebFooter showBanner={false} />
    </>
  )
}
