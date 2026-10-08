import type { AiSkillTemplate } from './types'

/**
 * Skill templates for workspace OWNER/ADMIN. Using one pre-fills the
 * "Nova skill" form (workspace scope); the saved skill is a normal,
 * editable workspace skill. Commands never collide with a built-in skill.
 */

const lines = (...text: string[]) => text.join('\n')

export const AI_SKILL_TEMPLATES: readonly AiSkillTemplate[] = [
  {
    id: 'saude-workspace',
    slug: 'saude-workspace',
    name: 'Saúde do workspace',
    description:
      'Raio-X do workspace: módulos, membros, filas, SLA, conexões e consumo de IA.',
    category: 'MANAGEMENT',
    modules: [],
    instructions: lines(
      'Faça um raio-X do workspace para o administrador, só com os módulos disponíveis:',
      '- Plataforma: plano, módulos habilitados e número de membros;',
      '- ServiceDesk: chamados sem responsável, em risco e com SLA estourado;',
      '- Comunicação: conexões do WhatsApp e conversas esperando resposta;',
      '- IA: gasto do mês e projeção contra a cota.',
      'Mostre cada área com um sinal (ok, atenção, crítico) e uma linha de explicação. Termine com as 3 ações mais urgentes.',
    ),
    mode: 'EXPLORE',
    toolNames: [
      'ws_overview',
      'sd_sla_at_risk',
      'zap_connections_status',
      'zap_dashboard',
      'ws_ai_usage',
    ],
  },
  {
    id: 'membros',
    slug: 'membros',
    name: 'Membros e convites',
    description:
      'Quem está no workspace, com qual papel, e os convites pendentes.',
    category: 'GOVERNANCE',
    modules: [],
    instructions: lines(
      'Liste os membros do workspace agrupados por papel (proprietário, administrador, membro, visualizador), com nome e e-mail.',
      'Depois liste os convites pendentes com e-mail, papel e validade, destacando os que vencem em breve.',
      'Se o usuário escrever um nome ou e-mail depois do comando, mostre só quem combina com ele.',
    ),
    mode: 'EXPLORE',
    toolNames: ['ws_members', 'ws_invitations'],
  },
  {
    id: 'consumo-ia',
    slug: 'consumo-ia',
    name: 'Consumo de IA',
    description:
      'Gasto de IA do mês e da semana contra a cota, com projeção e quem mais usou.',
    category: 'GOVERNANCE',
    modules: [],
    instructions: lines(
      'Mostre o consumo de IA do workspace: gasto do mês e da semana em US$, a cota mensal, a parcela semanal e a projeção para o fim do mês.',
      'Liste os modelos, os recursos e as pessoas que mais gastaram no mês.',
      'Termine dizendo se o ritmo está dentro da cota e, se não estiver, o que pode ser ajustado (modelo mais barato, agentes com muitas execuções).',
    ),
    mode: 'EXPLORE',
    toolNames: ['ws_ai_usage'],
  },
  {
    id: 'auditoria',
    slug: 'auditoria',
    name: 'Auditoria de acessos',
    description:
      'Checklist de riscos de acesso: administradores demais, convites esquecidos, domínios estranhos.',
    category: 'GOVERNANCE',
    modules: [],
    instructions: lines(
      'Faça uma auditoria de acessos do workspace em formato de checklist:',
      '- quantos proprietários e administradores existem e se isso passa de 20% dos membros;',
      '- convites pendentes há mais de 7 dias ou perto de vencer;',
      '- e-mails de domínios diferentes do domínio da maioria dos membros;',
      '- módulos habilitados.',
      'Para cada item, marque ok ou atenção e explique em uma linha. Termine com as ações recomendadas.',
    ),
    mode: 'EXPLORE',
    toolNames: ['ws_overview', 'ws_members', 'ws_invitations'],
  },
  {
    id: 'sla-equipe',
    slug: 'sla-equipe',
    name: 'SLA da equipe',
    description:
      'SLA do ServiceDesk por técnico e departamento: em risco, estourados e sem responsável.',
    category: 'SERVICE_DESK',
    modules: ['SERVICE_DESK'],
    instructions: lines(
      'Monte a visão de SLA da equipe do ServiceDesk:',
      '- por técnico: chamados abertos, em risco e estourados;',
      '- por departamento: os mesmos números;',
      '- chamados sem responsável.',
      'Use tabelas curtas e ordene do pior para o melhor. Termine com onde o administrador deve agir primeiro.',
    ),
    mode: 'EXPLORE',
    toolNames: ['sd_sla_at_risk', 'sd_search_tickets', 'sd_ticket_counts'],
  },
  {
    id: 'fila-equipe',
    slug: 'fila-equipe',
    name: 'Fila da equipe',
    description:
      'Carga de trabalho do ServiceDesk por técnico, com os chamados parados há mais tempo.',
    category: 'SERVICE_DESK',
    modules: ['SERVICE_DESK'],
    instructions: lines(
      'Mostre a carga de trabalho do ServiceDesk por técnico: chamados abertos, os parados há mais de 3 dias úteis e o mais antigo de cada um.',
      'Compare criados × resolvidos nos últimos 7 dias.',
      'Sugira redistribuições quando um técnico tiver o dobro da média da equipe.',
    ),
    mode: 'EXPLORE',
    toolNames: ['sd_search_tickets', 'sd_ticket_counts', 'ws_members'],
  },
  {
    id: 'pipeline-time',
    slug: 'pipeline-time',
    name: 'Funil por vendedor',
    description:
      'Oportunidades abertas por vendedor e etapa, com valores, paradas e previsão.',
    category: 'CRM',
    modules: ['CRM'],
    instructions: lines(
      'Resuma o funil de vendas por vendedor:',
      '- oportunidades abertas por etapa, com quantidade e valor;',
      '- as paradas há mais de 14 dias;',
      '- ganhas e perdidas no mês.',
      'Mostre também a previsão de fechamento do mês. Use uma tabela por funil e termine com 3 observações para o gestor comercial.',
    ),
    mode: 'EXPLORE',
    toolNames: [
      'crm_list_pipelines',
      'crm_list_opportunities',
      'crm_get_forecast',
      'ws_members',
    ],
  },
  {
    id: 'atendimento-whatsapp',
    slug: 'atendimento-whatsapp',
    name: 'Atendimento no WhatsApp',
    description:
      'Como está o atendimento agora: conexões, conversas esperando, por atendente e sentimento.',
    category: 'COMMUNICATION',
    modules: ['COMMUNICATION'],
    instructions: lines(
      'Mostre a situação do atendimento por WhatsApp agora:',
      '- status de cada conexão (número);',
      '- conversas abertas, sem responsável e não lidas;',
      '- conversas abertas por atendente;',
      '- conversas com sentimento negativo.',
      'Termine com o que precisa de ação imediata.',
    ),
    mode: 'EXPLORE',
    toolNames: [
      'zap_connections_status',
      'zap_dashboard',
      'zap_conversations_list',
    ],
  },
]

export function findAiSkillTemplate(id: string): AiSkillTemplate | undefined {
  return AI_SKILL_TEMPLATES.find((template) => template.id === id)
}
