import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "02-SaaS Subscription" do kit Figma de referência
 * (node 0:2385). Ordem de seções segue o fluxo vertical real do frame:
 * Header → Hero → Features → Content 01 ("Getting started...") → Facts →
 * Content 02 ("Manage your projects...") → Testimonial (x2) → Pricing →
 * FAQ → CTA → Footer.
 *
 * Content 01 e Content 02 mapeiam pro mesmo tipo STEPS — o primeiro com
 * `items` vazio (texto + imagem + CTA fixo, sem lista numerada) e o segundo
 * com a lista de 3 passos; `SaasSubscriptionSteps` decide o layout com base
 * em `items.length`. O bloco "CTA" (título + 2 botões) foi dobrado nos
 * campos `ctaTitle/ctaDescription/ctaLabel/ctaHref` do FOOTER, como o
 * próprio schema já sugere pro padrão Features/Footer.
 */
export const saasSubscriptionTemplate: LandingPageTemplateDefinition = {
  key: 'saas-subscription',
  name: 'SaaS Subscription',
  description: 'Modelo para produtos SaaS com planos e assinatura.',
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
        ctaLabel: 'Get started free',
        ctaHref: '#footer',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        title: 'Get things done by awesome remote team',
        subtitle:
          'We share common trends and strategies for improving your rental income and making sure you stay in high demand.',
        ctaLabel: 'Get started for free',
        ctaHref: '#footer',
        imageUrl: '/landing-page-templates/saas-subscription/hero-mockup.png',
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: 'Everything you need to manage projects',
        items: [
          {
            title: 'Project management',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Time tracking',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Beautiful mobile app',
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
        title: 'Getting started with Albino is easier than ever',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page so quickly with Albino.',
        imageUrl: '/landing-page-templates/saas-subscription/steps1-user-1.png',
        items: [],
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
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'Manage your projects fast',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        imageUrl: '/landing-page-templates/saas-subscription/steps2-event.png',
        items: [
          {
            title: 'Create a project',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Assign related people',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Make it done on-time',
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
          '“You made it so simple.” My new site is so much faster and easier to work with than my old site.',
        authorName: 'Corey Valdez',
        authorRole: 'Founder at Zenix',
        avatarUrl:
          '/landing-page-templates/saas-subscription/testimonial-avatar-1.png',
        style: 'default',
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          '“Simply the best.” Better than all the rest. I’d recommend this product to beginners.',
        authorName: 'Ian Klein',
        authorRole: 'Digital Marketer',
        avatarUrl:
          '/landing-page-templates/saas-subscription/testimonial-avatar-2.png',
        style: 'spotlight',
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
            name: 'Basic',
            price: '$29',
            period: 'One time purchase',
            features: [
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
            ],
            ctaLabel: 'Get started for free',
            ctaHref: '#footer',
            highlighted: false,
          },
          {
            name: 'Standard',
            price: '$49',
            period: 'One time purchase',
            features: [
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
            ],
            ctaLabel: 'Get started for free',
            ctaHref: '#footer',
            highlighted: false,
          },
          {
            name: 'Premium',
            price: '$99',
            period: 'One time purchase',
            features: [
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
            ],
            ctaLabel: 'Get started for free',
            ctaHref: '#footer',
            highlighted: false,
          },
        ],
      },
    },
    {
      type: 'FAQ',
      content: {
        type: 'FAQ',
        title: 'Frequently Asked Questions',
        items: [
          {
            question: 'Can I use Albino for my clients?',
            answer:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page. Integer ut Oberyn massa. Sed feugiat vitae turpis a porta.',
          },
          {
            question: 'Does it work with WordPress?',
            answer:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page. Integer ut Oberyn massa. Sed feugiat vitae turpis a porta.',
          },
          {
            question: 'Do I get free updates?',
            answer:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page. Integer ut Oberyn massa. Sed feugiat vitae turpis a porta.',
          },
          {
            question: 'Will you provide support?',
            answer:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page. Integer ut Oberyn massa. Sed feugiat vitae turpis a porta.',
          },
        ],
      },
    },
    {
      type: 'FOOTER',
      content: {
        type: 'FOOTER',
        logoText: 'Brainwave.io',
        text: 'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        ctaTitle: 'Build better landing page fast',
        ctaDescription:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        ctaLabel: 'Get it now',
        ctaHref: '#footer',
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
