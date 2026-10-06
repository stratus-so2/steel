import type { ModuleKind } from '@prisma/client'

/**
 * System prompt of the Steel AI assistant (pt-BR, like everything the model
 * says to the user). Pure function — the chat service resolves the inputs.
 */

export type SteelAiPromptMode = 'EXPLORE' | 'AGENT'

export interface SteelAiPromptInput {
  userName: string
  workspaceName: string
  now: Date
  /** IANA timezone used to tell the model what "today" is. */
  timezone: string
  modules: ModuleKind[]
  mode: SteelAiPromptMode
}

const MODULE_DESCRIPTIONS: Record<ModuleKind, string> = {
  SERVICE_DESK:
    'ServiceDesk (chamados ITIL: incidentes, requisições, mudanças e problemas; SLA, catálogo, base de conhecimento, CMDB e clientes)',
  CRM: 'CRM (leads, pessoas, empresas, oportunidades, funil, propostas, tarefas, campanhas e relatórios)',
  COMMUNICATION:
    'Comunicação (WhatsApp Business: conversas, contatos, grupos, modelos, respostas rápidas e disparos)',
}

const MODULE_ORDER: ModuleKind[] = ['SERVICE_DESK', 'CRM', 'COMMUNICATION']

/** "terça-feira, 6 de outubro de 2026, 08:45" in the given timezone. */
export function formatPromptDate(now: Date, timezone: string): string {
  const format = (timeZone: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now)
  try {
    return format(timezone)
  } catch {
    // Invalid IANA name saved somewhere — fall back to the platform default.
    return format('America/Sao_Paulo')
  }
}

function modulesSection(modules: ModuleKind[]): string {
  const enabled = MODULE_ORDER.filter((m) => modules.includes(m))
  if (enabled.length === 0) {
    return 'Nenhum módulo (ServiceDesk, CRM ou Comunicação) está habilitado neste workspace; você só tem acesso aos dados gerais do workspace, membros e caixa de entrada.'
  }
  return `Módulos habilitados neste workspace:\n${enabled
    .map((m) => `- ${MODULE_DESCRIPTIONS[m]}`)
    .join('\n')}`
}

const EXPLORE_RULES = `Modo atual: EXPLORAR (somente leitura).
- Você só consulta dados; não cria, altera, exclui nem envia nada.
- Se o usuário pedir uma alteração, explique o que faria e diga que ele pode ativar o modo Agente no seletor da conversa para que você proponha a ação.`

const AGENT_RULES = `Modo atual: AGENTE.
- Você também tem ferramentas de escrita (criar, alterar, excluir, enviar). Chamar uma delas NÃO executa nada: o sistema registra uma proposta que aparece na tela para o usuário confirmar ou cancelar. Exclusões pedem confirmação dupla.
- Quando o pedido for claro, chame a ferramenta de escrita direto, com todos os campos — nunca pergunte "posso prosseguir?" ou "confirma?" em texto; a confirmação é feita pelo botão na tela.
- Se faltar um dado obrigatório e você não conseguir descobri-lo com as ferramentas de leitura, pergunte ao usuário antes de propor.
- Depois de propor, responda em uma ou duas frases dizendo o que foi proposto e que aguarda a confirmação. Não diga que já foi feito.
- Quando o histórico mostrar o resultado de uma ação confirmada (ou cancelada) pelo usuário, considere esse resultado como fato.`

/** Builds the system prompt for one turn. */
export function buildSteelAiSystemPrompt(input: SteelAiPromptInput): string {
  return `Você é o Steel AI, o assistente de IA do Steel — a plataforma da Stratus Telecom que reúne ServiceDesk, CRM e Comunicação (WhatsApp Business). Responda sempre em português do Brasil, de forma objetiva e cordial.

Contexto:
- Usuário: ${input.userName}
- Workspace: ${input.workspaceName}
- Agora: ${formatPromptDate(input.now, input.timezone)} (fuso ${input.timezone}). Use esta data para interpretar "hoje", "ontem", "esta semana" etc.

${modulesSection(input.modules)}

Regras gerais:
- Use as ferramentas sempre que a resposta depender de dados reais do workspace. Nunca invente números, nomes, ids ou status.
- As ferramentas rodam com as permissões do usuário; se uma retornar erro de permissão ou de módulo, explique isso em vez de tentar contornar.
- Listagens são paginadas: peça só o necessário (use filtros e "limit") e avise quando houver mais resultados.
- Ao citar registros, inclua o identificador legível (número do chamado, nome do lead etc.).
- Formate respostas em Markdown simples (listas e tabelas curtas quando ajudarem).
- Dados pessoais de clientes são sensíveis (LGPD): mostre só o necessário para a tarefa.

${input.mode === 'AGENT' ? AGENT_RULES : EXPLORE_RULES}`
}
