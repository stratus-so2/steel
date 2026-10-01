import { z } from 'zod'
import {
  CreateSdMailboxSchema,
  UpdateSdMailboxSchema,
} from '@/src/schemas/sd-mailbox.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdMailboxDTO,
  SdMailboxSyncDTO,
  SdMailboxTestDTO,
  SdTicketMailMessageDTO,
} from '../../schemas/servicedesk/mail'

/**
 * ServiceDesk · E-mail — `app/api/workspaces/[id]/servicedesk/{mailboxes,
 * mail}/**`. As caixas (`SdMailbox`) são administradas só pelos admins do
 * módulo; a leitura dos e-mails de um chamado segue a visibilidade do
 * chamado (agente ou solicitante dono).
 */

const MAIL = 'ServiceDesk · E-mail' as const

const mailboxes = '/workspaces/{id}/servicedesk/mailboxes'
const mailbox = `${mailboxes}/{mailboxId}`
const ticketMail = '/workspaces/{id}/servicedesk/mail/tickets/{ticketId}'

const MAILBOX_PARAM = { mailboxId: 'Id da caixa de e-mail.' }
const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`INC-000123`).',
}

const MEMBER_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]

const ADMIN_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  {
    code: 'FORBIDDEN',
    message:
      'Apenas administradores do ServiceDesk podem alterar a configuração',
    when: 'Agente ou solicitante sem perfil de admin do módulo',
  },
]

const MAILBOX_NOT_FOUND: ErrorEntry = {
  code: 'SD_MAILBOX_NOT_FOUND',
  when: 'Caixa inexistente, removida ou de outro workspace',
}

const ADMIN_ACCESS =
  'Acesso: sessão + **admin do ServiceDesk** (OWNER/ADMIN do workspace ou perfil administrativo do módulo) com o módulo habilitado.'

export const sdMailRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: mailboxes,
    tags: [MAIL],
    summary: 'Listar caixas de e-mail',
    description: `Caixas monitoradas pelo módulo, com estado da conexão e horário da última leitura. As senhas nunca voltam — só \`smtpConfigured\`. ${ADMIN_ACCESS}`,
    responses: {
      200: { description: 'Caixas.', schema: z.array(SdMailboxDTO) },
    },
    errors: ADMIN_ERRORS,
  },
  {
    method: 'post',
    path: mailboxes,
    tags: [MAIL],
    summary: 'Cadastrar caixa de e-mail',
    description: `IMAP obrigatório, SMTP opcional. As senhas são cifradas com \`CONNECTION_SECRETS\`. A primeira leitura é enfileirada na hora (fila \`servicedesk-mail\`); depois o tick de 1 min cuida. Um endereço de uma caixa **removida** é reaproveitado. Auditado. ${ADMIN_ACCESS}`,
    consent: true,
    body: CreateSdMailboxSchema,
    responses: { 201: { description: 'Criada.', schema: SdMailboxDTO } },
    errors: [
      ...ADMIN_ERRORS,
      {
        code: 'SD_MAILBOX_CONFLICT',
        when: 'Já existe uma caixa ativa com este endereço',
      },
    ],
  },
  {
    method: 'patch',
    path: mailbox,
    tags: [MAIL],
    summary: 'Atualizar caixa de e-mail',
    description: `Padrões do chamado, listas de remetentes, confirmação de abertura, pausa (\`status\`) e troca de credenciais (recifradas). Voltar para \`ACTIVE\` limpa o erro da última leitura. Auditado. ${ADMIN_ACCESS}`,
    params: MAILBOX_PARAM,
    consent: true,
    body: UpdateSdMailboxSchema,
    responses: { 200: { description: 'Atualizada.', schema: SdMailboxDTO } },
    errors: [...ADMIN_ERRORS, MAILBOX_NOT_FOUND],
  },
  {
    method: 'delete',
    path: mailbox,
    tags: [MAIL],
    summary: 'Remover caixa de e-mail',
    description: `Exclusão lógica: a caixa deixa de ser lida e de responder. Os chamados e e-mails já registrados ficam. Auditado. ${ADMIN_ACCESS}`,
    params: MAILBOX_PARAM,
    consent: true,
    responses: { 200: 'Removida (`data: null`).' },
    errors: [...ADMIN_ERRORS, MAILBOX_NOT_FOUND],
  },
  {
    method: 'post',
    path: `${mailbox}/test`,
    tags: [MAIL],
    summary: 'Testar a conexão da caixa',
    description: `Conecta no IMAP, abre a pasta monitorada e, quando há SMTP, valida as credenciais de envio. Grava o resultado em \`status\`/\`statusError\` (uma caixa pausada continua pausada). Auditado. ${ADMIN_ACCESS}`,
    params: MAILBOX_PARAM,
    consent: true,
    responses: {
      200: { description: 'Resultado do teste.', schema: SdMailboxTestDTO },
    },
    errors: [...ADMIN_ERRORS, MAILBOX_NOT_FOUND],
  },
  {
    method: 'post',
    path: `${mailbox}/sync`,
    tags: [MAIL],
    summary: 'Ler a caixa agora',
    description: `Faz a leitura na hora, sem esperar o tick de 1 min: dedupe por \`Message-ID\`, listas de remetentes, detecção de resposta automática, encadeamento pela thread ou pelo código no assunto e abertura de chamado com os padrões da caixa. ${ADMIN_ACCESS}`,
    params: MAILBOX_PARAM,
    consent: true,
    responses: {
      200: { description: 'Números da leitura.', schema: SdMailboxSyncDTO },
    },
    errors: [...ADMIN_ERRORS, MAILBOX_NOT_FOUND],
  },
  {
    method: 'get',
    path: `${ticketMail}/messages`,
    tags: [MAIL],
    summary: 'Listar os e-mails de um chamado',
    description:
      'Cabeçalhos (de/para, assunto, automático) de cada e-mail recebido ou enviado pelo chamado, indexados pela mensagem do histórico (`ticketMessageId`). Acesso: sessão + membro com o módulo **ServiceDesk** habilitado e a permissão `sd-tickets` × `VIEW`; solicitante vê só os próprios chamados.',
    params: TICKET_PARAM,
    responses: {
      200: {
        description: 'E-mails do chamado.',
        schema: z.array(SdTicketMailMessageDTO),
      },
    },
    errors: [
      ...MEMBER_ERRORS,
      'SD_TICKET_NOT_FOUND',
      { code: 'SD_TICKET_FORBIDDEN', when: 'Sem acesso a este chamado' },
    ],
  },
]
