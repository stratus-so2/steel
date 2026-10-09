import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import {
  getAdjacentDocs,
  getAllDocsMeta,
  getDocByPath,
} from '@/src/lib/docs/pages'
import { docsSectionLabel } from '@/src/lib/docs/sections'
import { SITE_URL } from '@/src/lib/seo/site'
import { DocsMdx } from '../_components/docs-mdx'
import { DocsPager } from '../_components/docs-pager'
import { DocsToc } from '../_components/docs-toc'

interface Props {
  params: Promise<{ slug: string[] }>
}

export async function generateStaticParams() {
  const pages = await getAllDocsMeta()
  return pages.map((page) => ({
    slug: page.href.replace(/^\/docs\//, '').split('/'),
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getDocByPath(slug)
  if (!page) return { title: 'Página não encontrada | Steel' }

  const title = `${page.title} | Documentação Steel`
  return {
    title,
    description: page.description,
    alternates: { canonical: page.href },
    openGraph: {
      type: 'article',
      url: page.href,
      title,
      description: page.description,
      section: docsSectionLabel(page.section),
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: page.description,
      images: ['/twitter-image'],
    },
  }
}

export default async function DocsArticlePage({ params }: Props) {
  const { slug } = await params
  const page = await getDocByPath(slug)
  if (!page) notFound()

  const { prev, next } = await getAdjacentDocs(page.href)
  const sectionLabel = docsSectionLabel(page.section)
  const pageUrl = `${SITE_URL}${page.href}`
  const sectionHref = `/docs/${page.section}`

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.title,
    description: page.description,
    articleSection: sectionLabel,
    inLanguage: 'pt-BR',
    url: pageUrl,
    author: { '@type': 'Organization', name: 'Stratus Telecom' },
    publisher: {
      '@type': 'Organization',
      name: 'Steel',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/logo.png` },
    },
    about: { '@type': 'SoftwareApplication', name: 'Steel' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
  }

  const crumbs = [
    { name: 'Documentação', item: `${SITE_URL}/docs` },
    { name: sectionLabel, item: `${SITE_URL}${sectionHref}` },
    ...(page.slug === 'index' ? [] : [{ name: page.title, item: pageUrl }]),
  ]
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      ...crumb,
    })),
  }

  return (
    <div className='flex w-full gap-10 py-10 lg:py-16 lg:pr-8'>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      <main className='flex min-w-0 max-w-3xl flex-1 flex-col gap-10'>
        <header className='flex flex-col gap-3'>
          <nav aria-label='Trilha' className='text-sm text-muted-foreground'>
            <Link href='/docs' className='hover:text-primary'>
              Documentação
            </Link>
            {' / '}
            <Link href={sectionHref} className='hover:text-primary'>
              {sectionLabel}
            </Link>
          </nav>
          <h1 className='text-3xl font-normal sm:text-4xl'>{page.title}</h1>
          <p className='text-lg text-muted-foreground'>{page.description}</p>
          {page.headings.length > 0 && (
            <details className='rounded-md border border-border p-3 xl:hidden'>
              <summary className='cursor-pointer text-sm font-medium'>
                Nesta página
              </summary>
              <div className='mt-3'>
                <DocsToc headings={page.headings} showTitle={false} />
              </div>
            </details>
          )}
        </header>
        <article className='min-w-0'>
          <DocsMdx source={page.source} />
        </article>
        <DocsPager prev={prev} next={next} />
      </main>
      <aside className='sticky top-8 hidden h-fit w-56 shrink-0 xl:block'>
        <DocsToc headings={page.headings} />
      </aside>
    </div>
  )
}
