import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "08-Consultation" do kit Figma de referência (node 0:290).
 * Ordem de seções segue o fluxo vertical real do frame: Header → Hero →
 * Facts → Services → Content (STEPS: vídeo + 3 passos) → Testimonial (3
 * cards, cada um sua própria seção) → CTA Form (formulário de contato) →
 * CTA (NEWSLETTER) → Footer.
 *
 * "Alert" (tarja "novidade v3.0") não tem tipo próprio no vocabulário
 * compartilhado — dobrado dentro do componente HERO, decorativo. "CTA Form"
 * (painel escuro + formulário) usa ABOUT (título+descrição) com o card de
 * formulário decorativo/fixo no componente, sem submissão real.
 */
export const consultationTemplate: LandingPageTemplateDefinition = {
  key: 'consultation',
  name: 'Consultation',
  description: 'Modelo para consultorias e escritórios de assessoria.',
  sections: [
    {
      type: 'HEADER',
      content: {
        type: 'HEADER',
        logoText: 'shadepro',
        navLinks: [
          { label: 'Demos', href: '#' },
          { label: 'Pages', href: '#' },
          { label: 'Support', href: '#' },
          { label: 'Contact', href: '#footer' },
        ],
        ctaLabel: 'Get started now',
        ctaHref: '#footer',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        title: 'Get help from the expert consultants.',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next consultancy website within few minutes.',
        ctaLabel: 'Get started now',
        ctaHref: '#footer',
        imageUrl: '/landing-page-templates/consultation/hero-bg.png',
      },
    },
    {
      type: 'FACTS',
      content: {
        type: 'FACTS',
        items: [
          { value: '1M+', label: 'Customers visit Albino every months' },
          { value: '93%', label: 'Satisfaction rate from our customers.' },
          { value: '4.9', label: 'Average customer ratings out of 5.00!' },
        ],
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
            description: '',
            imageUrl:
              '/landing-page-templates/consultation/services-digital-marketing.png',
          },
          {
            title: 'Content Writing',
            description: '',
            imageUrl:
              '/landing-page-templates/consultation/services-content-writing.png',
          },
          {
            title: 'Graphic Design',
            description: '',
            imageUrl:
              '/landing-page-templates/consultation/services-graphic-design.png',
          },
          {
            title: 'SEO for Business',
            description: '',
            imageUrl: '/landing-page-templates/consultation/services-seo.png',
          },
        ],
      },
    },
    {
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'Why you should choose us?',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        imageUrl:
          '/landing-page-templates/consultation/steps-video-preview.png',
        items: [
          {
            title: 'Easy Booking',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Free Expert Opinion',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Get Your Results',
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
          'You made it so simple. My new site is so much faster & easier to work with Albino.',
        authorName: 'Ilya Vasin',
        authorRole: 'Software Engineer',
        avatarUrl:
          '/landing-page-templates/consultation/testimonial-logo-amazon.png',
        style: 'default',
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'Must have book for students, who want to be a great Product Designer.',
        authorName: 'Mariano Rasgado',
        authorRole: 'Software Engineer',
        avatarUrl:
          '/landing-page-templates/consultation/testimonial-logo-google.png',
        style: 'default',
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'You made it so simple. My new site is so much faster & easier to work with Albino.',
        authorName: 'Oka Tomoaki',
        authorRole: 'Software Engineer',
        avatarUrl:
          '/landing-page-templates/consultation/testimonial-logo-amazon.png',
        style: 'default',
      },
    },
    {
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        title: 'Get a free consultancy from our expert right now!',
        description:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page so quickly with Albino.',
        imageUrls: [],
      },
    },
    {
      type: 'NEWSLETTER',
      content: {
        type: 'NEWSLETTER',
        title: 'Subscribe to our newsletter to get latest news on your inbox.',
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
                label: 'support@shadepro.io',
                href: 'mailto:support@shadepro.io',
              },
              { label: '+133-394-3439-1435', href: 'tel:+13339343439' },
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
