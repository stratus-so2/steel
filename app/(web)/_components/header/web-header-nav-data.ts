import type { IconSvgElement } from '@hugeicons/react'
import {
  ActivityIcon,
  Agreement02Icon,
  Airplane01Icon,
  Book02Icon,
  Building03Icon,
  ChartUpIcon,
  CustomerSupportIcon,
  DatabaseIcon,
  Factory01Icon,
  InformationCircleIcon,
  Mail02Icon,
  Megaphone01Icon,
  PresentationLineChart02Icon,
  Rocket01Icon,
  SecurityCheckIcon,
  ServerStack03Icon,
  Settings02Icon,
  SourceCodeIcon,
  SparklesIcon,
  Stethoscope02Icon,
  Store01Icon,
  Target01Icon,
  UserGroupIcon,
  WhatsappIcon,
  WorkflowSquare01Icon,
} from '@hugeicons-pro/core-solid-rounded'

export interface NavItemData {
  title: string
  href: string
  description: string
  icon?: IconSvgElement
}

// Produto
export const products: NavItemData[] = [
  {
    title: 'ServiceDesk',
    description: 'Chamados ITIL 4 com SLA, CMDB e portal',
    href: '#',
    icon: CustomerSupportIcon,
  },
  {
    title: 'CRM',
    description: 'Leads, pipelines, propostas e forecast',
    href: '#',
    icon: Agreement02Icon,
  },
  {
    title: 'Comunicação',
    description: 'WhatsApp Business com inbox e disparos',
    href: '#',
    icon: WhatsappIcon,
  },
  {
    title: 'Steel AI',
    description: 'Assistente de IA que age com sua confirmação',
    href: '#',
    icon: SparklesIcon,
  },
]

export const featureCapabilities: NavItemData[] = [
  {
    title: 'Portal do solicitante',
    description: 'Abertura e acompanhamento de chamados pelo cliente',
    href: '#',
    icon: UserGroupIcon,
  },
  {
    title: 'SLA e OLA',
    description: 'Prazos sobre calendários úteis, com escalonamento',
    href: '#',
    icon: Target01Icon,
  },
  {
    title: 'Base de conhecimento',
    description: 'Artigos com KCS, revisão e métrica de reuso',
    href: '#',
    icon: Book02Icon,
  },
  {
    title: 'CMDB',
    description: 'Itens de configuração ligados aos chamados',
    href: '#',
    icon: DatabaseIcon,
  },
  {
    title: 'Dashboards e modo TV',
    description: 'Filas, SLA e resultados visíveis para o time',
    href: '#',
    icon: PresentationLineChart02Icon,
  },
  {
    title: 'Campanhas e landing pages',
    description: 'E-mail, formulários e páginas de captura',
    href: '#',
    icon: Mail02Icon,
  },
  {
    title: 'Workflows e Aprovações',
    description: 'Automações por regra e aprovações por e-mail',
    href: '#',
    icon: WorkflowSquare01Icon,
  },
]

// Soluções
export const useCases: NavItemData[] = [
  {
    title: 'Suporte de TI',
    description: 'Incidentes, requisições, mudanças e problemas',
    href: '#',
    icon: CustomerSupportIcon,
  },
  {
    title: 'Operação',
    description: 'Coordene o trabalho entre todas as equipes',
    href: '#',
    icon: Settings02Icon,
  },
  {
    title: 'Marketing',
    description: 'Campanhas, landing pages e redes sociais',
    href: '#',
    icon: Megaphone01Icon,
  },
  {
    title: 'Vendas',
    description: 'Do lead à proposta aceita, com previsibilidade',
    href: '#',
    icon: Agreement02Icon,
  },
  {
    title: 'Atendimento',
    description: 'Conversas no WhatsApp com contexto do cliente',
    href: '#',
    icon: WhatsappIcon,
  },
]

export const industries: NavItemData[] = [
  {
    title: 'Aeroespacial',
    description: 'Controle de operações de missão crítica',
    href: '#',
    icon: Airplane01Icon,
  },
  {
    title: 'Saúde',
    description: 'Atendimento com trilha de auditoria e LGPD',
    href: '#',
    icon: Stethoscope02Icon,
  },
  {
    title: 'Governo',
    description: 'Dados em banco próprio, sob seu controle',
    href: '#',
    icon: Building03Icon,
  },
  {
    title: 'Varejo',
    description: 'Operações de loja e coordenação de fornecedores',
    href: '#',
    icon: Store01Icon,
  },
  {
    title: 'Manufatura',
    description: 'Fluxos regulamentados com trilhas de auditoria',
    href: '#',
    icon: Factory01Icon,
  },
]

export const scale: NavItemData[] = [
  {
    title: 'Startups',
    description: 'Comece rápido e evolua a estrutura conforme cresce',
    href: '#',
    icon: Rocket01Icon,
  },
  {
    title: 'Equipes em crescimento',
    description: 'Escale sem aumentar a complexidade',
    href: '#',
    icon: ChartUpIcon,
  },
  {
    title: 'Empresa',
    description: 'Módulos apontados para o seu próprio PostgreSQL',
    href: '#',
    icon: ServerStack03Icon,
  },
]

// Recursos
export const discover: NavItemData[] = [
  {
    title: 'Novidades',
    description: 'Histórico completo de mudanças e lançamentos',
    href: '/changelog',
    icon: Megaphone01Icon,
  },
  {
    title: 'Manifesto',
    description: 'Os princípios que guiam como construímos o Steel',
    href: '/manifesto',
    icon: Target01Icon,
  },
  {
    title: 'Sobre',
    description: 'Por que a Stratus Telecom construiu o Steel',
    href: '/about',
    icon: InformationCircleIcon,
  },
  {
    title: 'Contato',
    description: 'Vendas, suporte e outros canais',
    href: '/contact',
    icon: UserGroupIcon,
  },
]

export const learn: NavItemData[] = [
  {
    title: 'Referência de API',
    description: 'Endpoints REST e integrações',
    href: '/docs',
    icon: SourceCodeIcon,
  },
  {
    title: 'Status',
    description: 'Disponibilidade e histórico de incidentes',
    href: '/status',
    icon: ActivityIcon,
  },
  {
    title: 'Segurança',
    description: 'Conformidade, LGPD e confiança',
    href: '/legals/security',
    icon: SecurityCheckIcon,
  },
]
