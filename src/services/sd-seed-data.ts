import type {
  SdAutomationEvent,
  SdClassificationKind,
  SdEscalationTrigger,
  SdPhaseCategory,
  SdTicketType,
} from '@prisma/client'
import type {
  SdHoliday,
  SdWeeklySchedule,
} from '@/src/schemas/sd-calendar.schema'
import type {
  SdAutomationAction,
  SdCondition,
  SdEscalationActions,
} from '@/src/schemas/sd-rule.schema'
import type { SdTicketTemplateDefaults } from '@/src/schemas/sd-ticket-template.schema'

/**
 * Padrões ITIL 4 (pt-BR) semeados quando o módulo SERVICE_DESK é liberado.
 * Dados puros — `SdSeedService` aplica de forma idempotente.
 */

export interface SdSeedPhase {
  name: string
  color: string
  category: SdPhaseCategory
  completionPercent: number
  isInitial?: boolean
  pausesSla?: boolean
  requiresApproval?: boolean
  requiredFields?: string[]
}

export interface SdSeedScale {
  name: string
  level: number
  description?: string
  color?: string
  isDefault?: boolean
}

export interface SdSeedCalendar {
  name: string
  timezone: string
  schedule: SdWeeklySchedule
  holidays: SdHoliday[]
  is24x7: boolean
  isDefault: boolean
}

export interface SdSeedSlaPolicy {
  name: string
  description: string
  calendarName: string
  isDefault: boolean
  conditions: SdCondition[]
  /** Metas por nível de prioridade (minutos úteis). */
  targets: {
    priorityLevel: number
    firstResponseMinutes: number
    resolutionMinutes: number
  }[]
}

export interface SdSeedConfigItemType {
  name: string
  icon: string
  color: string
  attributeSchema: {
    key: string
    label: string
    type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT'
    options?: string[]
  }[]
}

export interface SdSeedDepartment {
  name: string
  description: string
  color: string
  /** O usuário que liberou o módulo vira líder (se for membro do workspace). */
  actorIsLead?: boolean
  children: { name: string; description: string; color: string }[]
}

export interface SdSeedCatalogNode {
  name: string
  children?: SdSeedCatalogNode[]
}

export interface SdSeedTemplate {
  ticketType: SdTicketType
  name: string
  description: string
  defaults: SdTicketTemplateDefaults
  tasks: { title: string; description?: string }[]
  portalVisible: boolean
}

export interface SdSeedEscalationRule {
  name: string
  trigger: SdEscalationTrigger
  conditions: SdCondition[]
  actions: SdEscalationActions
}

export interface SdSeedAutomationRule {
  name: string
  description: string
  event: SdAutomationEvent
  conditions: SdCondition[]
  actions: SdAutomationAction[]
}

/** Tudo o que o seed aplica (injetável nos testes). */
export interface SdSeedPlan {
  phases: Record<SdTicketType, SdSeedPhase[]>
  impacts: SdSeedScale[]
  urgencies: SdSeedScale[]
  priorities: SdSeedScale[]
  matrix: { impactLevel: number; urgencyLevel: number; priorityLevel: number }[]
  severities: SdSeedScale[]
  classifications: { kind: SdClassificationKind; name: string; color: string }[]
  calendars: SdSeedCalendar[]
  slaPolicies: SdSeedSlaPolicy[]
  configItemTypes: SdSeedConfigItemType[]
  departments: SdSeedDepartment[]
  catalog: SdSeedCatalogNode[]
  templates: SdSeedTemplate[]
  escalationRules: SdSeedEscalationRule[]
  automationRules: SdSeedAutomationRule[]
}

// ── Fases por tipo (fluxo livre: sem transições) ───────────────────────────

