import type { LandingPageTemplateDefinition } from './index'

const BASE = '/landing-page-templates/ecommerce'

/**
 * Fiel ao frame "06-ECommerce" do kit Figma de referência (node 0:1102).
 * Ordem de seções segue o fluxo vertical real do frame: Header → Hero →
 * Category → All Items → Content → Testimonial → CTA → Footer.
 *
 * Duas seções do frame não têm tipo dedicado no vocabulário atual de 9
 * tipos (`src/schemas/crm-landing-page-section.schema.ts` só cobre HEADER,
 * HERO, SERVICES, FACTS, ABOUT, TESTIMONIAL, FEATURES, WORKS, FOOTER — não
 * o PRODUCTS citado no briefing original do template):
 * - "Category" (6 cards de cômodo) e "All Items" (8 produtos) usam WORKS
 *   duas vezes — preço/preço original de cada produto ficam no campo
 *   `category` como `"$preço|$preço original"`, que o componente
 *   `EcommerceWorks` interpreta (ver `sections/ecommerce/works.tsx`).
 * - "CTA" (banner full-bleed antes do rodapé) foi absorvido nos campos
 *   ctaTitle/ctaLabel/ctaHref de FOOTER, com a foto de fundo fixa no
 *   componente `EcommerceFooter`.
 */
export const ecommerceTemplate: LandingPageTemplateDefinition = {
  key: 'ecommerce',
  name: 'ECommerce',
  description: 'Modelo para lojas de móveis e decoração.',
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
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        eyebrow: 'Minimal Interior Design',
        title: 'We minimize your waste in every step of the process.',
        imageUrl: `${BASE}/hero-bg.png`,
      },
    },
    {
      type: 'WORKS',
      content: {
        type: 'WORKS',
        title: 'Shop by room',
        subtitle: 'Category',
        items: [
          {
            title: 'Living Room',
            category: '23 Items',
            imageUrl: `${BASE}/category-living-room.png`,
          },
          {
            title: 'Dining Room',
            category: '36 Items',
            imageUrl: `${BASE}/category-dining-room.png`,
          },
          {
            title: 'Bed Room',
            category: '17 Items',
            imageUrl: `${BASE}/category-bed-room.png`,
          },
          {
            title: 'Kitchen',
            category: '11 Items',
            imageUrl: `${BASE}/category-kitchen.png`,
          },
          {
            title: 'Office',
            category: '09 Items',
            imageUrl: `${BASE}/category-office.png`,
          },
          {
            title: 'Outdoor',
            category: '45 Items',
            imageUrl: `${BASE}/category-outdoor.png`,
          },
        ],
      },
    },
    {
      type: 'PRODUCTS',
      content: {
        type: 'PRODUCTS',
        title: 'Explore All Products',
        items: [
          {
            title: 'Safavieh Couture',
            price: '$899',
            originalPrice: '$1,350',
            imageUrl: `${BASE}/product-safavieh-couture.png`,
          },
          {
            title: 'Fair Trade Ghana',
            price: '$34',
            imageUrl: `${BASE}/product-fair-trade-ghana.png`,
          },
          {
            title: 'KingSo Round Table',
            price: '$44.99',
            imageUrl: `${BASE}/product-kingso-round-table.png`,
          },
          {
            title: 'Porthos Dining Chair',
            price: '$120',
            originalPrice: '$350',
            imageUrl: `${BASE}/product-porthos-dining-chair.png`,
          },
          {
            title: 'Trade Folding Stool',
            price: '$31.49',
            imageUrl: `${BASE}/product-trade-folding-stool.png`,
          },
          {
            title: 'Rivet Accent Chair',
            price: '$120',
            originalPrice: '$350',
            imageUrl: `${BASE}/product-rivet-accent-chair.png`,
          },
          {
            title: 'Armen Living Chair',
            price: '$110',
            originalPrice: '$350',
            imageUrl: `${BASE}/product-armen-living-chair.png`,
          },
          {
            title: 'Knight Chair',
            price: '$120',
            originalPrice: '$350',
            imageUrl: `${BASE}/product-knight-chair.png`,
          },
        ],
      },
    },
    {
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        title: 'Track your progress with our advanced site.',
        description:
          'We share common trends and strategies for improving your rental income and making sure you stay in high demand.',
        imageUrl: `${BASE}/content-photo-main.png`,
        imageUrls: [`${BASE}/content-photo-float.png`],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'OMG! I cannot believe that I have got a brand new room after getting your services. It was super easy to order and get started.',
        authorName: 'Maria José Botín',
        authorRole: 'Interior Designer',
        avatarUrl: `${BASE}/testimonial-avatar.png`,
        style: 'default',
      },
    },
    {
      type: 'FOOTER',
      content: {
        type: 'FOOTER',
        ctaTitle: 'Ready to have a decorated lifestyle?',
        ctaLabel: 'Start Shopping',
        ctaHref: '#',
        linkGroups: [
          {
            title: 'Company',
            links: [
              { label: 'About us', href: '#' },
              { label: 'Contact us', href: '#' },
              { label: 'Careers', href: '#' },
              { label: 'Press', href: '#' },
            ],
          },
          {
            title: 'Product',
            links: [
              { label: 'Features', href: '#' },
              { label: 'Pricing', href: '#' },
              { label: 'News', href: '#' },
              { label: 'Help desk', href: '#' },
              { label: 'Support', href: '#' },
            ],
          },
          {
            title: 'Services',
            links: [
              { label: 'Digital Marketing', href: '#' },
              { label: 'Content Writing', href: '#' },
              { label: 'SEO for Business', href: '#' },
              { label: 'UI Design', href: '#' },
            ],
          },
          {
            title: 'Legal',
            links: [
              { label: 'Privacy Policy', href: '#' },
              { label: 'Terms & Conditions', href: '#' },
              { label: 'Return Policy', href: '#' },
            ],
          },
          {
            title: 'Contact us',
            links: [
              {
                label: 'support@brainwave.io',
                href: 'mailto:support@brainwave.io',
              },
              { label: '+133-394-3439-1435', href: 'tel:+13339434391435' },
            ],
          },
        ],
        socialLinks: [
          { platform: 'twitter', href: '#' },
          { platform: 'facebook', href: '#' },
          { platform: 'instagram', href: '#' },
          { platform: 'linkedin', href: '#' },
        ],
      },
    },
  ],
}
