import { JsonLd } from '@/components/seo/json-ld'
import { productPageJsonLd } from '@/src/lib/seo/product'
import type { ProductPage } from '@/src/schemas/web-product-page.schema'
import { ConnectedTabs } from './connected-tabs'
import {
  ProductAiBento,
  ProductClosingCta,
  ProductDetails,
  ProductHero,
  ProductHighlights,
  ProductInfraBand,
  ProductRows,
  ProductTrust,
  SectionHeading,
  WebContainer,
} from './sections'

/** Section order of each template, top to bottom. */
export const PRODUCT_TEMPLATE_SECTIONS = {
  object: [
    'hero',
    'highlights',
    'ai',
    'details',
    'connected',
    'infra',
    'trust',
    'cta',
  ],
  rhythm: [
    'hero',
    'highlights',
    'rows',
    'ai',
    'details',
    'connected',
    'infra',
    'trust',
    'cta',
  ],
} as const satisfies Record<ProductPage['template'], readonly string[]>

function ProductConnected({ page }: { page: ProductPage }) {
  const { connected } = page
  return (
    <section data-section='connected' className='bg-muted/40 py-20 sm:py-28'>
      <WebContainer className='space-y-14'>
        <div className='grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16'>
          <SectionHeading
            align='start'
            eyebrow={connected.eyebrow}
            title={connected.title}
          />
          <p className='text-base text-muted-foreground sm:text-lg'>
            {connected.subtitle}
          </p>
        </div>
        <ConnectedTabs items={connected.items} />
      </WebContainer>
    </section>
  )
}

const SECTIONS = {
  hero: ProductHero,
  highlights: ProductHighlights,
  rows: ProductRows,
  ai: ProductAiBento,
  details: ProductDetails,
  connected: ProductConnected,
  infra: ProductInfraBand,
  trust: ProductTrust,
  cta: ProductClosingCta,
} as const

/** A whole product or capability page, rendered from its content config. */
export function ProductPageView({ page }: { page: ProductPage }) {
  return (
    <>
      <JsonLd data={productPageJsonLd(page)} />
      <main
        data-template={page.template}
        className='flex w-full flex-1 flex-col overflow-x-clip'
      >
        {PRODUCT_TEMPLATE_SECTIONS[page.template].map((key) => {
          const Section = SECTIONS[key]
          return <Section key={key} page={page} />
        })}
      </main>
    </>
  )
}
