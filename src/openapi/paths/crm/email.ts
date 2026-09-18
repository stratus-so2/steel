import { z } from 'zod'
import {
  CreateCrmEmailCampaignSchema,
  UpdateCrmEmailCampaignSchema,
} from '@/src/schemas/crm-email-campaign.schema'
import {
  CreateCrmEmailAccountSchema,
  CreateCrmEmailMessageSchema,
} from '@/src/schemas/crm-email-sync.schema'
import {
  CreateCrmEmailTemplateSchema,
  PreviewCrmEmailTemplateLayoutSchema,
  UpdateCrmEmailTemplateSchema,
} from '@/src/schemas/crm-email-template.schema'
import {
  AddCrmMailingListMemberSchema,
  CreateCrmMailingListSchema,
  UpdateCrmMailingListSchema,
} from '@/src/schemas/crm-mailing-list.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  CrmEmailAccountDTO,
  CrmEmailCampaignDTO,
  CrmEmailCampaignRecipientDTO,
  CrmEmailMessageDTO,
  CrmEmailOptOutDTO,
  CrmEmailTemplateDTO,
  CrmEmailTemplatePreviewDTO,
  CrmMailingListDTO,
  CrmMailingListMemberDTO,
} from '../../schemas/crm/email'
import { CRM_ERRORS, crmAccess, describe, notFoundError } from './shared'

/**
 * CRM · E-mail marketing — `email-templates`, `email-campaigns`,
 * `mailing-lists`, `email-opt-outs`, `email-accounts`, `email-messages`.
 * Tudo sob a permissão `email`.
 */

const TAGS: RouteConfig['tags'] = ['CRM · E-mail marketing']

const TEMPLATE_ID = 'ID do template de e-mail.'
const CAMPAIGN_ID = 'ID da campanha.'
const LIST_ID = 'ID da lista de e-mail.'

const TEMPLATE_NOT_FOUND = notFoundError(
  'CrmEmailTemplate',
  'Template inexistente no workspace',
)
const CAMPAIGN_NOT_FOUND = notFoundError(
  'CrmEmailCampaign',
  'Campanha inexistente no workspace',
)
const LIST_NOT_FOUND = notFoundError(
  'CrmMailingList',
  'Lista inexistente no workspace',
)
const ALREADY_SENT: ErrorEntry = {
  code: 'CRM_EMAIL_CAMPAIGN_ALREADY_SENT',
  when: 'Campanha fora de `DRAFT`/`SCHEDULED`',
}
const LAYOUT_UNKNOWN: ErrorEntry = {
  code: 'VALIDATION_ERROR',
  message: 'Dados inválidos',
  when: '`templateId` não é um layout do catálogo (`promo-announcement`, `newsletter-update`)',
}

