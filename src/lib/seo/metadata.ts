import type { Metadata } from 'next'

interface PublicPageMetadata {
  title: string
  description: string
  /** Path of the canonical url, e.g. `/status`. */
  path: string
}

/**
 * Metadata of an indexable public page: canonical url plus Open Graph and
 * Twitter cards on the site-wide generated image. `metadataBase` (root
 * layout) turns the relative paths into absolute urls.
 */
export function publicPageMetadata({
  title,
  description,
  path,
}: PublicPageMetadata): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/twitter-image'],
    },
  }
}

/** Token, auth-flow and per-customer pages: never in a search index. */
export const NO_INDEX: Metadata['robots'] = { index: false, follow: false }
