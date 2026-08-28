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
          'Simplesmente os melhores. Entregaram além do esperado e no prazo combinado.',
        authorName: 'Ian Klein',
        authorRole: 'Marketing Digital',
      },
    },
    {
      type: 'ABOUT',
      content: {
        type: 'ABOUT',
        eyebrow: 'Nossa história',
        title: 'Sabemos como cada detalhe importa',
        description:
          'Compartilhamos tendências e boas práticas de mercado para construir soluções que realmente funcionam para o seu negócio.',
      },
    },
    {
      type: 'FACTS',
      content: {
        type: 'FACTS',
        items: [
          {
            value: '1M+',
            label: 'Clientes que já passaram pela nossa agência',
          },
          { value: '92%', label: 'Taxa de satisfação dos nossos clientes' },
          { value: '4.9/5.0', label: 'Avaliação média dos nossos clientes' },
        ],
      },
    },
    {
      type: 'FEATURES',
      content: {
        type: 'FEATURES',
        title: 'Por que nos escolher',
        subtitle: 'As pessoas escolhem a gente por esses motivos.',
        items: [
          {
            title: 'Gerente de projeto dedicado',
            description:
              'Um ponto de contato único do início ao fim do projeto.',
          },
          {
            title: 'Tarefas organizadas',
            description: 'Processos claros que mantêm tudo sob controle.',
          },
          {
            title: 'Feedback simplificado',
            description: 'Aprovação rápida e sem fricção em cada etapa.',
          },
          {
            title: 'Nunca perca um prazo',
            description: 'Acompanhamento constante do cronograma do projeto.',
          },
        ],
        ctaLabel: 'Comece agora',
        ctaHref: '#footer',
      },
    },
    {
      type: 'WORKS',
      content: {
        type: 'WORKS',
        title: 'Nossos projetos',
        subtitle: 'Conheça alguns dos trabalhos que já entregamos.',
        items: [
          { title: 'Identidade Visual Aura', category: 'Design Gráfico' },
          {
            title: 'Site Institucional Gradient',
            category: 'Desenvolvimento Web',
          },
          { title: 'Embalagem AB.S Snacks', category: 'Design Gráfico' },
          { title: 'Conteúdo para Revista', category: 'Produção de Conteúdo' },
        ],
      },
    },
    {
      type: 'TESTIMONIAL',
      content: {
        type: 'TESTIMONIAL',
        quote:
          'A equipe entendeu exatamente o que precisávamos e entregou um resultado incrível.',
        authorName: 'Marina Costa',
        authorRole: 'CEO, Loja Verde',
      },
    },
    {
      type: 'FOOTER',
      content: {
        type: 'FOOTER',
        text: 'Pronto para elevar sua marca? Vamos conversar.',
        links: [
          { label: 'Serviços', href: '#services' },
          { label: 'Sobre', href: '#about' },
          { label: 'Contato', href: 'mailto:contato@agencia.com' },
        ],
      },
    },
  ],
}