export const SD_SEED_PHASES: Record<SdTicketType, SdSeedPhase[]> = {
  INCIDENT: [
    {
      name: 'Novo',
      color: '#64748b',
      category: 'NEW',
      completionPercent: 0,
      isInitial: true,
    },
    {
      name: 'Em triagem',
      color: '#0ea5e9',
      category: 'IN_PROGRESS',
      completionPercent: 10,
    },
    {
      name: 'Em atendimento',
      color: '#6366f1',
      category: 'IN_PROGRESS',
      completionPercent: 40,
    },
    {
      name: 'Aguardando cliente',
      color: '#f59e0b',
      category: 'WAITING',
      completionPercent: 50,
      pausesSla: true,
    },
    {
      name: 'Aguardando terceiro',
      color: '#f97316',
      category: 'WAITING',
      completionPercent: 55,
      pausesSla: true,
    },
    {
      name: 'Resolvido',
      color: '#22c55e',
      category: 'RESOLVED',
      completionPercent: 90,
      requiredFields: ['solution'],
    },
    {
      name: 'Fechado',
      color: '#15803d',
      category: 'CLOSED',
      completionPercent: 100,
    },
    {
      name: 'Cancelado',
      color: '#ef4444',
      category: 'CANCELED',
      completionPercent: 100,
    },
  ],
  SERVICE_REQUEST: [
    {
      name: 'Nova',
      color: '#64748b',
      category: 'NEW',
      completionPercent: 0,
      isInitial: true,
    },
    {
      name: 'Em aprovação',
      color: '#a855f7',
      category: 'WAITING',
      completionPercent: 15,
      pausesSla: true,
    },
    {
      name: 'Aprovada / Em atendimento',
      color: '#6366f1',
      category: 'IN_PROGRESS',
      completionPercent: 40,
      requiresApproval: true,
    },
    {
      name: 'Aguardando solicitante',
      color: '#f59e0b',
      category: 'WAITING',
      completionPercent: 60,
      pausesSla: true,
    },
    {
      name: 'Atendida',
      color: '#22c55e',
      category: 'RESOLVED',
      completionPercent: 90,
    },
    {
      name: 'Fechada',
      color: '#15803d',
      category: 'CLOSED',
      completionPercent: 100,
    },
    {
      name: 'Cancelada / Rejeitada',
      color: '#ef4444',
      category: 'CANCELED',
      completionPercent: 100,
    },
  ],
  CHANGE: [
    {
      name: 'Registrada',
      color: '#64748b',
      category: 'NEW',
      completionPercent: 0,
      isInitial: true,
    },
    {
      name: 'Avaliação',
      color: '#0ea5e9',
      category: 'IN_PROGRESS',
      completionPercent: 15,
    },
    {
      name: 'Aprovação CAB',
      color: '#a855f7',
      category: 'WAITING',
      completionPercent: 30,
    },
    {
      name: 'Planejada',
      color: '#14b8a6',
      category: 'IN_PROGRESS',
      completionPercent: 45,
      requiresApproval: true,
    },
    {
      name: 'Em implementação',
      color: '#6366f1',
      category: 'IN_PROGRESS',
      completionPercent: 65,
    },
    {
      name: 'Revisão pós-implementação',
      color: '#84cc16',
      category: 'RESOLVED',
      completionPercent: 85,
    },
    {
      name: 'Concluída',
      color: '#15803d',
      category: 'CLOSED',
      completionPercent: 100,
    },
    {
      name: 'Rejeitada',
      color: '#ef4444',
      category: 'CANCELED',
      completionPercent: 100,
    },
  ],
  PROBLEM: [
    {
      name: 'Registrado',
      color: '#64748b',
      category: 'NEW',
      completionPercent: 0,
      isInitial: true,
    },
    {
      name: 'Em investigação',
      color: '#0ea5e9',
      category: 'IN_PROGRESS',
      completionPercent: 25,
    },
    {
      name: 'Causa raiz identificada',
      color: '#8b5cf6',
      category: 'IN_PROGRESS',
      completionPercent: 50,
      requiredFields: ['rootCause'],
    },
    {
      name: 'Erro conhecido',
      color: '#eab308',
      category: 'IN_PROGRESS',
      completionPercent: 70,
    },
    {
      name: 'Resolvido',
      color: '#22c55e',
      category: 'RESOLVED',
      completionPercent: 90,
    },
    {
      name: 'Fechado',
      color: '#15803d',
      category: 'CLOSED',
      completionPercent: 100,
    },
    {
      name: 'Cancelado',
      color: '#ef4444',
      category: 'CANCELED',
      completionPercent: 100,
    },
  ],
}

