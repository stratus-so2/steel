import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "01-Agency" do kit Figma de referência (node 0:2555, página
 * "🤩 02. Landing Page"). Ordem de seções segue o fluxo vertical real do
 * frame: Header (sobreposto ao Hero) → Hero → Services → Testimonial →
 * About → Facts → Features → Works → Testimonial → Footer. O frame tem dois
 * blocos de Testimonial — por isso o tipo aparece duas vezes.
 */
export const agencyTemplate: LandingPageTemplateDefinition = {
  key: 'agency',
  name: 'Agency',
  description: 'Modelo para agências criativas e estúdios de design.',
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
        ctaLabel: 'Get started a project',
        ctaHref: '#footer',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        eyebrow: "Let's shift your business",
        title: 'Shift your business fast with Shade Pro.',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next consultancy website within few minutes.',
        ctaLabel: 'Get started a project',
        ctaHref: '#footer',
        imageUrl: '/landing-page-templates/agency/hero-portrait.png',
      },
    },
    {
      type: 'SERVICES',
      content: {
        type: 'SERVICES',
        title: 'We provide great services for our customers based on needs',
        items: [
          {
            title: 'Graphic Design',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Web Development',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Content Writing',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
        ],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'OMG! I cannot believe that I have got a brand new landing page after getting Albino. It was super easy to edit and publish.',
        authorName: 'Franklin Hicks',
        authorRole: 'Web Developer',
        avatarUrl: '/landing-page-templates/agency/testimonial-avatar-1.png',
        style: 'default',
      },
    },
    {
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        eyebrow: 'Our Story',
        title:
          'We know how everything works and why your business is failing over and over again.',
        description:
          'We share common trends and strategies for improving your rental income and making sure you stay in high demand. With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        imageUrl: '/landing-page-templates/agency/about-photo-main.png',
        imageUrls: [
          '/landing-page-templates/agency/about-photo-2.png',
          '/landing-page-templates/agency/about-photo-3.png',
        ],
      },
    },
    {
      type: 'FACTS',
      content: {
        type: 'FACTS',
        items: [
          {
            value: '1M+',
            label:
              'Customers visit Omega every month to get their service done.',
          },
          {
            value: '92%',
            label: 'Satisfaction rate comes from our awesome customers.',
          },
          {
            value: '4.9/5.0',
            label: 'Average customer ratings we have got all over internet.',
          },
        ],
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: 'People choose us because we serve the best for everyone',
        subtitle: 'Why choose us',
        items: [
          {
            title: 'Dedicated project manager',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Organized tasks',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Easy feedback sharing',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
          {
            title: 'Never miss deadline',
            description:
              'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
          },
        ],
        ctaTitle: 'Ready to launch your next project?',
        ctaDescription:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        ctaLabel: 'Get started a project',
        ctaHref: '#footer',
      },
    },
    {
      type: 'WORKS',
      content: {
        type: 'WORKS',
        title: 'Our works describe why we are the best in the business',
        subtitle: 'Case studies',
        items: [
          {
            title: 'Aura Branding Design',
            category: 'Graphic Design',
            imageUrl: '/landing-page-templates/agency/work-1.png',
          },
          {
            title: 'AB.S Snack Packaging',
            category: 'Graphic Design',
            imageUrl: '/landing-page-templates/agency/work-3.png',
          },
          {
            title: 'Gradient Website Development',
            category: 'Web Development',
            imageUrl: '/landing-page-templates/agency/work-2.png',
          },
          {
            title: 'Magazine Content Writing',
            category: 'Content Writing',
            imageUrl: '/landing-page-templates/agency/work-4.png',
          },
        ],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          "Simply the best. Better than all the rest. I'd recommend this product to beginners and advanced users.",
        authorName: 'Ian Klein',
        authorRole: 'Digital Marketer',
        avatarUrl: '/landing-page-templates/agency/testimonial-avatar-2.png',
        style: 'spotlight',
      },
    },
    {
      type: 'FOOTER',
      content: {
        type: 'FOOTER',
        logoText: 'Brainwave.io',
        text: 'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        ctaTitle: 'Ready to launch your next project?',
        ctaDescription:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        ctaLabel: 'Get started a project',
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
