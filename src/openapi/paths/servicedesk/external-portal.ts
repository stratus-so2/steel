import { z } from 'zod'
import {
  CreateSdPortalMessageSchema,
  CreateSdPortalTicketSchema,
  IssueSdPortalAccessSchema,
  ListSdPortalTicketsSchema,
  OpenSdPortalSessionSchema,
  RequestSdPortalLinkSchema,
  SearchSdPortalKbSchema,
} from '@/src/schemas/sd-portal.schema'
import { SubmitSdTicketCsatSchema } from '@/src/schemas/sd-ticket-csat.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdPortalAccessDTO,
  SdPortalCsatDTO,
  SdPortalFormOptionsDTO,
  SdPortalKbArticleDTO,
  SdPortalKbListDTO,
  SdPortalLinkRequestDTO,
  SdPortalMessageDTO,
  SdPortalSessionDTO,
  SdPortalTicketDetailDTO,
  SdPortalTicketPageDTO,
  SdPortalTicketSummaryDTO,
} from '../../schemas/servicedesk/external-portal'

/**
 * ServiceDesk · **portal do contato externo** — `app/api/servicedesk/portal/**`
 * (público, sem Better Auth) e a emissão/revogação dos links pelo agente em
 * `app/api/workspaces/[id]/servicedesk/portal-access/**`.
 *
 * O contato é um `SdContact` sem conta no Steel. Ele entra por um link
 * mágico (token aleatório guardado como SHA-256, 7 dias, uso único) que abre
 * uma sessão de 12 horas no cookie próprio `sd.portal_session`
 * (`httpOnly`/`secure`/`sameSite=lax`, também guardada como hash).
 *
 * Todo acesso é filtrado **no service** pelo contato e pelas empresas dele
 * (`SdContactCustomer`, conforme `SdSettings.portalCompanyScope`); chamados
 * são resolvidos por código/número dentro desse escopo, nunca por id. Nota
 * interna, custo, peça, aprovação, assinatura, rastreabilidade e SLA não
 * saem por estas rotas.
 */

const PORTAL = 'ServiceDesk · Portal do contato' as const
const DIRECTORY = 'ServiceDesk · Clientes e contatos' as const

const base = '/servicedesk/portal'
const TICKET = `${base}/tickets/{code}`
const CODE_PARAM = {
  code: 'Código (`INC-000123`) ou número (`123`) do chamado. Id não é aceito.',
}

const PUBLIC = { auth: 'public', rateLimit: 'ip' } as const

/** Erros comuns a toda rota que exige a sessão do portal. */
const SESSION_ERRORS: ErrorEntry[] = [
  {
    code: 'SD_PORTAL_SESSION_EXPIRED',
    when: 'Sem o cookie `sd.portal_session`, ou sessão vencida/revogada',
  },
  {
    code: 'SD_PORTAL_CONTACT_INACTIVE',
    when: 'O contato foi desativado ou excluído',
  },
  { code: 'SD_PORTAL_DISABLED', when: 'O workspace desligou o portal' },
  'WORKSPACE_SUSPENDED',
]

const NOT_IN_SCOPE: ErrorEntry = {
  code: 'SD_TICKET_NOT_FOUND',
  when: 'Chamado inexistente **ou fora do escopo do contato** (outra empresa)',
}

const AGENT_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede `sd-contacts`',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
  { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
]

