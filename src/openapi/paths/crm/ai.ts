import { z } from 'zod'
import {
  CreateCrmAiConversationSchema,
  SendCrmAiMessageSchema,
} from '@/src/schemas/crm-ai.schema'
import {
  CreateCrmHookVaultItemSchema,
  ReorderCrmHookVaultItemsSchema,
  UpdateCrmHookVaultItemSchema,
} from '@/src/schemas/crm-hook-vault.schema'
import { fileUpload } from '../../common'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  CrmAiAttachmentDTO,
  CrmAiConversationDTO,
  CrmAiMessageDTO,
  CrmHookVaultItemDTO,
} from '../../schemas/crm/ai'
import { CRM_ERRORS, crmAccess, describe, notFoundError } from './shared'

/** CRM · IA — assistente de IA (`ai/conversations/**`) e Hook Vault. */

const CONVERSATION_PARAM = {
  description: 'ID da conversa com o assistente.',
  example: 'ckw1aicv0000ab7d3k1e5xyz',
}
const HOOK_PARAM = { description: 'ID do item do Hook Vault.' }

const CONVERSATION_NOT_FOUND = notFoundError(
  'CrmAiConversation',
  'Conversa inexistente, excluída ou de outro usuário',
)
const HOOK_NOT_FOUND = notFoundError('CrmHookVaultItem', 'Item inexistente')

const FEATURE_OFF: ErrorEntry = {
  code: 'FEATURE_NOT_ENABLED',
  when: 'Feature `crm.aiAssistant` desligada para o workspace',
}

const OWN_CONVERSATIONS =
  'Conversas são pessoais: só o usuário que criou a conversa a enxerga (outro usuário recebe `404`).'

