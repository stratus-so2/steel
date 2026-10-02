import { z } from 'zod'
import {
  DecideSdKbReviewSchema,
  DraftSdKbArticleFromTicketSchema,
  ListSdKbReviewsSchema,
  MarkSdKbResolvedSchema,
  RequestSdKbReviewSchema,
  SdKbStatsSchema,
  SetSdKbReviewIntervalSchema,
  SuggestSdKbForDraftSchema,
  UpdateSdKbReviewSettingsSchema,
} from '@/src/schemas/sd-kb-review.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdKbDraftFromTicketDTO,
  SdKbReviewDTO,
  SdKbReviewSettingsDTO,
  SdKbReviewStateDTO,
  SdKbSearchResultDTO,
  SdKbStatsDTO,
  SdTicketKbLinkDTO,
} from '../../schemas/servicedesk/knowledge'

/**
 * ServiceDesk · KCS (Knowledge-Centered Service) —
 * `app/api/workspaces/[id]/servicedesk/knowledge/**`: artigo nascido do
 * chamado, ciclo de revisão `DRAFT → IN_REVIEW → PUBLISHED` com validade,
 * métrica de reuso (chamados resolvidos) e a curadoria da base.
 */

const TAG = ['ServiceDesk · Base de conhecimento'] as const
const BASE = '/workspaces/{id}/servicedesk/knowledge'
const ARTICLE_PARAM = { articleId: 'ID do artigo.' }
const REVIEW_PARAM = { reviewId: 'ID da revisão.' }

const SD_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  {
    code: 'MODULE_DISABLED',
    when: 'Módulo ServiceDesk desabilitado no workspace',
  },
]

const AGENT_ERRORS: ErrorEntry[] = [
  ...SD_ERRORS,
  { code: 'SD_NOT_AGENT', when: 'Solicitante (membro sem departamento)' },
]

const ARTICLE_NOT_FOUND: ErrorEntry = {
  code: 'SD_KB_ARTICLE_NOT_FOUND',
  when: 'Artigo inexistente ou de outro workspace',
}

const REVIEW_NOT_FOUND: ErrorEntry = {
  code: 'SD_KB_REVIEW_NOT_FOUND',
  when: 'Revisão inexistente ou de outro workspace',
}

const AGENT_ONLY =
  'Acesso: só **agentes** (membros de um departamento ou admins do módulo) com `sd-knowledge`.'

function d(...parts: string[]): string {
  return parts.join('\n\n')
}

