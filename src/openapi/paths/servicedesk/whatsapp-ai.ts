import { z } from 'zod'
import {
  SdAiChatMessageSchema,
  SdAiPreServiceCloseSchema,
  SdAiPreServiceMessageSchema,
  SdAiPreServiceOpenTicketSchema,
  SdAiReplyRequestSchema,
} from '@/src/schemas/sd-ai.schema'
import {
  SdWhatsappConversationsQuerySchema,
  SdWhatsappLinkSchema,
  SdWhatsappMessagesQuerySchema,
  SdWhatsappSendTemplateSchema,
  SdWhatsappSendTextSchema,
  SdWhatsappStartSchema,
} from '@/src/schemas/sd-whatsapp.schema'
import {
  CreateWhatsAppConnectionSchema,
  UpdateWhatsAppConnectionSchema,
} from '@/src/schemas/whatsapp-connection.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdAiClassificationDTO,
  SdAiConversationDTO,
  SdAiOpenedTicketDTO,
  SdAiPreServiceReplyDTO,
  SdAiTextDTO,
  SdTicketWhatsappDTO,
  SdWhatsappConnectionDTO,
  SdWhatsappConnectionTestDTO,
  SdWhatsappConversationDTO,
  SdWhatsappQrCodeDTO,
  SdWhatsappTemplateDTO,
} from '../../schemas/servicedesk/whatsapp-ai'
import { WhatsAppMessageDTO } from '../../schemas/whatsapp'

/**
 * ServiceDesk · WhatsApp e agente de IA —
 * `app/api/workspaces/[id]/servicedesk/{whatsapp,ai}/**`. As conexões são
 * `WhatsAppConnection` com `module = SERVICE_DESK` (independentes do módulo
 * Comunicação) e só admins do ServiceDesk as administram; a aba do chamado e
 * o copiloto são de agentes; o pré-atendimento é do solicitante.
 */

const WHATSAPP = 'ServiceDesk · WhatsApp' as const
const AI = 'ServiceDesk · Agente de IA' as const

const whatsapp = '/workspaces/{id}/servicedesk/whatsapp'
const waTicket = `${whatsapp}/tickets/{ticketId}`
const ai = '/workspaces/{id}/servicedesk/ai'
const aiTicket = `${ai}/tickets/{ticketId}`

const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`INC-000123`).',
}
const CONNECTION_PARAM = { connectionId: 'Id da conexão de WhatsApp.' }
const CONVERSATION_PARAM = {
  conversationId: 'Id da conversa de pré-atendimento (`SdAiConversation`).',
}

const MEMBER_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]

/** Administração das conexões: admin do ServiceDesk (OWNER/ADMIN passam). */
const ADMIN_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  {
    code: 'FORBIDDEN',
    message:
      'Apenas administradores do ServiceDesk podem alterar a configuração',
    when: 'Agente ou solicitante sem perfil de admin do módulo',
  },
]

const CONNECTION_NOT_FOUND: ErrorEntry = {
  code: 'WHATSAPP_CONNECTION_NOT_FOUND',
  when: 'Conexão inexistente ou de outro módulo (Comunicação)',
}

/** Aba do chamado e copiloto: agente do módulo com acesso ao chamado. */
const AGENT_TICKET_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
  'SD_TICKET_NOT_FOUND',
  { code: 'SD_TICKET_FORBIDDEN', when: 'Sem acesso a este chamado' },
]

const AI_ERRORS: ErrorEntry[] = [
  { code: 'SD_AI_DISABLED', when: '`aiEnabled` desligado nas configurações' },
  {
    code: 'AI_QUOTA_EXCEEDED',
    when: 'Cota mensal de IA do workspace esgotada',
  },
  {
    code: 'AI_PROVIDER_UNAVAILABLE',
    when: 'O provedor falhou ou devolveu resposta inutilizável',
  },
]

const COPILOT_ERRORS: ErrorEntry[] = [...AGENT_TICKET_ERRORS, ...AI_ERRORS]

