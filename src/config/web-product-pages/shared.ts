/**
 * Blocks shared by every product and capability page: what holds for the
 * whole platform (where the data lives, security and transparency) is said
 * once, the same way, on all eleven pages.
 */

export const PRODUCT_CTA = {
  primary: { label: 'Fale com vendas', href: '/talk-to-sales' },
  secondary: { label: 'Criar conta', href: '/sign-up' },
  signIn: { label: 'Entrar', href: '/sign-in' },
} as const

export const PRODUCT_INFRA = {
  title: 'Seus dados. Do jeito que a sua empresa exige.',
  description:
    'O Steel roda na nuvem da Stratus Telecom, e cada módulo pode apontar para o PostgreSQL da sua própria empresa. Mesmo produto, mesmas telas, com os dados onde você decidir.',
  bullets: [
    'Módulo no seu próprio PostgreSQL',
    'Backup diário criptografado, com cópia fora do servidor',
    'Exportação de dados e exclusão de conta (LGPD)',
    'Trilha de auditoria das ações sensíveis',
    'Segundo fator por e-mail ou app autenticador',
    'Papéis e perfis de acesso por módulo',
    'Provedor de IA escolhido por workspace',
    'Status público com histórico de incidentes',
  ],
  primary: { label: 'Fale com vendas', href: '/talk-to-sales' },
  secondary: { label: 'Ver segurança', href: '/legals/security' },
} as const

export const PRODUCT_TRUST = {
  title: 'Segurança, privacidade e transparência',
  description:
    'Feito no Brasil, para empresas que respondem pela LGPD: consentimento, exportação e auditoria são parte do produto, não um anexo do contrato.',
  cards: [
    {
      kind: 'security',
      title: 'Segurança',
      description:
        'Criptografia em trânsito e no armazenamento das credenciais, dois fatores e controle de acesso por papel.',
      link: { label: 'Conheça nossas práticas', href: '/legals/security' },
    },
    {
      kind: 'status',
      title: 'Status em tempo real',
      description:
        'Sondas verificam aplicação, banco, cache, autenticação, e-mail e armazenamento o tempo todo.',
      link: { label: 'Ver o status', href: '/status' },
    },
    {
      kind: 'privacy',
      title: 'Privacidade e LGPD',
      description:
        'Política de privacidade clara, lista pública de subprocessadores e direitos do titular atendidos pela própria plataforma.',
      link: { label: 'Ler a política', href: '/legals/privacy' },
    },
  ],
} as const