// ── Impacto, urgência, prioridade (matriz ITIL 3×3), severidade ────────────

export const SD_SEED_IMPACTS: SdSeedScale[] = [
  {
    name: 'Baixo',
    level: 1,
    description: 'Afeta um usuário ou um item não crítico',
  },
  {
    name: 'Médio',
    level: 2,
    description: 'Afeta um grupo/departamento ou um serviço importante',
  },
  {
    name: 'Alto',
    level: 3,
    description: 'Afeta a empresa toda ou um serviço crítico',
  },
]

export const SD_SEED_URGENCIES: SdSeedScale[] = [
  { name: 'Baixa', level: 1, description: 'Pode esperar; há alternativa' },
  {
    name: 'Média',
    level: 2,
    description: 'Prejudica o trabalho, mas há contorno',
  },
  {
    name: 'Alta',
    level: 3,
    description: 'Trabalho parado; precisa de ação imediata',
  },
]

export const SD_SEED_PRIORITIES: SdSeedScale[] = [
  { name: 'P4 – Baixa', level: 1, color: '#22c55e' },
  { name: 'P3 – Média', level: 2, color: '#eab308', isDefault: true },
  { name: 'P2 – Alta', level: 3, color: '#f97316' },
  { name: 'P1 – Crítica', level: 4, color: '#ef4444' },
]

/** Matriz ITIL padrão: [impacto][urgência] → nível da prioridade. */
export const SD_SEED_MATRIX: {
  impactLevel: number
  urgencyLevel: number
  priorityLevel: number
}[] = [
  { impactLevel: 1, urgencyLevel: 1, priorityLevel: 1 },
  { impactLevel: 1, urgencyLevel: 2, priorityLevel: 1 },
  { impactLevel: 1, urgencyLevel: 3, priorityLevel: 2 },
  { impactLevel: 2, urgencyLevel: 1, priorityLevel: 1 },
  { impactLevel: 2, urgencyLevel: 2, priorityLevel: 2 },
  { impactLevel: 2, urgencyLevel: 3, priorityLevel: 3 },
  { impactLevel: 3, urgencyLevel: 1, priorityLevel: 2 },
  { impactLevel: 3, urgencyLevel: 2, priorityLevel: 3 },
  { impactLevel: 3, urgencyLevel: 3, priorityLevel: 4 },
]

export const SD_SEED_SEVERITIES: SdSeedScale[] = [
  {
    name: 'Menor',
    level: 1,
    color: '#22c55e',
    description: 'Falha cosmética ou pontual',
  },
  {
    name: 'Moderada',
    level: 2,
    color: '#eab308',
    description: 'Funcionalidade degradada',
  },
  {
    name: 'Maior',
    level: 3,
    color: '#f97316',
    description: 'Funcionalidade importante indisponível',
  },
  {
    name: 'Crítica',
    level: 4,
    color: '#ef4444',
    description: 'Serviço fora do ar ou risco à segurança',
  },
]

// ── Classificações ─────────────────────────────────────────────────────────