const PRE_SERVICE_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  {
    code: 'SD_AI_DISABLED',
    message: 'O pré-atendimento por IA está desativado',
    when: '`aiEnabled` ou `aiPreServiceEnabled` desligado',
  },
  { code: 'SD_PORTAL_DISABLED', when: 'Portal do solicitante desligado' },
  {
    code: 'SD_AI_CONVERSATION_NOT_FOUND',
    when: 'Conversa inexistente, de outro usuário ou de outro canal',
  },
  { code: 'SD_AI_CONVERSATION_CLOSED', when: 'Conversa já encerrada' },
  ...AI_ERRORS,
]

const SEND_ERRORS: ErrorEntry[] = [
  ...AGENT_TICKET_ERRORS,
  { code: 'SD_TICKET_CLOSED', when: 'Chamado fechado ou cancelado' },
  {
    code: 'SD_WHATSAPP_CONVERSATION_NOT_FOUND',
    when: 'O chamado não tem conversa vinculada',
  },
]

function agentAccess(action: string): string {
  return `Acesso: sessão + membro com o módulo **ServiceDesk** habilitado e a permissão \`sd-tickets\` × \`${action}\` (OWNER/ADMIN sempre passam). Só agentes (membros de um departamento).`
}

const ADMIN_ACCESS =
  'Acesso: sessão + **admin do ServiceDesk** (OWNER/ADMIN do workspace ou perfil administrativo do módulo) com o módulo habilitado.'

/* ------------------------------- conexões -------------------------------- */

const connectionRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${whatsapp}/connections`,
    tags: [WHATSAPP],
    summary: 'Listar conexões de WhatsApp do ServiceDesk',
    description: `Conexões com \`module = SERVICE_DESK\`, com o caminho do webhook a configurar no provedor e qual delas é a ativa. Credenciais nunca voltam. ${ADMIN_ACCESS}`,
    responses: {
      200: {
        description: 'Conexões.',
        schema: z.array(SdWhatsappConnectionDTO),
      },
    },
    errors: ADMIN_ERRORS,
  },
  {
    method: 'post',
    path: `${whatsapp}/connections`,
    tags: [WHATSAPP],
    summary: 'Cadastrar conexão de WhatsApp',
    description: `Z-API (instância + token) ou Meta Cloud API (phone number id + WABA + access token). As credenciais são cifradas com \`CONNECTION_SECRETS\`. A **primeira** conexão criada vira a ativa do módulo. Auditado. ${ADMIN_ACCESS}`,
    consent: true,
    body: CreateWhatsAppConnectionSchema,
    responses: {
      201: { description: 'Criada.', schema: SdWhatsappConnectionDTO },
    },
    errors: ADMIN_ERRORS,
  },
  {
    method: 'patch',
    path: `${whatsapp}/connections/{connectionId}`,
    tags: [WHATSAPP],
    summary: 'Atualizar conexão de WhatsApp',
    description: `Renomeia ou troca as credenciais (recifradas). Auditado. ${ADMIN_ACCESS}`,
    params: CONNECTION_PARAM,
    consent: true,
    body: UpdateWhatsAppConnectionSchema,
    responses: {
      200: { description: 'Atualizada.', schema: SdWhatsappConnectionDTO },
    },
    errors: [...ADMIN_ERRORS, CONNECTION_NOT_FOUND],
  },
  {
    method: 'delete',
    path: `${whatsapp}/connections/{connectionId}`,
    tags: [WHATSAPP],
    summary: 'Remover conexão de WhatsApp',
    description: `Se era a ativa, o ServiceDesk fica sem WhatsApp (\`whatsappConnectionId\` volta a \`null\`). Auditado. ${ADMIN_ACCESS}`,
    params: CONNECTION_PARAM,
    consent: true,
    responses: { 200: 'Removida (`data: null`).' },
    errors: [...ADMIN_ERRORS, CONNECTION_NOT_FOUND],
  },
  {
    method: 'post',
    path: `${whatsapp}/connections/{connectionId}/test`,
    tags: [WHATSAPP],
    summary: 'Testar a conexão no provedor',
    description: `Consulta o provedor e grava o resultado em \`status\`/\`statusError\`. Auditado. ${ADMIN_ACCESS}`,
    params: CONNECTION_PARAM,
    consent: true,
    responses: {
      200: {
        description: 'Resultado do teste.',
        schema: SdWhatsappConnectionTestDTO,
      },
    },
    errors: [...ADMIN_ERRORS, CONNECTION_NOT_FOUND],
  },
  {
    method: 'get',
    path: `${whatsapp}/connections/{connectionId}/qr-code`,
    tags: [WHATSAPP],
    summary: 'QR code da Z-API',
    description: `Imagem para parear o número. Só conexões Z-API — na Meta responde 400. ${ADMIN_ACCESS}`,
    params: CONNECTION_PARAM,
    responses: {
      200: {
        description: 'QR code ou já conectado.',
        schema: SdWhatsappQrCodeDTO,
      },
    },
    errors: [
      ...ADMIN_ERRORS,
      CONNECTION_NOT_FOUND,
      {
        code: 'BAD_REQUEST',
        message: 'QR code está disponível apenas para conexões Z-API',
        when: 'Conexão Meta, sem credenciais ou falha no provedor',
      },
    ],
  },
]