export const crmAiRoutes: RouteConfig[] = [
  /* ------------------------------ assistente ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/ai/conversations',
    tags: ['CRM · IA'],
    summary: 'Listar conversas com o assistente',
    description: describe(
      'Conversas do usuário autenticado no workspace, da mais recente para a mais antiga.',
      crmAccess(null),
    ),
    responses: {
      200: {
        description: 'Conversas.',
        schema: z.array(CrmAiConversationDTO),
      },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/ai/conversations',
    tags: ['CRM · IA'],
    summary: 'Criar conversa com o assistente',
    description: describe(
      'Abre uma conversa vazia (o título é opcional). As mensagens vão em `POST .../conversations/{conversationId}/messages`.',
      crmAccess(null),
    ),
    consent: true,
    body: CreateCrmAiConversationSchema,
    responses: {
      201: { description: 'Conversa criada.', schema: CrmAiConversationDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/ai/conversations/{conversationId}',
    tags: ['CRM · IA'],
    summary: 'Listar mensagens da conversa',
    description: describe(
      'Histórico em ordem cronológica. Anexos trazem `url` assinada (15 min).',
      OWN_CONVERSATIONS,
      crmAccess(null),
    ),
    params: { conversationId: CONVERSATION_PARAM },
    responses: {
      200: { description: 'Mensagens.', schema: z.array(CrmAiMessageDTO) },
    },
    errors: [...CRM_ERRORS, CONVERSATION_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/ai/conversations/{conversationId}',
    tags: ['CRM · IA'],
    summary: 'Excluir conversa',
    description: describe(
      'Exclusão lógica (soft delete) da conversa.',
      OWN_CONVERSATIONS,
      crmAccess(null),
    ),
    consent: true,
    params: { conversationId: CONVERSATION_PARAM },
    responses: { 200: { description: 'Conversa excluída.', schema: null } },
    errors: [...CRM_ERRORS, CONVERSATION_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/ai/conversations/{conversationId}/messages',
    tags: ['CRM · IA'],
    summary: 'Enviar mensagem ao assistente',
    description: describe(
      [
        'Grava a mensagem do usuário, chama o modelo (com ferramentas que consultam e operam o CRM e busca na web) e devolve a **resposta do assistente** já gravada. Resposta síncrona — não há streaming.',
        '',
        '- Provedor/modelo: preferência do usuário → padrão do workspace → modelos habilitados (Ajustes > Steel IA, ADR 0007).',
        '- A **cota mensal em USD** do workspace é conferida antes de gravar qualquer coisa; estourada, responde `402 AI_QUOTA_EXCEEDED` (o erro traz `usedUsd`/`quotaUsd`). O consumo de tokens é contabilizado mesmo quando o provedor falha no meio.',
        '- `attachmentIds`: anexos pendentes desta conversa (de `POST .../attachments`), até 5; imagens são enviadas ao modelo.',
        '- Exige a feature `crm.aiAssistant` do workspace.',
      ].join('\n'),
      OWN_CONVERSATIONS,
      crmAccess(null),
    ),
    consent: true,
    params: { conversationId: CONVERSATION_PARAM },
    body: {
      schema: SendCrmAiMessageSchema,
      example: { content: 'Quantos leads entraram esta semana?' },
    },
    responses: {
      201: {
        description: 'Resposta do assistente.',
        schema: CrmAiMessageDTO,
      },
    },
    errors: [
      ...CRM_ERRORS,
      FEATURE_OFF,
      CONVERSATION_NOT_FOUND,
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
      {
        code: 'AI_PROVIDER_UNAVAILABLE',
        message:
          'Não foi possível falar com o provedor de IA agora. Tente novamente em instantes.',
        when: 'Falha na chamada ao provedor',
      },
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/ai/conversations/{conversationId}/attachments',
    tags: ['CRM · IA'],
    summary: 'Enviar anexo para a conversa',
    description: describe(
      'Faz o upload de um anexo (JPEG, PNG, WebP, PDF ou TXT, até 10 MB) e devolve o anexo pendente — envie o `id` em `attachmentIds` na próxima mensagem. Exige a feature `crm.aiAssistant`.',
      OWN_CONVERSATIONS,
      crmAccess(null),
    ),
    consent: true,
    params: { conversationId: CONVERSATION_PARAM },
    body: fileUpload(
      'file',
      'Arquivo (JPEG, PNG, WebP, PDF ou TXT; máx. 10 MB).',
    ),
    responses: {
      201: { description: 'Anexo salvo.', schema: CrmAiAttachmentDTO },
    },
    errors: [
      ...CRM_ERRORS,
      FEATURE_OFF,
      CONVERSATION_NOT_FOUND,
      {
        code: 'VALIDATION_ERROR',
        message: 'Arquivo não enviado',
        when: 'Campo `file` ausente',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'Arquivo muito grande. Máximo 10 MB',
        when: 'Arquivo acima de 10 MB',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'Formato não suportado. Use JPEG, PNG, WebP, PDF ou TXT',
        when: 'Tipo de arquivo não suportado',
      },
      {
        code: 'STORAGE_ERROR',
        message: 'Falha ao armazenar o anexo',
        when: 'Falha ao gravar no MinIO',
      },
    ],
  },

  /* ------------------------------ Hook Vault ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/hook-vault',
    tags: ['CRM · IA'],
    summary: 'Listar itens do Hook Vault',
    description: describe(
      'Ganchos de conteúdo salvos pelo workspace, na ordem manual (`position`).',
      crmAccess('social', 'VIEW'),
    ),
    responses: {
      200: { description: 'Itens.', schema: z.array(CrmHookVaultItemDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/hook-vault',
    tags: ['CRM · IA'],
    summary: 'Criar item do Hook Vault',
    description: crmAccess('social', 'CREATE'),
    consent: true,
    body: CreateCrmHookVaultItemSchema,
    responses: {
      201: { description: 'Item criado.', schema: CrmHookVaultItemDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/hook-vault/reorder',
    tags: ['CRM · IA'],
    summary: 'Reordenar itens do Hook Vault',
    description: describe(
      '`orderedIds` define a nova ordem (`position` = índice na lista).',
      crmAccess('social', 'EDIT'),
    ),
    consent: true,
    body: ReorderCrmHookVaultItemsSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/hook-vault/{itemId}',
    tags: ['CRM · IA'],
    summary: 'Atualizar item do Hook Vault',
    description: describe(
      'Atualização parcial — informe ao menos um campo.',
      crmAccess('social', 'EDIT'),
    ),
    consent: true,
    params: { itemId: HOOK_PARAM },
    body: UpdateCrmHookVaultItemSchema,
    responses: {
      200: { description: 'Item atualizado.', schema: CrmHookVaultItemDTO },
    },
    errors: [...CRM_ERRORS, HOOK_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/hook-vault/{itemId}',
    tags: ['CRM · IA'],
    summary: 'Excluir item do Hook Vault',
    description: describe(
      'Exclusão lógica (soft delete).',
      crmAccess('social', 'DELETE'),
    ),
    consent: true,
    params: { itemId: HOOK_PARAM },
    responses: { 200: { description: 'Item excluído.', schema: null } },
    errors: [...CRM_ERRORS, HOOK_NOT_FOUND],
  },
]