export const SD_SEED_CLASSIFICATIONS: {
  kind: SdClassificationKind
  name: string
  color: string
}[] = [
  { kind: 'TICKET', name: 'Falha', color: '#ef4444' },
  { kind: 'TICKET', name: 'Dúvida', color: '#0ea5e9' },
  { kind: 'TICKET', name: 'Solicitação', color: '#6366f1' },
  { kind: 'TICKET', name: 'Melhoria', color: '#22c55e' },
  { kind: 'TICKET', name: 'Acesso', color: '#a855f7' },
  { kind: 'TICKET', name: 'Segurança', color: '#f97316' },
  { kind: 'SOLUTION', name: 'Resolvido remotamente', color: '#22c55e' },
  { kind: 'SOLUTION', name: 'Resolvido em campo', color: '#15803d' },
  { kind: 'SOLUTION', name: 'Contorno aplicado', color: '#eab308' },
  { kind: 'SOLUTION', name: 'Configuração ajustada', color: '#0ea5e9' },
  { kind: 'SOLUTION', name: 'Substituição de equipamento', color: '#6366f1' },
  { kind: 'SOLUTION', name: 'Sem reprodução', color: '#64748b' },
  { kind: 'SOLUTION', name: 'Encaminhado a fornecedor', color: '#f97316' },
  { kind: 'SOLUTION', name: 'Orientação ao usuário', color: '#a855f7' },
]

// ── Calendários ────────────────────────────────────────────────────────────

const BUSINESS_DAY: [string, string][] = [['08:00', '18:00']]
const FULL_DAY: [string, string][] = [['00:00', '24:00']]

/** Feriados nacionais 2026 e 2027 (inclui Carnaval, Sexta-feira Santa e Corpus Christi). */
export const SD_SEED_HOLIDAYS: SdHoliday[] = [
  { date: '2026-01-01', name: 'Confraternização Universal', recurring: false },
  { date: '2026-02-16', name: 'Carnaval', recurring: false },
  { date: '2026-02-17', name: 'Carnaval', recurring: false },
  { date: '2026-04-03', name: 'Sexta-feira Santa', recurring: false },
  { date: '2026-04-21', name: 'Tiradentes', recurring: false },
  { date: '2026-05-01', name: 'Dia do Trabalho', recurring: false },
  { date: '2026-06-04', name: 'Corpus Christi', recurring: false },
  { date: '2026-09-07', name: 'Independência do Brasil', recurring: false },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida', recurring: false },
  { date: '2026-11-02', name: 'Finados', recurring: false },
  { date: '2026-11-15', name: 'Proclamação da República', recurring: false },
  {
    date: '2026-11-20',
    name: 'Dia Nacional de Zumbi e da Consciência Negra',
    recurring: false,
  },
  { date: '2026-12-25', name: 'Natal', recurring: false },
  { date: '2027-01-01', name: 'Confraternização Universal', recurring: false },
  { date: '2027-02-08', name: 'Carnaval', recurring: false },
  { date: '2027-02-09', name: 'Carnaval', recurring: false },
  { date: '2027-03-26', name: 'Sexta-feira Santa', recurring: false },
  { date: '2027-04-21', name: 'Tiradentes', recurring: false },
  { date: '2027-05-01', name: 'Dia do Trabalho', recurring: false },
  { date: '2027-05-27', name: 'Corpus Christi', recurring: false },
  { date: '2027-09-07', name: 'Independência do Brasil', recurring: false },
  { date: '2027-10-12', name: 'Nossa Senhora Aparecida', recurring: false },
  { date: '2027-11-02', name: 'Finados', recurring: false },
  { date: '2027-11-15', name: 'Proclamação da República', recurring: false },
  {
    date: '2027-11-20',
    name: 'Dia Nacional de Zumbi e da Consciência Negra',
    recurring: false,
  },
  { date: '2027-12-25', name: 'Natal', recurring: false },
]

export const SD_SEED_CALENDAR_BUSINESS = 'Comercial (8×5)'
export const SD_SEED_CALENDAR_24X7 = '24×7'