/* -------------------------- aba WhatsApp do chamado ----------------------- */

const ticketWhatsappRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${whatsapp}/conversations`,
    tags: [WHATSAPP],
    summary: 'Listar conversas do WhatsApp do ServiceDesk',
    description: `Conversas das conexões do módulo, mais recentes primeiro, para vincular a um chamado. \`?q=\` busca por nome do contato ou número. ${agentAccess('VIEW')}`,
    query: SdWhatsappConversationsQuerySchema,
    responses: {
      200: {
        description: 'Conversas.',
        schema: z.array(SdWhatsappConversationDTO),
      },
    },
    errors: [
      ...MEMBER_ERRORS,
      { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
    ],
  },
  {
    method: 'get',
    path: waTicket,
    tags: [WHATSAPP],
    summary: 'Estado da aba WhatsApp do chamado',
    description: `Conexão ativa do módulo, conversa vinculada, janela de 24 h da Meta e o número sugerido (WhatsApp do contato do chamado). ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Estado da aba.', schema: SdTicketWhatsappDTO },
    },
    errors: AGENT_TICKET_ERRORS,
  },
  {
    method: 'delete',
    path: waTicket,
    tags: [WHATSAPP],
    summary: 'Desvincular a conversa do chamado',
    description: `As mensagens já espelhadas no histórico continuam lá. Gera o evento \`whatsapp.unlinked\`. Auditado. ${agentAccess('EDIT')}`,
    params: TICKET_PARAM,
    consent: true,
    responses: {
      200: {
        description: 'Estado da aba sem conversa.',
        schema: SdTicketWhatsappDTO,
      },
    },
    errors: [
      ...AGENT_TICKET_ERRORS,
      {
        code: 'SD_WHATSAPP_CONVERSATION_NOT_FOUND',
        when: 'O chamado não tem conversa vinculada',
      },
    ],
  },
  {
    method: 'post',
    path: `${waTicket}/link`,
    tags: [WHATSAPP],
    summary: 'Vincular uma conversa ao chamado',
    description: `A conversa precisa ser de uma conexão do ServiceDesk. Gera o evento \`whatsapp.linked\`. Auditado. ${agentAccess('EDIT')}`,
    params: TICKET_PARAM,
    consent: true,
    body: SdWhatsappLinkSchema,
    responses: {
      200: { description: 'Estado da aba.', schema: SdTicketWhatsappDTO },
    },
    errors: [
      ...AGENT_TICKET_ERRORS,
      {
        code: 'SD_WHATSAPP_CONVERSATION_NOT_FOUND',
        message: 'Conversa não encontrada',
        when: 'Conversa inexistente ou de uma conexão de outro módulo',
      },
    ],
  },
  {
    method: 'post',
    path: `${waTicket}/start`,
    tags: [WHATSAPP],
    summary: 'Iniciar (ou retomar) a conversa com um número',
    description: `Sem \`waId\`, usa o WhatsApp do contato do chamado. Reaproveita a conversa ativa do contato na conexão e vincula ao chamado (a IA não responde nessa conversa: entra como atendimento humano). ${agentAccess('EDIT')}`,
    params: TICKET_PARAM,
    consent: true,
    body: SdWhatsappStartSchema,
    responses: {
      201: { description: 'Estado da aba.', schema: SdTicketWhatsappDTO },
    },
    errors: [
      ...AGENT_TICKET_ERRORS,
      {
        code: 'SD_WHATSAPP_NOT_CONFIGURED',
        when: 'Nenhuma conexão ativa no módulo',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'Informe o número do WhatsApp (com DDI e DDD)',
        when: 'Sem `waId` e o contato do chamado não tem WhatsApp',
      },
    ],
  },
  {
    method: 'get',
    path: `${waTicket}/messages`,
    tags: [WHATSAPP],
    summary: 'Listar mensagens da conversa do chamado',
    description: `Das mais novas para as mais antigas (\`?cursor=<messageId>&limit=50\`). Sem conversa vinculada, lista vazia. ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    query: SdWhatsappMessagesQuerySchema,
    responses: {
      200: { description: 'Mensagens.', schema: z.array(WhatsAppMessageDTO) },
    },
    errors: AGENT_TICKET_ERRORS,
  },
  {
    method: 'post',
    path: `${waTicket}/messages`,
    tags: [WHATSAPP],
    summary: 'Enviar texto pelo WhatsApp do chamado',
    description: `Texto livre: na Meta, só dentro da janela de 24 h desde a última mensagem do contato (fora dela, use o modelo). A mensagem é espelhada no histórico como resposta pública do agente (canal WHATSAPP), marca a primeira resposta do SLA e tira a IA da conversa. Auditado. ${agentAccess('EDIT')}`,
    params: TICKET_PARAM,
    consent: true,
    body: SdWhatsappSendTextSchema,
    responses: {
      201: { description: 'Mensagem enviada.', schema: WhatsAppMessageDTO },
    },
    errors: [
      ...SEND_ERRORS,
      {
        code: 'SD_WHATSAPP_WINDOW_CLOSED',
        when: 'Janela de 24 h fechada (Meta) — só modelo aprovado',
      },
      { code: 'WHATSAPP_PROVIDER_ERROR', when: 'O provedor recusou o envio' },
    ],
  },
  {
    method: 'post',
    path: `${waTicket}/media`,
    tags: [WHATSAPP],
    summary: 'Enviar arquivo pelo WhatsApp do chamado',
    description: `Multipart com o campo \`file\` (imagem, vídeo, áudio ou documento, até 16 MB) e \`caption\` opcional. O arquivo vai para o bucket de mídia do WhatsApp. Mesmas regras de janela do texto. ${agentAccess('EDIT')}`,
    params: TICKET_PARAM,
    rateLimit: 'upload',
    consent: true,
    body: {
      contentType: 'multipart/form-data',
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Arquivo (até 16 MB).',
          },
          caption: { type: 'string', description: 'Legenda (até 1024).' },
        },
      },
    },
    responses: {
      201: { description: 'Mensagem enviada.', schema: WhatsAppMessageDTO },
    },
    errors: [
      ...SEND_ERRORS,
      {
        code: 'BAD_REQUEST',
        message: 'Envie o arquivo no campo "file"',
        when: 'Multipart sem o campo `file` ou maior que o limite',
      },
      {
        code: 'VALIDATION_ERROR',
        message: 'Tipo de arquivo não suportado',
        when: 'MIME fora da lista, arquivo vazio ou acima de 16 MB',
      },
      {
        code: 'SD_WHATSAPP_WINDOW_CLOSED',
        when: 'Janela de 24 h fechada (Meta)',
      },
      { code: 'WHATSAPP_PROVIDER_ERROR', when: 'O provedor recusou o envio' },
    ],
  },
  {
    method: 'post',
    path: `${waTicket}/template`,
    tags: [WHATSAPP],
    summary: 'Enviar modelo aprovado pelo WhatsApp do chamado',
    description: `O único envio possível fora da janela de 24 h da Meta. ${agentAccess('EDIT')}`,
    params: TICKET_PARAM,
    consent: true,
    body: SdWhatsappSendTemplateSchema,
    responses: {
      201: { description: 'Mensagem enviada.', schema: WhatsAppMessageDTO },
    },
    errors: [
      ...SEND_ERRORS,
      { code: 'WHATSAPP_PROVIDER_ERROR', when: 'O provedor recusou o envio' },
    ],
  },
  {
    method: 'get',
    path: `${waTicket}/templates`,
    tags: [WHATSAPP],
    summary: 'Listar modelos aprovados',
    description: `Modelos \`APPROVED\` da conexão da conversa vinculada (ou da conexão ativa). Sem conexão, lista vazia. ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Modelos.', schema: z.array(SdWhatsappTemplateDTO) },
    },
    errors: AGENT_TICKET_ERRORS,
  },
]

/* --------------------------------- copiloto ------------------------------- */

const copilotRoutes: RouteConfig[] = [
  {
    method: 'post',
    path: `${aiTicket}/summary`,
    tags: [AI],
    summary: 'Resumir o chamado (copiloto)',
    description: `Resumo para quem vai assumir o chamado, gravado em \`aiSummary\` e registrado como evento \`ai.summary\`. Consome a cota de IA do workspace (ADR 0007). O contexto enviado ao provedor tem dados pessoais mascarados. ${agentAccess('EDIT')}`,
    params: TICKET_PARAM,
    consent: true,
    responses: { 200: { description: 'Resumo.', schema: SdAiTextDTO } },
    errors: COPILOT_ERRORS,
  },
  {
    method: 'post',
    path: `${aiTicket}/reply`,
    tags: [AI],
    summary: 'Sugerir a próxima resposta pública (copiloto)',
    description: `Texto pronto para o agente revisar e enviar; \`instructions\` orienta o tom ou o conteúdo. Não envia nada por conta própria. ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    consent: true,
    body: { schema: SdAiReplyRequestSchema, required: false },
    responses: { 200: { description: 'Sugestão.', schema: SdAiTextDTO } },
    errors: COPILOT_ERRORS,
  },
  {
    method: 'post',
    path: `${aiTicket}/solution`,
    tags: [AI],
    summary: 'Rascunhar a solução (copiloto)',
    description: `Texto para o campo "Solução" (causa, o que foi feito, como validar). ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    consent: true,
    responses: { 200: { description: 'Rascunho.', schema: SdAiTextDTO } },
    errors: COPILOT_ERRORS,
  },
  {
    method: 'post',
    path: `${aiTicket}/classification`,
    tags: [AI],
    summary: 'Sugerir a classificação do chamado (copiloto)',
    description: `Catálogo (categoria > subcategoria > serviço), impacto, urgência, prioridade, departamento e tags — só ids que existem no catálogo do workspace e formam um caminho válido. Apenas sugere: aplicar é com \`PATCH /workspaces/{id}/servicedesk/tickets/{ticketId}\`. ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    consent: true,
    responses: {
      200: { description: 'Sugestões.', schema: SdAiClassificationDTO },
    },
    errors: COPILOT_ERRORS,
  },
  {
    method: 'get',
    path: `${aiTicket}/chat`,
    tags: [AI],
    summary: 'Conversa do copiloto neste chamado',
    description: `Histórico da conversa deste agente com o copiloto (uma por agente e chamado); \`null\` quando ainda não existe. ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    responses: {
      200: {
        description: 'Conversa ou `null`.',
        schema: SdAiConversationDTO.nullable(),
      },
    },
    errors: COPILOT_ERRORS,
  },
  {
    method: 'post',
    path: `${aiTicket}/chat`,
    tags: [AI],
    summary: 'Perguntar ao copiloto sobre o chamado',
    description: `Pergunta livre com o chamado e a base de conhecimento como contexto. Cria a conversa na primeira mensagem. ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    consent: true,
    body: SdAiChatMessageSchema,
    responses: {
      201: {
        description: 'Conversa com a resposta.',
        schema: SdAiConversationDTO,
      },
    },
    errors: COPILOT_ERRORS,
  },
  {
    method: 'delete',
    path: `${aiTicket}/chat`,
    tags: [AI],
    summary: 'Limpar a conversa do copiloto',
    description: `Apaga a conversa deste agente neste chamado. Sem conversa, responde 200 do mesmo jeito. ${agentAccess('VIEW')}`,
    params: TICKET_PARAM,
    consent: true,
    responses: { 200: 'Limpa (`data: null`).' },
    errors: COPILOT_ERRORS,
  },
]

