import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findProductPage, PRODUCT_PAGES } from '@/src/config/web-product-pages'
import { productPageMetadata } from '@/src/lib/seo/product'
import { ProductPageView } from '../../_components/product/product-page-view'

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return PRODUCT_PAGES.filter((page) => page.kind === 'product').map(
    (page) => ({ slug: page.slug }),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = findProductPage('product', slug)
  return page ? productPageMetadata(page) : { title: 'Página não encontrada' }
}

export default async function ProductModulePage({ params }: Props) {
  const { slug } = await params
  const page = findProductPage('product', slug)
  if (!page) notFound()
  return <ProductPageView page={page} />
}