export const SD_SEED_CALENDARS: SdSeedCalendar[] = [
  {
    name: SD_SEED_CALENDAR_BUSINESS,
    timezone: 'America/Sao_Paulo',
    schedule: {
      mon: BUSINESS_DAY,
      tue: BUSINESS_DAY,
      wed: BUSINESS_DAY,
      thu: BUSINESS_DAY,
      fri: BUSINESS_DAY,
      sat: [],
      sun: [],
    },
    holidays: SD_SEED_HOLIDAYS,
    is24x7: false,
    isDefault: true,
  },
  {
    name: SD_SEED_CALENDAR_24X7,
    timezone: 'America/Sao_Paulo',
    schedule: {
      mon: FULL_DAY,
      tue: FULL_DAY,
      wed: FULL_DAY,
      thu: FULL_DAY,
      fri: FULL_DAY,
      sat: FULL_DAY,
      sun: FULL_DAY,
    },
    holidays: [],
    is24x7: true,
    isDefault: false,
  },
]

// ── SLA ────────────────────────────────────────────────────────────────────

const HOUR = 60

export const SD_SEED_SLA_POLICIES: SdSeedSlaPolicy[] = [
  {
    name: 'Crítico 24×7',
    description: 'Incidentes P1 atendidos 24×7, em qualquer dia.',
    calendarName: SD_SEED_CALENDAR_24X7,
    isDefault: false,
    conditions: [
      { field: 'type', operator: 'equals', value: 'INCIDENT' },
      { field: 'priorityLevel', operator: 'equals', value: 4 },
    ],
    targets: [
      {
        priorityLevel: 4,
        firstResponseMinutes: 15,
        resolutionMinutes: 4 * HOUR,
      },
    ],
  },
  {
    name: 'Padrão',
    description: 'Metas em horário comercial (8×5) por prioridade.',
    calendarName: SD_SEED_CALENDAR_BUSINESS,
    isDefault: true,
    conditions: [],
    targets: [
      {
        priorityLevel: 4,
        firstResponseMinutes: 30,
        resolutionMinutes: 4 * HOUR,
      },
      {
        priorityLevel: 3,
        firstResponseMinutes: 1 * HOUR,
        resolutionMinutes: 8 * HOUR,
      },
      {
        priorityLevel: 2,
        firstResponseMinutes: 4 * HOUR,
        resolutionMinutes: 24 * HOUR,
      },
      {
        priorityLevel: 1,
        firstResponseMinutes: 8 * HOUR,
        resolutionMinutes: 40 * HOUR,
      },
    ],
  },
]

// ── Tipos de item de configuração (CMDB) ───────────────────────────────────