export const crmEmailRoutes: RouteConfig[] = [
  /* ------------------------------- templates ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/email-templates',
    tags: TAGS,
    summary: 'Listar templates de e-mail',
    description: describe(
      'Templates reutilizáveis para campanhas (excluídos não aparecem).',
      crmAccess('email', 'VIEW'),
    ),
    responses: {
      200: { description: 'Templates.', schema: z.array(CrmEmailTemplateDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/email-templates',
    tags: TAGS,
    summary: 'Criar template de e-mail',
    description: describe(
      'Conteúdo livre (`contentHtml`, com o estado do editor em `contentJson`) **ou** a partir de um layout fixo (`templateId` + `templateProps`) — nesse caso o HTML é renderizado pelo servidor e `contentHtml` pode ser omitido.',
      crmAccess('email', 'CREATE'),
    ),
    consent: true,
    body: {
      schema: CreateCrmEmailTemplateSchema,
      example: {
        name: 'Newsletter mensal',
        subject: 'Novidades de setembro',
        contentHtml: '<h1>Olá!</h1><p>Confira as novidades.</p>',
      },
    },
    responses: {
      201: { description: 'Template criado.', schema: CrmEmailTemplateDTO },
    },
    errors: [...CRM_ERRORS, LAYOUT_UNKNOWN],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/email-templates/preview',
    tags: TAGS,
    summary: 'Pré-visualizar layout de e-mail',
    description: describe(
      'Renderiza um layout fixo com os campos informados, para o preview ao vivo do editor. Nada é salvo.',
      crmAccess('email', 'VIEW'),
    ),
    body: {
      schema: PreviewCrmEmailTemplateLayoutSchema,
      example: {
        templateId: 'newsletter-update',
        templateProps: {
          heading: 'Novidades de setembro',
          body: 'Confira o que mudou.',
        },
      },
    },
    responses: {
      200: {
        description: 'HTML renderizado.',
        schema: CrmEmailTemplatePreviewDTO,
      },
    },
    errors: [...CRM_ERRORS, LAYOUT_UNKNOWN],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/email-templates/{templateId}',
    tags: TAGS,
    summary: 'Atualizar template de e-mail',
    description: describe(
      'Atualização parcial. Mudar `templateId` ou `templateProps` re-renderiza o HTML a partir do layout (ignorando `contentHtml`); senão, `contentHtml` enviado é gravado como está.',
      crmAccess('email', 'EDIT'),
    ),
    params: { templateId: TEMPLATE_ID },
    consent: true,
    body: UpdateCrmEmailTemplateSchema,
    responses: {
      200: { description: 'Template atualizado.', schema: CrmEmailTemplateDTO },
    },
    errors: [...CRM_ERRORS, TEMPLATE_NOT_FOUND, LAYOUT_UNKNOWN],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/email-templates/{templateId}',
    tags: TAGS,
    summary: 'Excluir template de e-mail',
    description: describe(
      'Exclusão lógica (soft delete).',
      crmAccess('email', 'DELETE'),
    ),
    params: { templateId: TEMPLATE_ID },
    consent: true,
    responses: { 200: { description: 'Template excluído.', schema: null } },
    errors: [...CRM_ERRORS, TEMPLATE_NOT_FOUND],
  },

  /* ------------------------------- campanhas ------------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/email-campaigns',
    tags: TAGS,
    summary: 'Listar campanhas de e-mail',
    description: crmAccess('email', 'VIEW'),
    responses: {
      200: { description: 'Campanhas.', schema: z.array(CrmEmailCampaignDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/email-campaigns',
    tags: TAGS,
    summary: 'Criar campanha de e-mail',
    description: describe(
      [
        'Cria a campanha em `DRAFT` (ou `SCHEDULED` com `scheduledAt` — o worker dispara as agendadas vencidas a cada 5 min) e já grava a lista de destinatários:',
        '',
        '- `recipientScope: ALL` → todas as pessoas do CRM com e-mail (o primeiro e-mail de cada uma);',
        '- `recipientScope: SELECTED` → união de `personIds`, membros de `mailingListIds` e `extraEmails`, sem duplicar endereços. Seleção vazia é erro (nunca cai em "todos").',
        '',
        'Descadastrados (opt-out LGPD, por e-mail ou por pessoa) são removidos. Sem nenhum destinatário elegível a campanha não é criada.',
      ].join('\n'),
      crmAccess('email', 'CREATE'),
    ),
    consent: true,
    body: {
      schema: CreateCrmEmailCampaignSchema,
      example: {
        subject: 'Conheça o ServiceDesk',
        contentHtml: '<h1>Olá!</h1>',
        fromAddress: 'marketing@acme.com.br',
        recipientScope: 'SELECTED',
        mailingListIds: ['ckw1mlst0000ab7d3k1e5xyz'],
      },
    },
    responses: {
      201: { description: 'Campanha criada.', schema: CrmEmailCampaignDTO },
    },
    errors: [
      ...CRM_ERRORS,
      {
        code: 'CRM_EMAIL_CAMPAIGN_NO_RECIPIENTS',
        message:
          'Nenhum destinatário elegível: a seleção está vazia ou todos se descadastraram',
        when: 'Nenhum destinatário elegível após o opt-out',
      },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/email-campaigns/{campaignId}',
    tags: TAGS,
    summary: 'Detalhe da campanha',
    description: crmAccess('email', 'VIEW'),
    params: { campaignId: CAMPAIGN_ID },
    responses: {
      200: { description: 'Campanha.', schema: CrmEmailCampaignDTO },
    },
    errors: [...CRM_ERRORS, CAMPAIGN_NOT_FOUND],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/email-campaigns/{campaignId}',
    tags: TAGS,
    summary: 'Atualizar campanha',
    description: describe(
      'Só campanhas em `DRAFT` ou `SCHEDULED`. Os destinatários não mudam (foram fixados na criação).',
      crmAccess('email', 'EDIT'),
    ),
    params: { campaignId: CAMPAIGN_ID },
    consent: true,
    body: UpdateCrmEmailCampaignSchema,
    responses: {
      200: { description: 'Campanha atualizada.', schema: CrmEmailCampaignDTO },
    },
    errors: [...CRM_ERRORS, CAMPAIGN_NOT_FOUND, ALREADY_SENT],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/email-campaigns/{campaignId}/recipients',
    tags: TAGS,
    summary: 'Listar destinatários da campanha',
    description: describe(
      'Destinatários gravados na criação, com o status de envio de cada um.',
      crmAccess('email', 'VIEW'),
    ),
    params: { campaignId: CAMPAIGN_ID },
    responses: {
      200: {
        description: 'Destinatários.',
        schema: z.array(CrmEmailCampaignRecipientDTO),
      },
    },
    errors: [...CRM_ERRORS, CAMPAIGN_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/email-campaigns/{campaignId}/send',
    tags: TAGS,
    summary: 'Enviar campanha agora',
    description: describe(
      [
        'Dispara a campanha de forma **síncrona** (a resposta só volta ao fim do envio), usando apenas os destinatários gravados na criação.',
        '',
        'O opt-out é revalidado no disparo: quem se descadastrou nesse meio-tempo vira `SKIPPED`. Cada e-mail leva o rodapé com link de descadastro e os headers `List-Unsubscribe` (RFC 8058). Falhas individuais viram `FAILED` no destinatário; a campanha termina `SENT`, ou `FAILED` se todos os envios tentados falharem.',
      ].join('\n'),
      crmAccess('email', 'EDIT'),
    ),
    params: { campaignId: CAMPAIGN_ID },
    consent: true,
    responses: {
      200: {
        description: 'Campanha após o envio (contadores atualizados).',
        schema: CrmEmailCampaignDTO,
      },
    },
    errors: [
      ...CRM_ERRORS,
      CAMPAIGN_NOT_FOUND,
      ALREADY_SENT,
      {
        code: 'CRM_EMAIL_CAMPAIGN_NO_RECIPIENTS',
        when: 'Campanha sem destinatários gravados',
      },
    ],
  },

  /* -------------------------------- listas -------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/mailing-lists',
    tags: TAGS,
    summary: 'Listar listas de e-mail',
    description: crmAccess('email', 'VIEW'),
    responses: {
      200: { description: 'Listas.', schema: z.array(CrmMailingListDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/mailing-lists',
    tags: TAGS,
    summary: 'Criar lista de e-mail',
    description: crmAccess('email', 'CREATE'),
    consent: true,
    body: {
      schema: CreateCrmMailingListSchema,
      example: { name: 'Clientes ativos' },
    },
    responses: {
      201: { description: 'Lista criada.', schema: CrmMailingListDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/mailing-lists/{listId}',
    tags: TAGS,
    summary: 'Atualizar lista de e-mail',
    description: crmAccess('email', 'EDIT'),
    params: { listId: LIST_ID },
    consent: true,
    body: UpdateCrmMailingListSchema,
    responses: {
      200: { description: 'Lista atualizada.', schema: CrmMailingListDTO },
    },
    errors: [...CRM_ERRORS, LIST_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/mailing-lists/{listId}',
    tags: TAGS,
    summary: 'Excluir lista de e-mail',
    description: crmAccess('email', 'DELETE'),
    params: { listId: LIST_ID },
    consent: true,
    responses: { 200: { description: 'Lista excluída.', schema: null } },
    errors: [...CRM_ERRORS, LIST_NOT_FOUND],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/crm/mailing-lists/{listId}/members',
    tags: TAGS,
    summary: 'Listar membros da lista',
    description: crmAccess('email', 'VIEW'),
    params: { listId: LIST_ID },
    responses: {
      200: {
        description: 'Membros.',
        schema: z.array(CrmMailingListMemberDTO),
      },
    },
    errors: [...CRM_ERRORS, LIST_NOT_FOUND],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/mailing-lists/{listId}/members',
    tags: TAGS,
    summary: 'Adicionar membro à lista',
    description: describe(
      'Adiciona um endereço (opcionalmente vinculado a uma pessoa do CRM por `personId`).',
      crmAccess('email', 'EDIT'),
    ),
    params: { listId: LIST_ID },
    consent: true,
    body: {
      schema: AddCrmMailingListMemberSchema,
      example: { email: 'carlos@empresa.com.br', name: 'Carlos Lima' },
    },
    responses: {
      201: {
        description: 'Membro adicionado.',
        schema: CrmMailingListMemberDTO,
      },
    },
    errors: [
      ...CRM_ERRORS,
      LIST_NOT_FOUND,
      {
        code: 'CRM_MAILING_LIST_MEMBER_CONFLICT',
        when: 'E-mail já está na lista',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/mailing-lists/{listId}/members/{memberId}',
    tags: TAGS,
    summary: 'Remover membro da lista',
    description: describe(
      'Um `memberId` inexistente responde `500 DATABASE_ERROR` (a remoção não verifica a existência antes).',
      crmAccess('email', 'EDIT'),
    ),
    params: { listId: LIST_ID, memberId: 'ID do membro da lista.' },
    consent: true,
    responses: { 200: { description: 'Membro removido.', schema: null } },
    errors: [...CRM_ERRORS, LIST_NOT_FOUND],
  },

  /* ----------------------------- descadastros ----------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/email-opt-outs',
    tags: TAGS,
    summary: 'Listar descadastros',
    description: describe(
      'Endereços/pessoas que se descadastraram das campanhas (LGPD) pelo link do rodapé ou pelo one-click (RFC 8058). São excluídos automaticamente de novas campanhas e do disparo.',
      crmAccess('email', 'VIEW'),
    ),
    responses: {
      200: { description: 'Descadastros.', schema: z.array(CrmEmailOptOutDTO) },
    },
    errors: CRM_ERRORS,
  },

  /* ----------------------------- contas de e-mail ------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/email-accounts',
    tags: TAGS,
    summary: 'Listar contas de e-mail',
    description: describe(
      'Contas de todos os usuários do workspace. Não há sincronização real com Gmail/Outlook: a conta só agrupa e-mails e eventos registrados manualmente.',
      crmAccess('email', 'VIEW'),
    ),
    responses: {
      200: { description: 'Contas.', schema: z.array(CrmEmailAccountDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/email-accounts',
    tags: TAGS,
    summary: 'Conectar conta de e-mail',
    description: describe(
      'Registra uma conta do usuário autenticado (uma por provedor, por usuário, por workspace). Nenhuma credencial é pedida nem guardada.',
      crmAccess('email', 'CREATE'),
    ),
    consent: true,
    body: {
      schema: CreateCrmEmailAccountSchema,
      example: { provider: 'GMAIL', email: 'maria@acme.com.br' },
    },
    responses: {
      201: { description: 'Conta registrada.', schema: CrmEmailAccountDTO },
    },
    errors: [
      ...CRM_ERRORS,
      {
        code: 'CRM_EMAIL_ACCOUNT_CONFLICT',
        when: 'Usuário já tem conta deste provedor no workspace',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/email-accounts/{accountId}',
    tags: TAGS,
    summary: 'Remover conta de e-mail',
    description: crmAccess('email', 'DELETE'),
    params: { accountId: 'ID da conta de e-mail.' },
    consent: true,
    responses: { 200: { description: 'Conta removida.', schema: null } },
    errors: [
      ...CRM_ERRORS,
      notFoundError('CrmEmailAccount', 'Conta inexistente no workspace'),
    ],
  },

  /* ---------------------------- e-mails registrados ----------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/email-messages',
    tags: TAGS,
    summary: 'Listar e-mails registrados',
    description: describe(
      'E-mails registrados manualmente no CRM, opcionalmente filtrados por pessoa ou oportunidade.',
      crmAccess('email', 'VIEW'),
    ),
    query: {
      type: 'object',
      properties: {
        personId: {
          type: 'string',
          description: 'Só e-mails vinculados a esta pessoa.',
        },
        opportunityId: {
          type: 'string',
          description: 'Só e-mails vinculados a esta oportunidade.',
        },
      },
    },
    responses: {
      200: { description: 'E-mails.', schema: z.array(CrmEmailMessageDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/email-messages',
    tags: TAGS,
    summary: 'Registrar e-mail',
    description: describe(
      'Registra um e-mail trocado com o contato (entrada ou saída) para o histórico. Nada é enviado.',
      crmAccess('email', 'CREATE'),
    ),
    consent: true,
    body: {
      schema: CreateCrmEmailMessageSchema,
      example: {
        direction: 'OUTBOUND',
        subject: 'Proposta comercial',
        fromEmail: 'maria@acme.com.br',
        toEmails: ['carlos@empresa.com.br'],
        personId: 'ckw1pers0000ab7d3k1e5xyz',
        sentAt: '2026-09-18T13:00:00.000Z',
      },
    },
    responses: {
      201: { description: 'E-mail registrado.', schema: CrmEmailMessageDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/email-messages/{messageId}',
    tags: TAGS,
    summary: 'Excluir e-mail registrado',
    description: crmAccess('email', 'DELETE'),
    params: { messageId: 'ID do e-mail registrado.' },
    consent: true,
    responses: { 200: { description: 'E-mail excluído.', schema: null } },
    errors: [
      ...CRM_ERRORS,
      notFoundError('CrmEmailMessage', 'E-mail inexistente no workspace'),
    ],
  },
]
