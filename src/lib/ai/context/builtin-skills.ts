import type { AiConversationMode } from '@prisma/client'

/**
 * Built-in Steel AI skills. They live in code (one source of truth, updated
 * with deploys) and are merged with the workspace's own skills at read
 * time. A workspace can only switch a built-in off: that choice is an
 * `AiSkill` row with `builtIn = true` and the same slug (the row's text is
 * ignored). Built-ins can never be deleted.
 */

export interface BuiltInSkill {
  slug: string
  name: string
  description: string
  instructions: string
  mode: AiConversationMode | null
  toolNames: string[]
}

/** Id exposed for a built-in skill (no database row is required). */
export const BUILT_IN_SKILL_ID_PREFIX = 'builtin:'

export const builtInSkillId = (slug: string): string =>
  `${BUILT_IN_SKILL_ID_PREFIX}${slug}`

export const BUILT_IN_SKILLS: readonly BuiltInSkill[] = [
  {
    slug: 'my-work',
    name: 'Meu trabalho',
    description:
      'Seus itens em aberto em todos os módulos, agrupados por status e priorizados.',
    instructions: [
      'Monte a lista de trabalho em aberto do usuário em todos os módulos disponíveis:',
      '- ServiceDesk: chamados atribuídos a ele (fila pessoal), com prioridade e prazo de SLA;',
      '- CRM: tarefas abertas dele, atrasadas primeiro;',
      '- Comunicação: conversas do WhatsApp atribuídas a ele que aguardam resposta;',
      '- Caixa de entrada: notificações não lidas e pendências da IA.',
      'Agrupe por status (atrasado, vence hoje, em andamento, aguardando) e, dentro de cada grupo, ordene por prioridade e prazo.',
      'Termine com no máximo 3 próximos passos sugeridos. Ignore módulos que não estiverem disponíveis, sem comentar.',
    ].join('\n'),
    mode: 'EXPLORE',
    toolNames: [
      'sd_my_queue',
      'crm_list_tasks',
      'zap_conversations_list',
      'ws_notifications',
    ],
  },
  {
    slug: 'sla',
    name: 'SLA em risco',
    description:
      'Chamados com SLA em risco ou estourado, do mais urgente ao menos.',
    instructions: [
      'Liste os chamados do ServiceDesk com SLA estourado e os em risco de estourar.',
      'Mostre em tabela: código, título, prioridade, responsável, fase e quanto falta (ou quanto passou) do prazo.',
      'Estourados primeiro, depois em risco, sempre do prazo mais próximo ao mais distante.',
      'Feche com uma frase sobre onde agir primeiro. Se o ServiceDesk não estiver disponível, diga isso em uma frase.',
    ].join('\n'),
    mode: 'EXPLORE',
    toolNames: ['sd_sla_at_risk', 'sd_search_tickets'],
  },
  {
    slug: 'pipeline',
    name: 'Resumo do funil',
    description:
      'Resumo do funil de vendas: oportunidades por etapa, valores e previsão.',
    instructions: [
      'Resuma o funil de vendas do CRM: para cada funil, a quantidade e o valor das oportunidades abertas por etapa.',
      'Destaque as maiores oportunidades, as paradas há mais tempo na mesma etapa e a previsão de fechamento do mês.',
      'Use uma tabela curta por funil e termine com 2 ou 3 observações objetivas.',
    ].join('\n'),
    mode: 'EXPLORE',
    toolNames: [
      'crm_list_pipelines',
      'crm_list_opportunities',
      'crm_get_forecast',
    ],
  },
  {
    slug: 'follow-ups',
    name: 'Follow-ups pendentes',
    description:
      'Leads e oportunidades sem contato há alguns dias (padrão: 7 dias).',
    instructions: [
      'Encontre leads e oportunidades abertos do usuário sem nenhuma atividade ou contato há mais de X dias.',
      'X é o número que o usuário escreveu depois do comando (ex.: "/follow-ups 14"); sem número, use 7 dias.',
      'Liste do mais antigo para o mais recente: nome, empresa, etapa, valor (se houver) e há quantos dias está sem contato.',
      'Para os 3 mais importantes, sugira uma mensagem curta de retomada.',
    ].join('\n'),
    mode: 'EXPLORE',
    toolNames: [
      'crm_list_leads',
      'crm_list_opportunities',
      'crm_get_record_timeline',
    ],
  },
  {
    slug: 'inbox',
    name: 'Minha caixa de entrada',
    description: 'Resumo do que precisa da sua atenção agora.',
    instructions: [
      'Resuma o que precisa da atenção do usuário agora: notificações não lidas da caixa de entrada, chamados novos ou atualizados na fila dele e conversas do WhatsApp atribuídas a ele esperando resposta.',
      'Agrupe por urgência (agora, hoje, pode esperar) com uma linha por item e o link ou código do registro.',
      'Seja breve: no máximo 10 itens no total.',
    ].join('\n'),
    mode: 'EXPLORE',
    toolNames: ['ws_notifications', 'sd_my_queue', 'zap_conversations_list'],
  },
  {
    slug: 'resumo-semana',
    name: 'Resumo da semana',
    description:
      'O que aconteceu nos últimos 7 dias no ServiceDesk, no CRM e na Comunicação.',
    instructions: [
      'Faça um resumo dos últimos 7 dias do workspace, por módulo disponível:',
      '- ServiceDesk: chamados abertos, resolvidos e com SLA estourado;',
      '- CRM: oportunidades ganhas, perdidas e criadas, com valores;',
      '- Comunicação: volume de conversas e atendimentos.',
      'Use números e comparações simples; termine com 3 destaques e 1 ponto de atenção.',
    ].join('\n'),
    mode: 'EXPLORE',
    toolNames: [
      'sd_ticket_counts',
      'sd_search_tickets',
      'crm_list_opportunities',
      'zap_dashboard',
    ],
  },
]

export function findBuiltInSkill(slug: string): BuiltInSkill | undefined {
  return BUILT_IN_SKILLS.find((skill) => skill.slug === slug)
}

/** Built-in skill of a `builtin:<slug>` id, or null for any other id. */
export function builtInSkillFromId(id: string): BuiltInSkill | null {
  if (!id.startsWith(BUILT_IN_SKILL_ID_PREFIX)) return null
  return findBuiltInSkill(id.slice(BUILT_IN_SKILL_ID_PREFIX.length)) ?? null
}