export const SD_SEED_CONFIG_ITEM_TYPES: SdSeedConfigItemType[] = [
  {
    name: 'Servidor',
    icon: 'server',
    color: '#6366f1',
    attributeSchema: [
      { key: 'hostname', label: 'Hostname', type: 'TEXT' },
      { key: 'os', label: 'Sistema operacional', type: 'TEXT' },
      { key: 'cpuCores', label: 'Núcleos de CPU', type: 'NUMBER' },
      { key: 'ramGb', label: 'Memória (GB)', type: 'NUMBER' },
      { key: 'storageGb', label: 'Armazenamento (GB)', type: 'NUMBER' },
      {
        key: 'environment',
        label: 'Ambiente',
        type: 'SELECT',
        options: ['Produção', 'Homologação', 'Desenvolvimento'],
      },
    ],
  },
  {
    name: 'Desktop',
    icon: 'computer',
    color: '#0ea5e9',
    attributeSchema: [
      { key: 'hostname', label: 'Hostname', type: 'TEXT' },
      { key: 'os', label: 'Sistema operacional', type: 'TEXT' },
      { key: 'cpu', label: 'Processador', type: 'TEXT' },
      { key: 'ramGb', label: 'Memória (GB)', type: 'NUMBER' },
    ],
  },
  {
    name: 'Notebook',
    icon: 'laptop',
    color: '#14b8a6',
    attributeSchema: [
      { key: 'hostname', label: 'Hostname', type: 'TEXT' },
      { key: 'os', label: 'Sistema operacional', type: 'TEXT' },
      { key: 'cpu', label: 'Processador', type: 'TEXT' },
      { key: 'ramGb', label: 'Memória (GB)', type: 'NUMBER' },
      { key: 'assignedTo', label: 'Usuário responsável', type: 'TEXT' },
    ],
  },
  {
    name: 'Impressora',
    icon: 'printer',
    color: '#64748b',
    attributeSchema: [
      {
        key: 'kind',
        label: 'Tipo',
        type: 'SELECT',
        options: ['Laser', 'Jato de tinta', 'Térmica', 'Multifuncional'],
      },
      {
        key: 'color',
        label: 'Colorida',
        type: 'SELECT',
        options: ['Sim', 'Não'],
      },
      { key: 'pageCounter', label: 'Contador de páginas', type: 'NUMBER' },
    ],
  },
  {
    name: 'Switch',
    icon: 'switch',
    color: '#8b5cf6',
    attributeSchema: [
      { key: 'ports', label: 'Portas', type: 'NUMBER' },
      {
        key: 'managed',
        label: 'Gerenciável',
        type: 'SELECT',
        options: ['Sim', 'Não'],
      },
      { key: 'poe', label: 'PoE', type: 'SELECT', options: ['Sim', 'Não'] },
      { key: 'firmware', label: 'Firmware', type: 'TEXT' },
    ],
  },
  {
    name: 'Roteador',
    icon: 'router',
    color: '#f97316',
    attributeSchema: [
      { key: 'wanIp', label: 'IP WAN', type: 'TEXT' },
      { key: 'firmware', label: 'Firmware', type: 'TEXT' },
    ],
  },
  {
    name: 'Firewall',
    icon: 'shield',
    color: '#ef4444',
    attributeSchema: [
      { key: 'firmware', label: 'Firmware', type: 'TEXT' },
      { key: 'licenseUntil', label: 'Licença até', type: 'DATE' },
      { key: 'throughputMbps', label: 'Throughput (Mbps)', type: 'NUMBER' },
    ],
  },
  {
    name: 'Access point',
    icon: 'wifi',
    color: '#22c55e',
    attributeSchema: [
      { key: 'ssid', label: 'SSID', type: 'TEXT' },
      {
        key: 'band',
        label: 'Banda',
        type: 'SELECT',
        options: ['2.4 GHz', '5 GHz', 'Dual band', 'Tri band'],
      },
      { key: 'controller', label: 'Controladora', type: 'TEXT' },
    ],
  },
  {
    name: 'Link de internet',
    icon: 'globe',
    color: '#0284c7',
    attributeSchema: [
      { key: 'provider', label: 'Operadora', type: 'TEXT' },
      { key: 'circuitId', label: 'Designação do circuito', type: 'TEXT' },
      { key: 'bandwidthMbps', label: 'Banda (Mbps)', type: 'NUMBER' },
      {
        key: 'kind',
        label: 'Tecnologia',
        type: 'SELECT',
        options: ['Fibra', 'Rádio', 'Satélite', 'Dedicado', '4G/5G'],
      },
      { key: 'publicIp', label: 'IP público', type: 'TEXT' },
    ],
  },
  {
    name: 'Telefonia/Ramal',
    icon: 'phone',
    color: '#a855f7',
    attributeSchema: [
      { key: 'extension', label: 'Ramal', type: 'TEXT' },
      { key: 'did', label: 'Número (DID)', type: 'TEXT' },
      { key: 'device', label: 'Aparelho', type: 'TEXT' },
    ],
  },
  {
    name: 'Software/Licença',
    icon: 'license',
    color: '#eab308',
    attributeSchema: [
      { key: 'vendor', label: 'Fabricante', type: 'TEXT' },
      { key: 'version', label: 'Versão', type: 'TEXT' },
      { key: 'seats', label: 'Licenças', type: 'NUMBER' },
      { key: 'expiresAt', label: 'Vencimento', type: 'DATE' },
    ],
  },
  {
    name: 'Serviço em nuvem',
    icon: 'cloud',
    color: '#06b6d4',
    attributeSchema: [
      { key: 'provider', label: 'Provedor', type: 'TEXT' },
      { key: 'region', label: 'Região', type: 'TEXT' },
      { key: 'account', label: 'Conta/assinatura', type: 'TEXT' },
      { key: 'monthlyCost', label: 'Custo mensal', type: 'NUMBER' },
    ],
  },
  {
    name: 'Banco de dados',
    icon: 'database',
    color: '#15803d',
    attributeSchema: [
      {
        key: 'engine',
        label: 'Motor',
        type: 'SELECT',
        options: [
          'PostgreSQL',
          'MySQL',
          'SQL Server',
          'Oracle',
          'MongoDB',
          'Outro',
        ],
      },
      { key: 'version', label: 'Versão', type: 'TEXT' },
      { key: 'sizeGb', label: 'Tamanho (GB)', type: 'NUMBER' },
    ],
  },
]

