import type { LandingPageTemplateDefinition } from './index'

const BASE = '/landing-page-templates/web-application'

/**
 * Fiel ao frame "05-Web Application" do kit Figma de referência (node
 * 0:1371, mesmo arquivo "Brainwave.io" do template Agency). Ordem de seções
 * segue o fluxo vertical real do frame: Header (sobreposto ao Hero) → Hero
 * → Logos → Features → Content 01 → Content 02 → Content 03 → Pricing →
 * Testimonial (2x) → Footer.
 *
 * Mapeamento pros 15 tipos do vocabulário compartilhado
 * (`src/schemas/crm-landing-page-section.schema.ts`):
 * - Content 01 e Content 03 (texto + imagem, imagem à esquerda) → ABOUT,
 *   duas vezes.
 * - Content 02 (texto + imagem, imagem à direita — layout espelhado) →
 *   STEPS, com `items: []` (não é uma lista numerada no Figma).
 * - O bloco "Testimonial" do Figma tem 2 depoimentos lado a lado num grid
 *   2 colunas — viram duas seções TESTIMONIAL (`style: 'default'`)
 *   sequenciais, empilhadas verticalmente (ver comentário em
 *   `sections/web-application/testimonial.tsx`).
 */
export const webApplicationTemplate: LandingPageTemplateDefinition = {
  key: 'web-application',
  name: 'Web Application',
  description: 'Modelo para SaaS e aplicações web.',
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
        ctaLabel: 'Start a free trial',
        ctaHref: '#footer',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        title: 'Get more visitors, get more sales.',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next consultancy website within few minutes.',
        ctaLabel: 'Start a free trial',
        ctaHref: '#footer',
        imageUrl: `${BASE}/hero-video.png`,
      },
    },
    {
      type: 'LOGOS',
      content: {
        type: 'LOGOS',
        logos: [
          { name: 'MakeLess', imageUrl: `${BASE}/logo-1.png` },
          { name: 'coworks', imageUrl: `${BASE}/logo-2.png` },
          { name: 'greener', imageUrl: `${BASE}/logo-3.png` },
          { name: 'SaaS Today', imageUrl: `${BASE}/logo-4.png` },
          { name: 'Dorfus', imageUrl: `${BASE}/logo-5.png` },
          { name: 'askimat', imageUrl: `${BASE}/logo-6.png` },
        ],
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: 'Organize your campaigns',
        items: [
          {
            title: 'Organize your campaigns',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Manage customers',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Track progress fast',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
        ],
      },
    },
    {
      // Content 01 — imagem (laptop mockup) à esquerda, texto à direita.
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        title: 'Track your progress with our advanced site.',
        description:
          'We share common trends and strategies for improving your rental income and making sure you stay in high demand.',
        imageUrl: `${BASE}/content-01-laptop.png`,
        imageUrls: [],
      },
    },
    {
      // Content 02 — texto à esquerda, imagem à direita (layout espelhado).
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'Understand your visitors fast. Take quick actions.',
        subtitle:
          'We share common trends and strategies for improving your rental income and making sure you stay in high demand.',
        imageUrl: `${BASE}/content-02-front.png`,
        items: [],
      },
    },
    {
      // Content 03 — colagem de fotos à esquerda, texto à direita.
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        title: 'Make your customers happy by giving services.',
        description:
          'We share common trends and strategies for improving your rental income and making sure you stay in high demand.',
        imageUrl: `${BASE}/content-03-photo-1.png`,
        imageUrls: [
          `${BASE}/content-03-photo-2.png`,
          `${BASE}/content-03-photo-3.png`,
        ],
      },
    },
    {
      type: 'PRICING',
      content: {
        type: 'PRICING',
        title: 'Pricing & Plans',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        plans: [
          {
            name: 'Starter',
            price: '$19',
            period: '/ month',
            features: [
              'Commercial License',
              '100+ HTML UI Elements',
              '01 Domain Support',
            ],
            ctaLabel: 'Start Free Trial',
            highlighted: false,
          },
          {
            name: 'Standard',
            price: '$49',
            period: '/ month',
            features: [
              'Commercial License',
              '100+ HTML UI Elements',
              'Unlimited Domain Support',
              '6 Month Premium Support',
            ],
            ctaLabel: 'Start Free Trial',
            highlighted: true,
          },
          {
            name: 'Premium',
            price: '$99',
            period: '/ month',
            features: [
              'Commercial License',
              '100+ HTML UI Elements',
              'Unlimited Domain Support',
              '6 Month Premium Support',
              'Lifetime Updates',
            ],
            ctaLabel: 'Start Free Trial',
            highlighted: false,
          },
        ],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'OMG! I cannot believe that I have got a brand new landing page after getting Omega. It was super easy to edit and publish.',
        authorName: 'Diego Morata',
        authorRole: 'Web Developer',
        style: 'default',
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          "Simply the best. Better than all the rest. I'd recommend this product to beginners and advanced users.",
        authorName: 'Franklin Hicks',
        authorRole: 'Digital Marketer',
        style: 'default',
      },
    },
    {
      type: 'FOOTER',
      content: {
        type: 'FOOTER',
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
              { label: '+133-394-3439-1435', href: 'tel:+13393943439' },
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
