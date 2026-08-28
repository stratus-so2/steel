import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "07-Mobile App" do kit Figma de referência (node 0:421).
 * Ordem de seções segue o fluxo vertical real do frame: Header → Hero →
 * Content 01 → Content 02 → How → Video → Testimonial (3 cards) →
 * Features → Pricing → Footer.
 *
 * Gaps de vocabulário (ver relatório da tarefa):
 * - Não existe um tipo dedicado a vídeo — o banner "Video" (imagem +
 *   botão de play decorativo) usa STEPS com `items: []`.
 * - Content 01/02 (texto + imagem + lista de 2 itens) também usam STEPS —
 *   é o tipo que mais preserva a estrutura (título + subtítulo + imagem +
 *   itens); o componente decide o layout pela forma do conteúdo (ver
 *   `sections/mobile-app/steps.tsx`).
 * - O bloco "Testimonial" do Figma é 1 heading + 3 cards empilhados sobre
 *   um fundo escuro contínuo com Features. Como TESTIMONIAL só carrega um
 *   card por seção, viraram 3 seções TESTIMONIAL consecutivas com o mesmo
 *   fundo escuro — a costura entre elas fica invisível, mas o heading
 *   compartilhado ("1,749 remote teams...") e o link "Read more reviews"
 *   não têm campo correspondente e foram omitidos.
 */
export const mobileAppTemplate: LandingPageTemplateDefinition = {
  key: 'mobile-app',
  name: 'Mobile App',
  description: 'Modelo para apps mobile e produtos SaaS de equipe remota.',
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
        ctaLabel: 'Get Started Now',
        ctaHref: '#footer',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        title: 'Manage your remote team work',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next consultancy website within few minutes.',
        ctaLabel: 'Explore more',
        ctaHref: '#footer',
        imageUrl: '/landing-page-templates/mobile-app/hero-app-mockup.png',
      },
    },
    {
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'Collaborate with team members.',
        subtitle:
          'We share common trends and strategies for improving your rental income.',
        imageUrl: '/landing-page-templates/mobile-app/content-collaborate.png',
        items: [
          {
            title: 'Project Based Groups',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Unlimited Video Meetings',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
        ],
      },
    },
    {
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'Organize remote team fast & easily.',
        subtitle:
          'We share common trends and strategies for creating & improving your rental income.',
        imageUrl: '/landing-page-templates/mobile-app/content-organize.png',
        items: [
          {
            title: 'Create Unlimited Teams',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Hasslefree Chat with Everyone',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
        ],
      },
    },
    {
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'How does it work?',
        subtitle:
          'With lots of unique blocks, you can easily build a page easily without any coding.',
        items: [
          { title: 'Install App', description: '' },
          { title: 'Add Team Members', description: '' },
          { title: 'Start Rolling!', description: '' },
        ],
      },
    },
    {
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'Assista a uma demonstração do app',
        imageUrl: '/landing-page-templates/mobile-app/video-banner.png',
        items: [],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'OMG! I cannot believe that I have got a brand new landing page after getting Omega. It was super easy to edit and publish.',
        authorName: 'Isaac Olson',
        avatarUrl:
          '/landing-page-templates/mobile-app/testimonial-avatar-1.png',
        style: 'default',
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          "Simply the best. Better than all the rest. I'd recommend this product to beginners and advanced users who want success.",
        authorName: 'Barry Young',
        avatarUrl:
          '/landing-page-templates/mobile-app/testimonial-avatar-2.png',
        style: 'default',
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'Must have book for all, who want to be Product Designer or Interaction Designer.',
        authorName: 'Esther Allison',
        avatarUrl:
          '/landing-page-templates/mobile-app/testimonial-avatar-3.png',
        style: 'default',
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: 'We made this app to solve your problems.',
        items: [
          {
            title: 'Unlimited Projects',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Team Management',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'File Sharing',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Video Meetings',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Time Tracking',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Payment System',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
        ],
      },
    },
    {
      type: 'PRICING',
      content: {
        type: 'PRICING',
        title: 'Pricing made easy',
        subtitle:
          'With lots of unique blocks, you can easily build a page easily without any coding.',
        plans: [
          {
            name: 'Starter',
            price: '$19',
            period: '/ mo',
            features: [
              'Upto 100 Team Members',
              '100 GB Cloud Storage',
              'Unlimited Meetings',
              'Premium Support',
            ],
            ctaLabel: 'Get Started Now',
            ctaHref: '#footer',
            highlighted: false,
          },
          {
            name: 'Unlimited',
            price: '$99',
            period: '/ mo',
            features: [
              'Unlimited Team Members',
              'Unlimited Cloud Storage',
              'Unlimited Meetings',
              'Premium Support',
            ],
            ctaLabel: 'Get Started Now',
            ctaHref: '#footer',
            highlighted: true,
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
            title: 'Legal',
            links: [
              { label: 'Privacy Policy', href: '#' },
              { label: 'Terms & Conditions', href: '#' },
              { label: 'Return Policy', href: '#' },
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