// ── Departamentos e catálogo de exemplo ────────────────────────────────────

export const SD_SEED_SERVICE_DESK = 'Service Desk'

export const SD_SEED_DEPARTMENTS: SdSeedDepartment[] = [
  {
    name: SD_SEED_SERVICE_DESK,
    description: 'Ponto único de contato com os usuários',
    color: '#6366f1',
    actorIsLead: true,
    children: [
      {
        name: 'N1 – Atendimento',
        description: 'Primeiro nível: registro, triagem e solução rápida',
        color: '#0ea5e9',
      },
      {
        name: 'N2 – Suporte técnico',
        description: 'Segundo nível: análise técnica e campo',
        color: '#14b8a6',
      },
    ],
  },
  {
    name: 'Infraestrutura',
    description: 'Redes, servidores, links e telefonia',
    color: '#f97316',
    children: [],
  },
  {
    name: 'Sistemas',
    description: 'ERP e sistemas corporativos',
    color: '#a855f7',
    children: [],
  },
]

export const SD_SEED_CATALOG: SdSeedCatalogNode[] = [
  {
    name: 'Infraestrutura',
    children: [
      {
        name: 'Rede',
        children: [
          { name: 'Sem acesso à internet' },
          { name: 'Lentidão na rede' },
          { name: 'Configurar VPN' },
        ],
      },
    ],
  },
  {
    name: 'Estações de trabalho',
    children: [
      {
        name: 'Hardware',
        children: [
          { name: 'Troca de periférico' },
          { name: 'Computador não liga' },
        ],
      },
    ],
  },
  {
    name: 'Acessos',
    children: [
      {
        name: 'Contas',
        children: [
          { name: 'Criar usuário' },
          { name: 'Resetar senha' },
          { name: 'Liberar acesso a sistema' },
        ],
      },
    ],
  },
  {
    name: 'Sistemas',
    children: [
      {
        name: 'ERP',
        children: [
          { name: 'Erro no sistema' },
          { name: 'Nova funcionalidade' },
        ],
      },
    ],
  },
]

// ── Modelos, escalonamento e automação ─────────────────────────────────────

