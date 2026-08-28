import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "03-Coworking" do kit Figma de referência (node 0:2226,
 * mesmo arquivo "Brainwave.io"). Ordem de seções segue o fluxo vertical real
 * do frame: Hero (com formulário de busca) → Facts → Locations → Content 01
 * → Features → Content 02 → Subscribe → Footer. O frame original agrupa
 * "Content 02" (lista de benefícios + accordion de FAQ) numa única seção
 * lado a lado — aqui vira duas seções independentes (STEPS + FAQ), já que o
 * vocabulário de tipos não tem um "duas colunas" dedicado; ambas mantêm o
 * fundo escuro pra preservar a leitura visual do bloco original (ver
 * comentários em `steps.tsx`/`faq.tsx`).
 */
export const coworkingTemplate: LandingPageTemplateDefinition = {
  key: 'coworking',
  name: 'Coworking',
  description: 'Modelo para espaços de coworking e escritórios compartilhados.',
  sections: [
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        eyebrow: 'Shared space in your town',
        title: 'Rent desk space in a shared office environment',
        ctaLabel: 'Search Place',
        ctaHref: '#locations',
        imageUrl: '/landing-page-templates/coworking/hero-bg.jpg',
      },
    },
    {
      type: 'FACTS',
      content: {
        type: 'FACTS',
        items: [
          {
            value: '06',
            label: 'Offices are available on different countries',
          },
          {
            value: '238',
            label: 'Seats are available right now with dedicated support',
          },
          {
            value: '1,395',
            label: 'People are using our co-work spaces right now',
          },
        ],
      },
    },
    {
      type: 'WORKS',
      content: {
        type: 'WORKS',
        title: 'Popular locations',
        subtitle:
          'With lots of unique blocks, you can easily build a page easily without any coding.',
        items: [
          {
            title: 'Beauview',
            category: '37 seats',
            imageUrl: '/landing-page-templates/coworking/location-1.jpg',
          },
          {
            title: 'Haleyborough',
            category: '12 seats',
            imageUrl: '/landing-page-templates/coworking/location-2.jpg',
          },
          {
            title: 'Jeromyshire',
            category: '28 seats',
            imageUrl: '/landing-page-templates/coworking/location-3.jpg',
          },
        ],
      },
    },
    {
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        title: 'Work around very talented people.',
        description:
          'With lots of unique blocks, you can easily build a page easily without any coding.',
        imageUrl: '/landing-page-templates/coworking/about-photo-1.jpg',
        imageUrls: ['/landing-page-templates/coworking/about-photo-2.jpg'],
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: "Everything you'll need",
        items: [
          {
            title: 'Dedicated Desk',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'High Speed Internet',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Unlimited Coffee',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
        ],
      },
    },
    {
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'We are always here for your backup.',
        subtitle:
          'We share common trends and strategies for creating & improving your rental income.',
        items: [
          {
            title: 'Noise Free Locations',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: '24/7 Hour Support',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
        ],
      },
    },
    {
      type: 'FAQ',
      content: {
        type: 'FAQ',
        title: 'Frequently asked questions',
        items: [
          {
            question: 'How to setup Shade Pro?',
            answer:
              'With lots of unique blocks, you can easily build a page with coding. Build your next landing page. Integer ut obe ryn. Sed feugiat vitae turpis a porta.',
          },
          {
            question: 'Can I use Shade Pro for my clients?',
            answer: '',
          },
          {
            question: 'How often do you release update?',
            answer: '',
          },
          {
            question: 'How can I access to old version?',
            answer: '',
          },
        ],
      },
    },
    {
      type: 'NEWSLETTER',
      content: {
        type: 'NEWSLETTER',
        title: 'Get latest updates',
        description:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        placeholder: 'Enter your email',
        ctaLabel: 'Subscribe',
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
              { label: '+133-394-3439-1435', href: 'tel:+13339433439-1435' },
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