export const sdKcsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${BASE}/reviews`,
    tags: [...TAG],
    summary: 'Listar revisões de artigos',
    description: d(
      'Fila de revisões do workspace, sem artigos arquivados. `mine=true` traz só as revisões em que você é o revisor escolhido.',
      AGENT_ONLY,
    ),
    query: ListSdKbReviewsSchema,
    responses: {
      200: { description: 'Revisões.', schema: z.array(SdKbReviewDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: `${BASE}/{articleId}/reviews`,
    tags: [...TAG],
    summary: 'Estado da revisão do artigo',
    description: d(
      'Validade (a do artigo ou o padrão do workspace), próximo prazo, se está vencida, a revisão pendente e o histórico das decisões.',
      AGENT_ONLY,
    ),
    params: ARTICLE_PARAM,
    responses: {
      200: { description: 'Estado da revisão.', schema: SdKbReviewStateDTO },
    },
    errors: [...AGENT_ERRORS, ARTICLE_NOT_FOUND],
  },
  {
    method: 'post',
    path: `${BASE}/{articleId}/reviews`,
    tags: [...TAG],
    summary: 'Pedir revisão do artigo',
    description: d(
      'Escolhe um **agente** revisor. Rascunho vai para `IN_REVIEW`; artigo já publicado continua no ar durante a revalidação. O revisor é avisado por `kb.review_requested`.',
      'Só o autor do artigo (ou um admin do módulo) pede revisão, e não pode escolher a si mesmo.',
      AGENT_ONLY,
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: RequestSdKbReviewSchema,
    responses: {
      201: { description: 'Artigo em revisão.', schema: SdKbReviewStateDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      ARTICLE_NOT_FOUND,
      {
        code: 'SD_KB_REVIEW_FORBIDDEN',
        when: 'Não é o autor/admin, revisor é você mesmo ou não é agente',
      },
      {
        code: 'SD_KB_REVIEW_CLOSED',
        when: 'Já existe uma revisão pendente deste artigo',
      },
      {
        code: 'VALIDATION_ERROR',
        when: 'Artigo arquivado ou sem título',
      },
    ],
  },
  {
    method: 'patch',
    path: `${BASE}/reviews/{reviewId}`,
    tags: [...TAG],
    summary: 'Aprovar ou pedir mudanças',
    description: d(
      'Decisão do revisor. `APPROVE` publica o artigo, carimba `lastReviewedAt` e agenda `reviewDueAt = agora + validade` (`reviewIntervalDays` no corpo sobrescreve; `null` deixa o artigo sem validade). `REQUEST_CHANGES` exige comentário e devolve o rascunho ao autor — um artigo publicado em revalidação continua publicado. O autor é avisado por `kb.review_decided`.',
      'Só o revisor escolhido ou um admin do módulo decide.',
      AGENT_ONLY,
    ),
    consent: true,
    params: REVIEW_PARAM,
    body: DecideSdKbReviewSchema,
    responses: {
      200: { description: 'Estado da revisão.', schema: SdKbReviewStateDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      REVIEW_NOT_FOUND,
      ARTICLE_NOT_FOUND,
      {
        code: 'SD_KB_REVIEW_FORBIDDEN',
        when: 'Não é o revisor escolhido nem admin',
      },
      { code: 'SD_KB_REVIEW_CLOSED', when: 'Revisão já decidida' },
      { code: 'VALIDATION_ERROR', when: 'Artigo arquivado' },
    ],
  },
  {
    method: 'delete',
    path: `${BASE}/reviews/{reviewId}`,
    tags: [...TAG],
    summary: 'Cancelar a revisão pedida',
    description: d(
      'O autor (ou um admin) desiste: a revisão pendente é apagada e o artigo volta a `DRAFT` (se estava `IN_REVIEW`).',
      AGENT_ONLY,
    ),
    consent: true,
    params: REVIEW_PARAM,
    body: undefined,
    responses: {
      200: { description: 'Estado da revisão.', schema: SdKbReviewStateDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      REVIEW_NOT_FOUND,
      ARTICLE_NOT_FOUND,
      {
        code: 'SD_KB_REVIEW_FORBIDDEN',
        when: 'Não é o autor do artigo nem admin',
      },
      { code: 'SD_KB_REVIEW_CLOSED', when: 'Revisão já decidida' },
    ],
  },
  {
    method: 'patch',
    path: `${BASE}/{articleId}/review-interval`,
    tags: [...TAG],
    summary: 'Validade da revisão do artigo',
    description: d(
      'Validade em dias deste artigo (`null` = sem revisão periódica). Em artigo publicado, o próximo prazo é recalculado a partir da última revisão (ou da publicação).',
      AGENT_ONLY,
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: SetSdKbReviewIntervalSchema,
    responses: {
      200: { description: 'Estado da revisão.', schema: SdKbReviewStateDTO },
    },
    errors: [...AGENT_ERRORS, ARTICLE_NOT_FOUND],
  },
  {
    method: 'get',
    path: `${BASE}/review-settings`,
    tags: [...TAG],
    summary: 'Validade padrão do workspace',
    description: d(
      'Padrão de validade da revisão (`SdSettings.kbReviewIntervalDays`), usado por todo artigo sem validade própria.',
      AGENT_ONLY,
    ),
    responses: {
      200: { description: 'Validade padrão.', schema: SdKbReviewSettingsDTO },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'patch',
    path: `${BASE}/review-settings`,
    tags: [...TAG],
    summary: 'Alterar a validade padrão',
    description: d(
      'Mesma configuração da aba Geral das configurações do módulo.',
      'Acesso: só **admins** do ServiceDesk (`sd-settings:EDIT`, OWNER/ADMIN sempre passam).',
    ),
    consent: true,
    body: UpdateSdKbReviewSettingsSchema,
    responses: {
      200: { description: 'Validade padrão.', schema: SdKbReviewSettingsDTO },
    },
    errors: [
      ...SD_ERRORS,
      {
        code: 'FORBIDDEN',
        message:
          'Apenas administradores do ServiceDesk podem alterar a configuração',
        when: 'Agente ou solicitante sem perfil de admin do módulo',
      },
    ],
  },
  {
    method: 'patch',
    path: `${BASE}/{articleId}/resolved`,
    tags: [...TAG],
    summary: 'Marcar o artigo que resolveu o chamado',
    description: d(
      'Marca (ou desmarca) o vínculo chamado ↔ artigo como o que resolveu: é o que incrementa `reuseCount`. Idempotente — marcar duas vezes conta uma, desmarcar nunca deixa o contador negativo. Marcar um artigo ainda não vinculado cria o vínculo.',
      'Acesso: só **agentes** com `sd-tickets` × `EDIT`.',
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: MarkSdKbResolvedSchema,
    responses: { 200: { description: 'Vínculo.', schema: SdTicketKbLinkDTO } },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND', ARTICLE_NOT_FOUND],
  },
  {
    method: 'get',
    path: `${BASE}/stats`,
    tags: [...TAG],
    summary: 'Curadoria da base (KCS)',
    description: d(
      'Totais (publicados, em revisão, com revisão vencida, sem reuso e chamados resolvidos pela base) e os rankings: mais reusados, com revisão vencida e publicados que nunca resolveram chamado.',
      AGENT_ONLY,
    ),
    query: SdKbStatsSchema,
    responses: {
      200: { description: 'Números da base.', schema: SdKbStatsDTO },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: `${BASE}/suggest/draft`,
    tags: [...TAG],
    summary: 'Sugerir artigos na abertura do chamado',
    description: d(
      'Sugestões para um chamado que ainda não existe: os termos vêm do título e da descrição digitados, mais as categorias escolhidas. É POST porque o texto digitado não cabe bem na query.',
      'Acesso: sessão + membro com o módulo e `sd-knowledge` × `VIEW`. **Solicitantes** só recebem artigos publicados com visibilidade portal.',
    ),
    body: { schema: SuggestSdKbForDraftSchema, required: false },
    responses: {
      200: { description: 'Sugestões.', schema: z.array(SdKbSearchResultDTO) },
    },
    errors: SD_ERRORS,
  },
  {
    method: 'post',
    path: `${BASE}/draft`,
    tags: [...TAG],
    summary: 'Criar artigo a partir do chamado',
    description: d(
      'Abre um **rascunho** no formato KCS (Problema / Ambiente / Causa / Solução / Validação), já vinculado ao chamado (`sourceTicketId`), com título e categoria do chamado. Com IA habilitada no workspace (ADR 0007), as seções vêm escritas pelo provedor do workspace a partir do histórico **público** do chamado, com dados pessoais mascarados (ADR 0006) e consumo lançado na cota mensal; sem IA (desligada, sem cota, provedor fora ou `useAi=false`), o rascunho vem com o esqueleto das seções. O autor sempre edita antes de publicar.',
      AGENT_ONLY,
    ),
    consent: true,
    body: DraftSdKbArticleFromTicketSchema,
    responses: {
      201: { description: 'Rascunho criado.', schema: SdKbDraftFromTicketDTO },
    },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND'],
  },
]
