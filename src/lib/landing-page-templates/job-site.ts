import type { LandingPageTemplateDefinition } from './index'

/**
 * Fiel ao frame "04-Job Site" do kit Figma de referência (node 0:1950,
 * mesmo kit "Brainwave.io" do template Agency). Ordem de seções segue o
 * fluxo vertical real do frame: Header (sobreposto ao Hero) → Hero (com
 * formulário de busca) → Company (logos) → Category (categorias de vaga) →
 * Content (3 passos) → Jobs (vagas em destaque) → News (notícias) →
 * Subscribe (newsletter) → Footer.
 *
 * O frame tem dois blocos "WORKS" (Jobs e News) — o componente
 * `JobSiteWorks` (ver `sections/job-site/works.tsx`) resolve o layout de
 * cada card sozinho a partir de `category`, então os dois blocos convivem
 * no mesmo tipo de seção sem precisar estender o schema.
 */
export const jobSiteTemplate: LandingPageTemplateDefinition = {
  key: 'job-site',
  name: 'Job Site',
  description: 'Modelo para portais de vagas e recrutamento.',
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
          { label: 'Login', href: '#' },
        ],
        ctaLabel: 'Sign up',
        ctaHref: '#subscribe',
      },
    },
    {
      type: 'HERO',
      content: {
        type: 'HERO',
        title: 'Find a dream job that changes life.',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next job website.',
        ctaLabel: 'Search',
        ctaHref: '#jobs',
        imageUrl: '/landing-page-templates/job-site/hero-portrait.png',
      },
    },
    {
      type: 'LOGOS',
      content: {
        type: 'LOGOS',
        title: 'Big companies are here',
        logos: [
          {
            name: 'MakeLess',
            imageUrl: '/landing-page-templates/job-site/logo-makeless.png',
          },
          {
            name: 'coworks',
            imageUrl: '/landing-page-templates/job-site/logo-coworks.png',
          },
          {
            name: 'greener',
            imageUrl: '/landing-page-templates/job-site/logo-greener.png',
          },
          {
            name: 'SAAS TODAY',
            imageUrl: '/landing-page-templates/job-site/logo-saastoday.png',
          },
          {
            name: 'Dorfus',
            imageUrl: '/landing-page-templates/job-site/logo-dorfus.png',
          },
          {
            name: 'askimat',
            imageUrl: '/landing-page-templates/job-site/logo-askimat.png',
          },
        ],
      },
    },
    {
      type: 'SERVICES',
      content: {
        type: 'SERVICES',
        title: 'Jobs by category',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding.',
        items: [
          { title: 'Design', description: '47 Jobs' },
          { title: 'Marketing', description: '51 Jobs' },
          { title: 'Engineering', description: '89 Jobs' },
          { title: 'Management', description: '16 Jobs' },
          { title: 'Finance', description: '23 Jobs' },
          { title: 'Customer Support', description: '34 Jobs' },
        ],
      },
    },
    {
      type: 'STEPS',
      content: {
        type: 'STEPS',
        title: 'Find jobs with 3 easy steps',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        imageUrl: '/landing-page-templates/job-site/content-photo.png',
        items: [
          {
            title: 'Search for a job',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Apply within our website',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
          {
            title: 'Get interview call',
            description:
              'With lots of unique blocks, you can easily build a page without coding.',
          },
        ],
      },
    },
    {
      type: 'WORKS',
      content: {
        type: 'WORKS',
        title: 'Featured jobs',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding.',
        items: [
          {
            title: 'Senior Software Engineer — Dorfus, New York, USA',
            category: 'Full-time',
            imageUrl: '/landing-page-templates/job-site/job-logo-dorfus.png',
          },
          {
            title: 'Product Designer — Coworks, Lake Colby, UK',
            category: 'Remote',
            imageUrl: '/landing-page-templates/job-site/job-logo-coworks.svg',
          },
          {
            title: 'UX Designer — Askimat, California, USA',
            category: 'Full-time',
            imageUrl: '/landing-page-templates/job-site/job-logo-askimat.png',
          },
          {
            title: 'Full-stack Web Developer — Greener, Katlynburgh, Sweden',
            category: 'Part-time',
            imageUrl: '/landing-page-templates/job-site/job-logo-greener.svg',
          },
        ],
      },
    },
    {
      type: 'WORKS',
      content: {
        type: 'WORKS',
        title: 'News that helps',
        subtitle:
          'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
        items: [
          {
            title: 'How to win any job you want. Get started with 5 steps.',
            category: 'Career',
            imageUrl: '/landing-page-templates/job-site/news-1.png',
          },
          {
            title: '10 ways to reduce your office work depression.',
            category: 'Lifestyle',
            imageUrl: '/landing-page-templates/job-site/news-2.png',
          },
          {
            title: 'Why should you work as a team even on small projects.',
            category: 'Career',
            imageUrl: '/landing-page-templates/job-site/news-3.png',
          },
        ],
      },
    },
    {
      type: 'NEWSLETTER',
      content: {
        type: 'NEWSLETTER',
        title: 'Get our latest updates',
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
        logoText: 'Brainwave.io',
        text: 'With lots of unique blocks, you can easily build a page without coding. Build your next landing page.',
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
