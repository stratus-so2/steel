import { z } from 'zod'
import {
  ConfirmAiPendingActionSchema,
  CreateAiConversationSchema,
  ListAiConversationsQuerySchema,
  ListAiPendingActionsQuerySchema,
  SendAiMessageSchema,
  UpdateAiConversationSchema,
} from '@/src/schemas/steel-ai.schema'
import { WORKSPACE_MEMBER_ERRORS } from '../common'
import type { ErrorEntry, OpenApiRegistry, RouteConfig } from '../registry'
import {
  AiCapabilitiesDTO,
  AiConversationDTO,
  AiMessageDTO,
  AiPendingActionDTO,
} from '../schemas/steel-ai'

/** Steel AI — assistente transversal (`/workspaces/{id}/ai/**`). */

const TAG = 'Steel AI' as const
const CONVERSATION_PARAM = {
  description: 'ID da conversa com o Steel AI.',
  example: 'ckw1aicv0000ab7d3k1e5xyz',
}
const ACTION_PARAM = { description: 'ID da ação pendente.' }

const PRIVATE =
  'Conversas e ações são pessoais: outro membro recebe `404`, nunca `403`.'

const CONVERSATION_NOT_FOUND: ErrorEntry = {
  code: 'AI_CONVERSATION_NOT_FOUND',
  when: 'Conversa inexistente, excluída ou de outro usuário',
}
const ACTION_NOT_FOUND: ErrorEntry = {
  code: 'AI_PENDING_ACTION_NOT_FOUND',
  when: 'Ação inexistente ou pedida por outro usuário',
}
const AGENT_OFF: ErrorEntry = {
  code: 'AI_AGENT_MODE_DISABLED',
  when: 'Modo agente pedido com o interruptor do workspace desligado',
}

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/ai/capabilities',
    tags: [TAG],
    summary: 'Capacidades do Steel AI',
    description:
      'O que a tela do Steel AI pode oferecer ao usuário: modo agente ligado, módulos habilitados, modelo resolvido (preferência do usuário → padrão do workspace) e consumo da cota mensal.',
    responses: {
      200: { description: 'Capacidades.', schema: AiCapabilitiesDTO },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai/conversations',
    tags: [TAG],
    summary: 'Listar conversas',
    description:
      'Conversas do usuário no workspace: fixadas primeiro, depois `updatedAt` desc (máx. 100). `q` filtra pelo título.',
    query: ListAiConversationsQuerySchema,
    responses: {
      200: { description: 'Conversas.', schema: z.array(AiConversationDTO) },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/ai/conversations',
    tags: [TAG],
    summary: 'Criar conversa',
    description:
      'Abre uma conversa vazia. `mode`: `EXPLORE` (só leitura, padrão) ou `AGENT` (propõe escritas que o usuário confirma).',
    consent: true,
    body: CreateAiConversationSchema,
    responses: {
      201: { description: 'Conversa criada.', schema: AiConversationDTO },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, AGENT_OFF],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai/conversations/{conversationId}',
    tags: [TAG],
    summary: 'Detalhar conversa',
    description: PRIVATE,
    params: { conversationId: CONVERSATION_PARAM },
    responses: { 200: { description: 'Conversa.', schema: AiConversationDTO } },
    errors: [...WORKSPACE_MEMBER_ERRORS, CONVERSATION_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/ai/conversations/{conversationId}',
    tags: [TAG],
    summary: 'Atualizar conversa',
    description: `Renomear, trocar o modo ou fixar/desafixar (\`pinned\`). Informe ao menos um campo. ${PRIVATE}`,
    consent: true,
    params: { conversationId: CONVERSATION_PARAM },
    body: UpdateAiConversationSchema,
    responses: {
      200: { description: 'Conversa atualizada.', schema: AiConversationDTO },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, CONVERSATION_NOT_FOUND, AGENT_OFF],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/ai/conversations/{conversationId}',
    tags: [TAG],
    summary: 'Excluir conversa',
    description: `Exclusão lógica (soft delete); devolve a conversa excluída. ${PRIVATE}`,
    consent: true,
    params: { conversationId: CONVERSATION_PARAM },
    responses: {
      200: { description: 'Conversa excluída.', schema: AiConversationDTO },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, CONVERSATION_NOT_FOUND],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai/conversations/{conversationId}/messages',
    tags: [TAG],
    summary: 'Listar mensagens',
    description: `Histórico em ordem cronológica. Cada resposta do assistente agrupa as rodadas de ferramentas do turno (\`toolCalls\` com o status final) e as ações propostas (\`pendingActions\`). ${PRIVATE}`,
    params: { conversationId: CONVERSATION_PARAM },
    responses: {
      200: { description: 'Mensagens.', schema: z.array(AiMessageDTO) },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, CONVERSATION_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/ai/conversations/{conversationId}/messages',
    tags: [TAG],
    summary: 'Enviar mensagem (stream)',
    description: [
      'Grava a mensagem e responde em **`text/event-stream`**: um frame por evento, `event: <type>\\ndata: <json>\\n\\n`, no formato `SteelAiStreamEvent` (`types/steel-ai.d.ts`):',
      '',
      '- `message.start` → `text.delta`* → (`tool.start` / `tool.end` / `action.pending`)* → `conversation.title`? → `message.end` (mensagem final + uso de tokens);',
      '- falha do provedor ou ao gravar no meio do stream vira um evento `error` (`code`, `message`).',
      '',
      'Até 8 rodadas de ferramentas por mensagem. No modo `AGENT`, toda escrita vira uma ação pendente (`action.pending`) que só executa por `POST .../ai/actions/{actionId}/confirm`. `mode` no corpo troca o modo da conversa a partir desta mensagem.',
      '',
      'Erros detectados **antes** do stream (sessão, consentimento, validação, conversa, modo agente, cota, provedor) voltam no envelope JSON normal. Limite próprio: 20 mensagens por minuto por usuário.',
      '',
      PRIVATE,
    ].join('\n'),
    consent: true,
    params: { conversationId: CONVERSATION_PARAM },
    body: {
      schema: SendAiMessageSchema,
      example: { content: 'Quantos chamados críticos estão abertos?' },
    },
    responses: {
      200: {
        description: 'Stream de eventos do turno.',
        envelope: false,
        contentType: 'text/event-stream',
        schema: { type: 'string' },
        example:
          'event: message.start\ndata: {"type":"message.start","conversationId":"c1","messageId":"m1"}\n\nevent: text.delta\ndata: {"type":"text.delta","delta":"Há 3"}\n\n',
      },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      CONVERSATION_NOT_FOUND,
      AGENT_OFF,
      {
        code: 'AI_QUOTA_EXCEEDED',
        message:
          'A cota mensal de IA do workspace foi atingida (US$ 50,00 de US$ 50,00). Peça a um administrador para ajustá-la em Ajustes > Steel IA ou aguarde o próximo mês.',
        when: 'Cota mensal de IA do workspace esgotada',
      },
      {
        code: 'AI_PROVIDER_UNAVAILABLE',
        when: 'Nenhum modelo habilitado com provedor configurado',
      },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai/actions',
    tags: [TAG],
    summary: 'Listar ações pendentes',
    description:
      'Ações propostas pelo Steel AI ao usuário (mais recentes primeiro, máx. 100). Ações vencidas viram `EXPIRED` nesta leitura.',
    query: ListAiPendingActionsQuerySchema,
    responses: {
      200: { description: 'Ações.', schema: z.array(AiPendingActionDTO) },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/ai/actions/{actionId}/confirm',
    tags: [TAG],
    summary: 'Confirmar ação',
    description: `Executa a escrita proposta. O servidor revalida dono, status, validade (30 min), modo agente, módulo e permissão e valida os argumentos de novo. Exclusões exigem \`doubleConfirmed: true\`. Idempotente: um segundo clique devolve o resultado do primeiro (\`EXECUTED\`/\`FAILED\`) sem executar de novo. Falha do domínio responde \`200\` com \`status: FAILED\` e \`error\`. ${PRIVATE}`,
    consent: true,
    params: { actionId: ACTION_PARAM },
    body: { schema: ConfirmAiPendingActionSchema, required: false },
    responses: {
      200: { description: 'Ação decidida.', schema: AiPendingActionDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      ACTION_NOT_FOUND,
      'AI_PENDING_ACTION_NOT_PENDING',
      'AI_PENDING_ACTION_EXPIRED',
      'AI_DOUBLE_CONFIRMATION_REQUIRED',
      'AI_AGENT_MODE_DISABLED',
      'AI_TOOL_NOT_ALLOWED',
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/ai/actions/{actionId}/cancel',
    tags: [TAG],
    summary: 'Cancelar ação',
    description: `Descarta a ação pendente; o Steel AI fica sabendo na próxima mensagem. ${PRIVATE}`,
    consent: true,
    params: { actionId: ACTION_PARAM },
    responses: {
      200: { description: 'Ação cancelada.', schema: AiPendingActionDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      ACTION_NOT_FOUND,
      'AI_PENDING_ACTION_NOT_PENDING',
    ],
  },
]

export function registerSteelAiPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