export const sdExternalPortalRoutes: RouteConfig[] = [
  /* ---------------------------- link e sessão ---------------------------- */
  {
    method: 'post',
    path: `${base}/link`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Pedir o link de acesso ao portal',
    description:
      'O contato informa o e-mail e recebe um link mágico por workspace em que é contato ativo com o portal ligado. A resposta é **sempre a mesma**, exista ou não o e-mail — a rota não serve para descobrir clientes. Limitada por IP **e** por e-mail (5/h cada); cada emissão invalida os links pendentes do contato e é auditada (`sd_portal_access` / `create`). O e-mail respeita `MAIL_DRY_RUN`.',
    body: RequestSdPortalLinkSchema,
    responses: {
      200: {
        description: 'Pedido registrado.',
        schema: SdPortalLinkRequestDTO,
      },
    },
  },
  {
    method: 'post',
    path: `${base}/session`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Abrir a sessão do portal com o token do link',
    description:
      'Consome o link (uso único, condição atômica no `UPDATE`) e abre a sessão de 12 horas, devolvendo o cookie `sd.portal_session` (`httpOnly`, `secure`, `sameSite=lax`). Fica no POST de propósito: o GET do link nunca o consome, então o pré-carregador do cliente de e-mail não queima o acesso. Auditado (`sd_portal_session` / `create`).',
    body: OpenSdPortalSessionSchema,
    responses: {
      201: { description: 'Sessão aberta.', schema: SdPortalSessionDTO },
    },
    errors: [
      {
        code: 'SD_PORTAL_LINK_INVALID',
        when: 'Token desconhecido, já usado ou revogado',
      },
      { code: 'SD_PORTAL_LINK_EXPIRED', when: 'Link com mais de 7 dias' },
      {
        code: 'SD_PORTAL_CONTACT_INACTIVE',
        when: 'O contato foi desativado ou excluído',
      },
      { code: 'SD_PORTAL_DISABLED', when: 'O workspace desligou o portal' },
      'WORKSPACE_SUSPENDED',
    ],
  },
  {
    method: 'get',
    path: `${base}/session`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Sessão corrente do portal',
    description:
      'Quem está no portal, em qual workspace, quais empresas ele representa e quais tipos pode abrir.',
    responses: {
      200: { description: 'Sessão.', schema: SdPortalSessionDTO },
    },
    errors: SESSION_ERRORS,
  },
  {
    method: 'delete',
    path: `${base}/session`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Sair do portal',
    description:
      'Encerra a sessão (limpa `sessionHash`) e apaga o cookie. O link já estava consumido: para voltar, o contato pede outro.',
    responses: { 200: 'Sessão encerrada (`data: null`).' },
  },

  /* ------------------------------- chamados ------------------------------ */
  {
    method: 'get',
    path: `${base}/tickets`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Listar os chamados do contato',
    description:
      'Chamados em que o contato é o contato e, com `SdSettings.portalCompanyScope` ligado, os das empresas dele (`SdContactCustomer`). O escopo entra no `WHERE` no service — a query não escolhe de quem são os chamados. `status`: `open` (padrão), `closed` ou `all`; `q` busca por título ou código.',
    query: ListSdPortalTicketsSchema,
    responses: {
      200: {
        description: 'Página de chamados.',
        schema: SdPortalTicketPageDTO,
      },
    },
    errors: SESSION_ERRORS,
  },
  {
    method: 'post',
    path: `${base}/tickets`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Abrir um chamado pelo portal',
    description:
      'Abre com `channel: PORTAL`, o contato como autor e a empresa principal dele já vinculada. O tipo precisa estar em `SdSettings.portalTicketTypes`; modelo e catálogo precisam ser `portalVisible` (o motor confere com `portal: true`), e os campos customizados obrigatórios são validados. Limite de escrita por contato e por IP. Auditado; a rastreabilidade registra `ticket.created` com ator `CONTACT`.',
    body: CreateSdPortalTicketSchema,
    responses: {
      201: { description: 'Chamado aberto.', schema: SdPortalTicketSummaryDTO },
    },
    errors: [
      ...SESSION_ERRORS,
      {
        code: 'SD_TICKET_FORBIDDEN',
        when: 'Tipo não liberado no portal',
      },
      { code: 'SD_PHASE_NOT_FOUND', when: 'O tipo não tem fase inicial ativa' },
      {
        code: 'SD_CATEGORY_NOT_FOUND',
        when: 'Catálogo inexistente ou não visível no portal',
      },
      {
        code: 'SD_CONFIG_NOT_FOUND',
        when: 'Modelo inexistente, inativo ou não visível no portal',
      },
      {
        code: 'SD_CUSTOM_FIELD_INVALID',
        when: 'Campo customizado obrigatório vazio ou valor fora das opções',
      },
    ],
  },
  {
    method: 'get',
    path: TICKET,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Ver um chamado e a conversa',
    description:
      'O chamado é resolvido por **código/número dentro do escopo** do contato, então um chamado de outra empresa responde 404 — não existe IDOR por id adivinhado. O histórico traz só mensagens públicas e vivas, com os anexos presos a elas.',
    params: CODE_PARAM,
    responses: {
      200: { description: 'Chamado.', schema: SdPortalTicketDetailDTO },
    },
    errors: [...SESSION_ERRORS, NOT_IN_SCOPE],
  },
  {
    method: 'post',
    path: `${TICKET}/messages`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Responder no histórico do chamado',
    description:
      'Aceita JSON (`{ body }`) ou `multipart/form-data` com `body` + até 5 campos `files` (25 MB cada, mesmos tipos dos anexos do chamado). A mensagem é sempre **pública**, com `authorKind: CONTACT`; em chamado resolvido, reabre quando `reopenOnRequesterReply` está ligado. Avisa o responsável e os participantes, registra `message.posted` com ator `CONTACT` e dispara as automações de `MESSAGE_RECEIVED`.',
    params: CODE_PARAM,
    body: CreateSdPortalMessageSchema,
    responses: {
      201: { description: 'Mensagem enviada.', schema: SdPortalMessageDTO },
    },
    errors: [
      ...SESSION_ERRORS,
      NOT_IN_SCOPE,
      { code: 'SD_TICKET_FORBIDDEN', when: 'Chamado cancelado' },
      {
        code: 'SD_ATTACHMENT_INVALID',
        when: 'Arquivo vazio, acima de 25 MB ou de tipo não permitido',
      },
      { code: 'STORAGE_ERROR', when: 'Falha ao gravar o anexo no MinIO' },
    ],
  },
  {
    method: 'post',
    path: `${TICKET}/csat`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Avaliar o atendimento (CSAT)',
    description:
      'Nota de 1 a 5 e comentário opcional, só com o chamado resolvido/fechado e uma única vez (condição atômica no `UPDATE`). Registra `csat.submitted` com ator `CONTACT` e é auditado.',
    params: CODE_PARAM,
    body: SubmitSdTicketCsatSchema,
    responses: {
      201: { description: 'Avaliação registrada.', schema: SdPortalCsatDTO },
    },
    errors: [
      ...SESSION_ERRORS,
      NOT_IN_SCOPE,
      {
        code: 'SD_CSAT_NOT_AVAILABLE',
        when: 'Chamado ainda não resolvido/fechado',
      },
      { code: 'SD_CSAT_ALREADY_SUBMITTED', when: 'Chamado já avaliado' },
    ],
  },
  {
    method: 'get',
    path: `${TICKET}/attachments/{attachmentId}`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Baixar um anexo do chamado',
    description:
      'Serve o arquivo do bucket privado. Só sai daqui anexo preso a uma **mensagem pública e viva** do chamado no escopo da sessão — anexo de nota interna ou solto de agente responde 404. `?download=1` força o download; a resposta vai com `nosniff` e CSP `sandbox`.',
    params: {
      ...CODE_PARAM,
      attachmentId: 'Id do anexo.',
    },
    query: z.object({
      download: z
        .enum(['1', 'true', '0', 'false'])
        .optional()
        .meta({ description: '`1`/`true` força o download.' }),
    }),
    queryValidationError: false,
    responses: {
      200: {
        description: 'Conteúdo do arquivo.',
        envelope: false,
        schema: { type: 'string', format: 'binary' },
      },
    },
    errors: [
      ...SESSION_ERRORS,
      NOT_IN_SCOPE,
      {
        code: 'SD_ATTACHMENT_NOT_FOUND',
        when: 'Anexo inexistente, excluído ou de mensagem interna',
      },
      { code: 'STORAGE_ERROR', when: 'Falha ao ler o arquivo no MinIO' },
    ],
  },

  /* -------------------- formulário e conhecimento ----------------------- */
  {
    method: 'get',
    path: `${base}/options`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Opções do formulário de abertura',
    description:
      'Tipos liberados em `portalTicketTypes`, catálogo e modelos marcados como `portalVisible`, urgências e campos customizados com `visibleInPortal`.',
    responses: {
      200: { description: 'Opções.', schema: SdPortalFormOptionsDTO },
    },
    errors: SESSION_ERRORS,
  },
  {
    method: 'get',
    path: `${base}/knowledge`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Base de conhecimento do portal',
    description:
      'Artigos `PUBLISHED` + `PORTAL` do workspace da sessão, com as categorias. Com `?q=` faz a busca (os itens trazem `excerpt` e `rank`).',
    query: SearchSdPortalKbSchema,
    responses: {
      200: { description: 'Artigos e categorias.', schema: SdPortalKbListDTO },
    },
    errors: SESSION_ERRORS,
  },
  {
    method: 'get',
    path: `${base}/knowledge/{articleId}`,
    tags: [PORTAL],
    ...PUBLIC,
    summary: 'Ler um artigo do portal',
    description:
      'Conteúdo Plate do artigo e a contagem de visualização. Rascunho, artigo interno ou arquivado respondem 404 — nunca o conteúdo.',
    params: { articleId: 'Id do artigo.' },
    responses: {
      200: { description: 'Artigo.', schema: SdPortalKbArticleDTO },
    },
    errors: [
      ...SESSION_ERRORS,
      {
        code: 'SD_KB_ARTICLE_NOT_FOUND',
        when: 'Artigo inexistente, rascunho, interno ou arquivado',
      },
    ],
  },

  /* ------------------ emissão e revogação pelo agente ------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/portal-access',
    tags: [DIRECTORY],
    summary: 'Listar os acessos ao portal de um contato',
    description:
      'Últimos 20 links emitidos para o contato (`?contactId=`), com o estado de cada um (`pending`, `active`, `used`, `expired`, `revoked`). Acesso: sessão + **agente** do ServiceDesk com `sd-contacts` × `VIEW`.',
    query: z.object({
      contactId: z.string().meta({ description: 'Id do contato.' }),
    }),
    queryValidationError: false,
    responses: {
      200: { description: 'Acessos.', schema: z.array(SdPortalAccessDTO) },
    },
    errors: [
      ...AGENT_ERRORS,
      {
        code: 'VALIDATION_ERROR',
        message: 'Informe o contato (`contactId`)',
        when: '`contactId` ausente',
      },
      'SD_CONTACT_NOT_FOUND',
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/portal-access',
    tags: [DIRECTORY],
    summary: 'Enviar o acesso ao portal para um contato',
    description:
      'Emite o link mágico (7 dias, uso único) e manda por e-mail para o endereço do contato ou para o `email` informado. Invalida os links pendentes dele. Auditado (`sd_portal_access` / `create`). Acesso: sessão + **agente** com `sd-contacts` × `EDIT`.',
    consent: true,
    body: IssueSdPortalAccessSchema,
    responses: {
      201: { description: 'Acesso enviado.', schema: SdPortalAccessDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      'SD_CONTACT_NOT_FOUND',
      {
        code: 'SD_PORTAL_CONTACT_INACTIVE',
        when: 'Contato inativo ou excluído',
      },
      { code: 'SD_PORTAL_DISABLED', when: 'O workspace desligou o portal' },
      {
        code: 'VALIDATION_ERROR',
        message: 'Este contato não tem e-mail cadastrado',
        when: 'Contato sem e-mail e sem `email` no corpo',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/servicedesk/portal-access/{accessId}',
    tags: [DIRECTORY],
    summary: 'Revogar um acesso ao portal',
    description:
      'O link deixa de valer e a sessão aberta por ele cai na hora. Auditado (`sd_portal_access` / `revoke`). Acesso: sessão + **agente** com `sd-contacts` × `EDIT`.',
    params: { accessId: 'Id do acesso (`SdPortalAccess`).' },
    consent: true,
    responses: {
      200: { description: 'Acesso revogado.', schema: SdPortalAccessDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      {
        code: 'RESOURCE_NOT_FOUND',
        message: 'SdPortalAccess not found',
        when: 'Acesso inexistente, de outro workspace ou já revogado',
      },
    ],
  },
]
