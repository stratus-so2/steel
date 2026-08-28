import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "09-Product" do kit Figma de referência (node 0:181,
 * arquivo "Brainwave.io - Landing Page UI Kit"). Página de produto único
 * (estilo AirPods) — ordem de seções segue o fluxo vertical real do frame:
 * Header → Hero (foto + "watch in action") → Content 01 (FEATURES: 2 itens
 * com ícone + foto) → Content 02 (TESTIMONIAL: depoimento + foto diagonal)
 * → Content 03 (ABOUT: texto + wave decorativa + 2 fotos do produto) →
 * Pricing (PRODUCTS: 3 variantes de cor do mesmo AirPods) → Footer
 * (minimalista, sem colunas).
 */
export const productTemplate: LandingPageTemplateDefinition = {
  key: 'product',
  name: 'Product',
  description: 'Modelo para lançamento de um único produto, estilo AirPods.',
  sections: [
    {
      type: 'HEADER',
      content: {
        type: 'HEADER',
        logoText: 'Brainwave.io',
        navLinks: [
          { label: 'Demos', href: '#' },
          { label: 'Pages', href: '#' },
          { label: 'Support', href: '#' },
          { label: 'Contact', href: '#footer' },
        ],
        ctaLabel: 'Buy now - Starting at $99',
        ctaHref: '#pricing',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        eyebrow: 'Non-stop music for long time',
        title: 'Sound, that sounds better!',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next consultancy website within few minutes.',
        ctaLabel: 'Buy now - Starting at $99',
        ctaHref: '#pricing',
        imageUrl: '/landing-page-templates/product/hero-airpod.png',
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: 'Listen music anytime, anywhere.',
        subtitle:
          'We share common trends and strategies for improving your rental income.',
        items: [
          {
            title: 'Comfortable Buds',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Powerful Bass',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
        ],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'You made it so simple. My new site is so much faster and easier to work with than my old site.',
        authorName: 'Rhoda Brady',
        avatarUrl: '/landing-page-templates/product/testimonial-avatar.png',
        style: 'spotlight',
      },
    },
    {
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        title: 'Trendy designs with better sound quality.',
        description:
          'We share common trends and strategies for improving your rental income.',
        imageUrl: '/landing-page-templates/product/about-earbuds-left.png',
        imageUrls: ['/landing-page-templates/product/about-earbuds-right.png'],
      },
    },
    {
      type: 'PRODUCTS',
      content: {
        type: 'PRODUCTS',
        title: 'Get your airpod now.',
        subtitle:
          'We share common trends and strategies for improving your rental income.',
        items: [
          {
            title: 'AirPods — Midnight Green',
            price: '$99',
            imageUrl:
              '/landing-page-templates/product/product-midnight-green.png',
          },
          {
            title: 'AirPods — Silver',
            price: '$99',
            imageUrl: '/landing-page-templates/product/product-silver.png',
          },
          {
            title: 'AirPods — Gold',
            price: '$99',
            imageUrl: '/landing-page-templates/product/product-gold.png',
          },
        ],
      },
    },
    {
      type: 'FOOTER',
      content: {
        type: 'FOOTER',
        logoText: 'Brainwave.io',
        linkGroups: [
          {
            title: 'Legal',
            links: [
              { label: 'Privacy Policy', href: '#' },
              { label: 'Terms & Conditions', href: '#' },
              { label: 'Support', href: '#' },
            ],
          },
        ],
        socialLinks: [],
      },
    },
  ],
}
