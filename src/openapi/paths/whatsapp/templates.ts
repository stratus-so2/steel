import { z } from 'zod'
import {
  CreateWhatsAppQuickReplySchema,
  UpdateWhatsAppQuickReplySchema,
} from '@/src/schemas/whatsapp-quick-reply.schema'
import { CreateWhatsAppTemplateSchema } from '@/src/schemas/whatsapp-template.schema'
import type { RouteConfig } from '../../registry'
import {
  WhatsAppQuickReplyDTO,
  WhatsAppTemplateDTO,
} from '../../schemas/whatsapp'
import { perm, permErrors } from './shared'

const TAG = 'Comunicação · Templates e respostas rápidas' as const
const QUICK_REPLY_PARAMS = { quickReplyId: 'Id da resposta rápida.' }

const META_ONLY =
  'Só conexões **Meta** (Cloud API) — templates são um recurso da WABA; na Z-API não existem.'

export const templateRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/whatsapp/templates',
    tags: [TAG],
    summary: 'Listar templates',
    description: `Templates de mensagem de todas as conexões Meta do workspace, em ordem alfabética, com o status de aprovação da Meta. Para atualizar status e novos templates criados no Business Manager, use \`POST .../templates/sync\`. ${perm('message-templates', 'VIEW')}`,
    responses: {
      200: { description: 'Templates.', schema: z.array(WhatsAppTemplateDTO) },
    },
    errors: permErrors('message-templates', 'VIEW'),
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whatsapp/templates',
    tags: [TAG],
    summary: 'Criar template',
    description: `Submete um template à aprovação da Meta (Graph API) e o salva localmente — normalmente com status \`PENDING\` até a Meta revisar. Monta os componentes \`HEADER\` (texto), \`BODY\`, \`FOOTER\` e \`BUTTONS\`; para cada variável \`{{n}}\` do corpo, envie um exemplo em \`bodyExample[n-1]\` (sem ele, usa \`exemploN\`). ${META_ONLY} Um corpo que não é JSON válido não é tratado (erro 500). Auditado. ${perm('message-templates', 'CREATE')}`,
    consent: true,
    body: CreateWhatsAppTemplateSchema,
    responses: {
      201: { description: 'Template submetido.', schema: WhatsAppTemplateDTO },
    },
    errors: [
      ...permErrors('message-templates', 'CREATE'),
      'WHATSAPP_CONNECTION_NOT_FOUND',
      {
        code: 'BAD_REQUEST',
        message:
          'Criação de templates está disponível apenas para conexões Meta',
        when: 'Conexão Z-API ou Meta sem WABA/token',
      },
      {
        code: 'BAD_REQUEST',
        message: 'Falha ao criar template',
        when: 'A Meta recusou o template (a mensagem vem da Graph API)',
      },
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whatsapp/templates/sync',
    tags: [TAG],
    summary: 'Sincronizar templates da Meta',
    description: `Busca todos os templates da WABA da conexão na Graph API e faz upsert local (nome + idioma), atualizando status e componentes. Devolve os templates sincronizados. ${META_ONLY} Auditado. ${perm('message-templates', 'CREATE')}`,
    body: z.object({
      connectionId: z.string().min(1).meta({ description: 'Conexão Meta.' }),
    }),
    responses: {
      200: {
        description: 'Templates sincronizados.',
        schema: z.array(WhatsAppTemplateDTO),
      },
    },
    errors: [
      ...permErrors('message-templates', 'CREATE'),
      'WHATSAPP_CONNECTION_NOT_FOUND',
      {
        code: 'BAD_REQUEST',
        message:
          'Sincronização de templates está disponível apenas para conexões Meta',
        when: 'Conexão Z-API ou Meta sem WABA/token',
      },
      {
        code: 'BAD_REQUEST',
        message: 'Falha ao sincronizar templates',
        when: 'Falha na Graph API (a mensagem vem da Meta)',
      },
    ],
  },

  /* --------------------------- respostas rápidas -------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/whatsapp/quick-replies',
    tags: [TAG],
    summary: 'Listar respostas rápidas',
    description: `Mensagens prontas do workspace, por atalho (ordem alfabética). ${perm('quick-replies', 'VIEW')}`,
    responses: {
      200: {
        description: 'Respostas rápidas.',
        schema: z.array(WhatsAppQuickReplyDTO),
      },
    },
    errors: permErrors('quick-replies', 'VIEW'),
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whatsapp/quick-replies',
    tags: [TAG],
    summary: 'Criar resposta rápida',
    description: `O \`shortcut\` é único no workspace. Auditado. ${perm('quick-replies', 'CREATE')}`,
    body: CreateWhatsAppQuickReplySchema,
    responses: {
      201: {
        description: 'Resposta rápida criada.',
        schema: WhatsAppQuickReplyDTO,
      },
    },
    errors: [
      ...permErrors('quick-replies', 'CREATE'),
      'WHATSAPP_QUICK_REPLY_CONFLICT',
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/whatsapp/quick-replies/{quickReplyId}',
    tags: [TAG],
    summary: 'Atualizar resposta rápida',
    description: `Atualização parcial. Auditado. ${perm('quick-replies', 'EDIT')}`,
    params: QUICK_REPLY_PARAMS,
    body: UpdateWhatsAppQuickReplySchema,
    responses: {
      200: {
        description: 'Resposta rápida atualizada.',
        schema: WhatsAppQuickReplyDTO,
      },
    },
    errors: [
      ...permErrors('quick-replies', 'EDIT'),
      'WHATSAPP_QUICK_REPLY_NOT_FOUND',
      'WHATSAPP_QUICK_REPLY_CONFLICT',
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/whatsapp/quick-replies/{quickReplyId}',
    tags: [TAG],
    summary: 'Excluir resposta rápida',
    description: `Auditado. ${perm('quick-replies', 'DELETE')}`,
    params: QUICK_REPLY_PARAMS,
    responses: {
      200: { description: 'Resposta rápida excluída.', schema: null },
    },
    errors: [
      ...permErrors('quick-replies', 'DELETE'),
      'WHATSAPP_QUICK_REPLY_NOT_FOUND',
    ],
  },
]