export const SD_SEED_TEMPLATES: SdSeedTemplate[] = [
  {
    ticketType: 'SERVICE_REQUEST',
    name: 'Reset de senha',
    description: 'Redefinição de senha de acesso a um sistema ou à rede.',
    defaults: {
      title: 'Reset de senha',
      description:
        '<p>Informe o sistema e o usuário que precisa da nova senha.</p>',
      tags: ['acesso', 'senha'],
    },
    tasks: [
      { title: 'Confirmar a identidade do solicitante' },
      { title: 'Redefinir a senha e forçar troca no próximo login' },
      { title: 'Enviar orientação ao solicitante' },
    ],
    portalVisible: true,
  },
  {
    ticketType: 'SERVICE_REQUEST',
    name: 'Admissão de colaborador',
    description:
      'Preparação de acessos e equipamentos para um novo colaborador.',
    defaults: {
      title: 'Admissão de colaborador',
      description:
        '<p>Nome do colaborador, cargo, departamento, data de início e sistemas necessários.</p>',
      tags: ['onboarding'],
    },
    tasks: [
      { title: 'Criar usuário na rede e e-mail' },
      { title: 'Liberar acessos aos sistemas do cargo' },
      { title: 'Preparar estação de trabalho (notebook/desktop)' },
      { title: 'Configurar telefone/ramal' },
      { title: 'Entregar equipamentos e colher o aceite' },
    ],
    portalVisible: true,
  },
  {
    ticketType: 'CHANGE',
    name: 'Reinício programado de serviço',
    description: 'Mudança padrão pré-aprovada: reinício de serviço em janela.',
    defaults: {
      title: 'Reinício programado de serviço',
      changeType: 'STANDARD',
      changeRisk: 'LOW',
      implementationPlan:
        '<p>1. Avisar os usuários afetados.<br>2. Reiniciar o serviço.<br>3. Validar o funcionamento.</p>',
      rollbackPlan:
        '<p>Restaurar a configuração anterior e reiniciar novamente.</p>',
      testPlan: '<p>Acessar o serviço e executar a verificação de saúde.</p>',
    },
    tasks: [
      { title: 'Comunicar a janela aos usuários' },
      { title: 'Executar o reinício' },
      { title: 'Validar o serviço após o reinício' },
    ],
    portalVisible: false,
  },
  {
    ticketType: 'INCIDENT',
    name: 'Queda de link',
    description: 'Indisponibilidade do link de internet/dados.',
    defaults: {
      title: 'Queda de link de internet',
      description:
        '<p>Unidade afetada, horário do início e sintomas observados.</p>',
      tags: ['rede', 'link'],
    },
    tasks: [
      { title: 'Verificar equipamentos locais (roteador/ONT)' },
      { title: 'Abrir chamado na operadora' },
      { title: 'Acompanhar o restabelecimento e validar' },
    ],
    portalVisible: true,
  },
]

export const SD_SEED_ESCALATION_RULES: SdSeedEscalationRule[] = [
  {
    name: 'Resolução em risco → líder',
    trigger: 'RESOLUTION_AT_RISK',
    conditions: [],
    actions: {
      kind: 'HIERARCHICAL',
      notifyUserIds: [],
      notifyAssignee: true,
      notifyDepartmentLeads: true,
      reassignDepartmentId: null,
      reassignUserId: null,
      raisePriority: false,
      email: false,
    },
  },
]

export const SD_SEED_AUTOMATION_RULES: SdSeedAutomationRule[] = [
  {
    name: 'Incidente crítico → notificar líderes',
    description:
      'Avisa os líderes do departamento quando um incidente P1 é aberto.',
    event: 'TICKET_CREATED',
    conditions: [
      { field: 'type', operator: 'equals', value: 'INCIDENT' },
      { field: 'priorityLevel', operator: 'equals', value: 4 },
    ],
    actions: [
      {
        type: 'notify',
        params: {
          userIds: [],
          assignee: false,
          requester: false,
          departmentLeads: true,
          email: false,
          title: 'Incidente crítico aberto',
          message: 'Um incidente P1 foi aberto e precisa de atenção imediata.',
        },
      },
    ],
  },
]

export const SD_SEED_PLAN: SdSeedPlan = {
  phases: SD_SEED_PHASES,
  impacts: SD_SEED_IMPACTS,
  urgencies: SD_SEED_URGENCIES,
  priorities: SD_SEED_PRIORITIES,
  matrix: SD_SEED_MATRIX,
  severities: SD_SEED_SEVERITIES,
  classifications: SD_SEED_CLASSIFICATIONS,
  calendars: SD_SEED_CALENDARS,
  slaPolicies: SD_SEED_SLA_POLICIES,
  configItemTypes: SD_SEED_CONFIG_ITEM_TYPES,
  departments: SD_SEED_DEPARTMENTS,
  catalog: SD_SEED_CATALOG,
  templates: SD_SEED_TEMPLATES,
  escalationRules: SD_SEED_ESCALATION_RULES,
  automationRules: SD_SEED_AUTOMATION_RULES,
}
