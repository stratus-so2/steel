import { PLAN_CATALOG } from '@/src/config/plans'
import type { PlanTier } from '@/src/schemas/plan.schema'

/**
 * Rows of the plan comparison table on /pricing. Every row describes what
 * Steel does today. The only limit enforced per plan is `seats`
 * (`src/config/plans.ts`, see docs/plans-review.md); everything else is the
 * same on every plan, so it is `included`. Keep this single array as the
 * source of the table.
 */
export type PricingValue =
  | { kind: 'included' }
  | { kind: 'seats' }
  | { kind: 'text'; text: string }

export interface PricingRow {
  key: string
  label: string
  tooltip: string
  value: PricingValue
}

export interface PricingGroup {
  title: string
  rows: PricingRow[]
}

export type PricingCell = { kind: 'check' } | { kind: 'text'; text: string }

const all = (key: string, label: string, tooltip: string): PricingRow => ({
  key,
  label,
  tooltip,
  value: { kind: 'included' },
})

export const PRICING_GROUPS: PricingGroup[] = [
  {
    title: 'Workspace',
    rows: [
      {
        key: 'seats',
        label: 'Membros (assentos)',
        tooltip:
          'Membros e convites pendentes do workspace. É o único limite que muda entre os planos.',
        value: { kind: 'seats' },
      },
      {
        key: 'modules',
        label: 'ServiceDesk, CRM e Comunicação',
        tooltip:
          'Os módulos são habilitados por workspace pela equipe da Stratus Telecom.',
        value: { kind: 'text', text: 'Por workspace' },
      },
      all(
        'roles',
        'Papéis e perfis de acesso',
        'Dono, administrador, membro e visualizador, mais perfis personalizados por recurso.',
      ),
      all(
        'inbox',
        'Caixa de entrada',
        'Notificações de todos os módulos, com adiamento e pendências da IA.',
      ),
      all(
        'search',
        'Busca global (Ctrl+K)',
        'Chamados, artigos, clientes, leads, oportunidades, conversas e membros.',
      ),
      all(
        'wiki',
        'Wiki colaborativa',
        'Páginas editadas em tempo real por várias pessoas.',
      ),
      all(
        'worklogs',
        'Registros de trabalho',
        'Horas apontadas e indicadores de produtividade, sem monitoramento.',
      ),
      all(
        'integrations',
        'Slack, GitHub e GitLab',
        'Avisos em canais, chamados a partir do Slack e issues vinculadas.',
      ),
    ],
  },
  {
    title: 'ServiceDesk',
    rows: [
      all(
        'sd-practices',
        'Incidentes, requisições, mudanças e problemas',
        'As quatro práticas do ITIL 4, com fases e transições configuráveis.',
      ),
      all(
        'sd-sla',
        'SLA e OLA sobre calendários de expediente',
        'Matriz impacto × urgência, pausa de SLA e escalonamento automático.',
      ),
      all(
        'sd-catalog',
        'Catálogo de serviços e CMDB',
        'Categoria, subcategoria e serviço; itens de configuração ligados aos chamados.',
      ),
      all(
        'sd-kb',
        'Base de conhecimento com KCS',
        'Artigo a partir do chamado, revisão com validade e métrica de reuso.',
      ),
      all(
        'sd-portal',
        'Portal do solicitante',
        'Portal interno e portal externo com acesso por link mágico.',
      ),
      all(
        'sd-approvals',
        'Aprovações por e-mail e CAB',
        'Aprovação sem login e rodada do comitê de mudanças.',
      ),
      all(
        'sd-reports',
        'Painéis, modo TV e relatórios de SLA agendados',
        'Relatórios em PDF e CSV enviados por e-mail todo mês.',
      ),
      all(
        'sd-ai',
        'Copiloto, triagem e risco preditivo',
        'IA no chamado e estimativa explicável de risco de violar o SLA.',
      ),
    ],
  },
  {
    title: 'CRM',
    rows: [
      all(
        'crm-leads',
        'Leads com pontuação e roteamento',
        'Seis etapas com registro do trabalho em cada uma.',
      ),
      all(
        'crm-deals',
        'Oportunidades, funis e previsão',
        'Funis próprios, produtos e metas por responsável.',
      ),
      all(
        'crm-proposals',
        'Propostas com link público',
        'Métricas de leitura, aceite online e controle de validade.',
      ),
      all(
        'crm-marketing',
        'Campanhas de e-mail, formulários e landing pages',
        'Com descadastro conforme a LGPD.',
      ),
      all(
        'crm-workflows',
        'Workflows',
        'Automação visual por evento, agenda ou webhook.',
      ),
      all(
        'crm-social',
        'Redes sociais',
        'Publicação e agendamento, métricas e concorrentes.',
      ),
    ],
  },
  {
    title: 'Comunicação',
    rows: [
      all(
        'zap-connections',
        'WhatsApp pela Meta Cloud API ou Z-API',
        'Vários números por workspace.',
      ),
      all(
        'zap-inbox',
        'Atendimento em tempo real',
        'Caixa compartilhada, transferência e mensagens rápidas.',
      ),
      all(
        'zap-broadcasts',
        'Transmissões e templates',
        'Envio em massa com descadastro por palavra-chave.',
      ),
      all(
        'zap-ai',
        'IA de atendimento e sentimento',
        'Resposta automática com base de conhecimento e alerta de sentimento negativo.',
      ),
    ],
  },
  {
    title: 'Steel AI',
    rows: [
      all(
        'ai-modes',
        'Modos Ask, Build, Autopilot e Teste',
        'Toda alteração pede confirmação no Build; o Autopilot é liberado pelo administrador.',
      ),
      all(
        'ai-agents',
        'Steel Agents',
        'Agentes por agenda, evento ou sob demanda, com aprovação na caixa de entrada.',
      ),
      all(
        'ai-skills',
        'Skills e memória',
        'Pedidos reutilizáveis com "/" e memória revisável.',
      ),
      {
        key: 'ai-quota',
        label: 'Cota de IA',
        tooltip:
          'Cota mensal em dólares definida pelo administrador, com uso cobrado pelo preço real de cada modelo.',
        value: { kind: 'text', text: 'Mensal, por workspace' },
      },
    ],
  },
  {
    title: 'Segurança e privacidade',
    rows: [
      all(
        'sec-2fa',
        'Verificação em duas etapas',
        'Código por e-mail ou aplicativo autenticador, com códigos de recuperação.',
      ),
      all(
        'sec-audit',
        'Auditoria',
        'Registro de acessos, exportações e ações da IA.',
      ),
      all(
        'sec-export',
        'Exportação completa dos dados',
        'Dados e logs do workspace, uma vez por dia.',
      ),
      all(
        'sec-backup',
        'Backup diário criptografado',
        'Cópia diária do banco de dados.',
      ),
    ],
  },
]

export function resolvePricingCell(
  row: PricingRow,
  plan: PlanTier,
): PricingCell {
  switch (row.value.kind) {
    case 'included':
      return { kind: 'check' }
    case 'text':
      return { kind: 'text', text: row.value.text }
    case 'seats': {
      const seats = PLAN_CATALOG[plan].limits.seats
      return {
        kind: 'text',
        text: seats === null ? 'Ilimitados' : `Até ${seats}`,
      }
    }
  }
}
