import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "10-B2B" do kit Figma de referência (node 0:2, mesmo kit
 * visual "Brainwave.io" do template Agency). Ordem de seções segue o fluxo
 * vertical real do frame: Header → Hero (Alert dobrado dentro do Hero, ver
 * `sections/b2b/hero.tsx`) → Content 01 (About) → Services (Video dobrado
 * no fim da seção, ver `sections/b2b/services.tsx`) → Content 02 (Features)
 * → Testimonial → Footer (CTA "Ready to get started?" dobrado no topo do
 * Footer).
 */
export const b2bTemplate: LandingPageTemplateDefinition = {
  key: 'b2b',
  name: 'B2B',
  description: 'Modelo para consultorias e empresas B2B.',
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
        ctaLabel: 'Get A Free Quote',
        ctaHref: '#footer',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        eyebrow: 'Interested how our software works for you?',
        title: 'Make your business powerful with Shade.',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next consultancy website within few minutes.',
        ctaLabel: 'Get A Free Quote',
        ctaHref: '#footer',
        imageUrl: '/landing-page-templates/b2b/hero-portrait.png',
      },
    },
    {
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        title: 'Experienced experts are giving advices.',
        description:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        imageUrl: '/landing-page-templates/b2b/content01-photo.png',
        imageUrls: [],
      },
    },
    {
      type: 'SERVICES',
      content: {
        type: 'SERVICES',
        title: 'Services we offer for you',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        items: [
          {
            title: 'Digital Marketing',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
            imageUrl:
              '/landing-page-templates/b2b/services-digital-marketing.png',
          },
          {
            title: 'Business Growth',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
            imageUrl:
              '/landing-page-templates/b2b/services-business-growth.png',
          },
          {
            title: 'Content Marketing',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
            imageUrl:
              '/landing-page-templates/b2b/services-content-marketing.png',
          },
        ],
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: 'Reasons you should choose us to grow today.',
        subtitle:
          'We share common trends and strategies for improving your rental income and making sure you stay in high demand.',
        items: [
          { title: 'Fully Responsive', description: '' },
          { title: 'Beautiful Layouts', description: '' },
          { title: 'Easy to Edit', description: '' },
          { title: 'Google Font Included', description: '' },
        ],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'You made it so simple. My new site is so much faster and easier to work with than my old site.',
        authorName: 'Isabella Chavez',
        authorRole: 'Graphic Designer',
        avatarUrl: '/landing-page-templates/b2b/testimonial-avatar-1.png',
        style: 'default',
      },
    },
    {
      type: 'FOOTER',
      content: {
        type: 'FOOTER',
        logoText: 'Brainwave.io',
        text: 'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        ctaTitle: 'Ready to get started?',
        ctaLabel: 'Get A Free Quote',
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