/* ----------------------------- pré-atendimento ---------------------------- */

const preServiceRoutes: RouteConfig[] = [
  {
    method: 'post',
    path: `${ai}/pre-service`,
    tags: [AI],
    summary: 'Conversar com o pré-atendimento (portal)',
    description:
      'Uma mensagem do solicitante. Sem `conversationId`, começa uma conversa nova. A IA responde com a base de conhecimento, cita artigos, indica a próxima ação (`answer`, `collect_info`, `resolved`, `open_ticket`) e mantém o rascunho do chamado. Palavras de transbordo (`aiHandoffKeywords`) pulam a chamada ao provedor e já sugerem abrir o chamado. Acesso: sessão + membro com o módulo **ServiceDesk** habilitado; solicitantes precisam do portal ligado.',
    consent: true,
    body: SdAiPreServiceMessageSchema,
    responses: {
      201: { description: 'Turno da IA.', schema: SdAiPreServiceReplyDTO },
    },
    errors: PRE_SERVICE_ERRORS,
  },
  {
    method: 'post',
    path: `${ai}/pre-service/{conversationId}/ticket`,
    tags: [AI],
    summary: 'Abrir o chamado do pré-atendimento',
    description:
      'Cria o chamado (canal `PORTAL`) com o rascunho da IA, sobrescrito pelo que o solicitante editar, e grava a transcrição como primeira mensagem (autor IA). Se o catálogo sugerido não servir ao tipo, o chamado é aberto sem catálogo. Dispara as automações `TICKET_CREATED`. Auditado.',
    params: CONVERSATION_PARAM,
    consent: true,
    body: { schema: SdAiPreServiceOpenTicketSchema, required: false },
    responses: {
      201: { description: 'Chamado aberto.', schema: SdAiOpenedTicketDTO },
    },
    errors: [
      ...PRE_SERVICE_ERRORS,
      {
        code: 'SD_TICKET_FORBIDDEN',
        message: 'Este tipo de chamado não pode ser aberto pelo portal',
        when: '`type` fora de `portalTicketTypes`',
      },
    ],
  },
  {
    method: 'post',
    path: `${ai}/pre-service/{conversationId}/close`,
    tags: [AI],
    summary: 'Encerrar o pré-atendimento sem chamado',
    description:
      'Marca o desfecho da conversa: `resolved_by_kb` (resolvido por um artigo) ou `abandoned` (desistência). Alimenta a métrica de desvio de chamados.',
    params: CONVERSATION_PARAM,
    consent: true,
    body: SdAiPreServiceCloseSchema,
    responses: {
      200: { description: 'Conversa encerrada.', schema: SdAiConversationDTO },
    },
    errors: PRE_SERVICE_ERRORS,
  },
]

export const sdWhatsappAiRoutes: RouteConfig[] = [
  ...connectionRoutes,
  ...ticketWhatsappRoutes,
  ...copilotRoutes,
  ...preServiceRoutes,
]
