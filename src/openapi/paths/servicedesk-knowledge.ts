import { z } from 'zod'
import {
  CreateSdKbArticleSchema,
  LinkSdKbArticleToTicketSchema,
  ListSdKbArticlesSchema,
  ListSdKbMentionableMembersSchema,
  MoveSdKbArticleSchema,
  SearchSdKbArticlesSchema,
  SetSdKbArticleStatusSchema,
  SuggestSdKbArticlesSchema,
  UpdateSdKbArticleSchema,
  VoteSdKbArticleSchema,
} from '@/src/schemas/sd-kb-article.schema'
import {
  CreateSdKbCommentSchema,
  ResolveSdKbCommentSchema,
  UpdateSdKbCommentSchema,
} from '@/src/schemas/sd-kb-comment.schema'
import type { ErrorEntry, OpenApiRegistry, RouteConfig } from '../registry'
import {
  SdKbArticleDTO,
  SdKbArticleSummaryDTO,
  SdKbCategoryDTO,
  SdKbCommentDTO,
  SdKbMediaDTO,
  SdKbMentionableMemberDTO,
  SdKbSearchResultDTO,
  SdKbViewResultDTO,
  SdKbVoteResultDTO,
  SdTicketKbLinkDTO,
} from '../schemas/servicedesk/knowledge'

/**
 * ServiceDesk · Base de conhecimento —
 * `app/api/workspaces/[id]/servicedesk/knowledge/**` e
 * `.../servicedesk/tickets/[ticketId]/kb-links`.
 */

const TAG = ['ServiceDesk · Base de conhecimento'] as const
const BASE = '/workspaces/{id}/servicedesk/knowledge'
const ARTICLE = `${BASE}/{articleId}`
const ARTICLE_PARAM = { articleId: 'ID do artigo.' }
const COMMENT_PARAMS = { ...ARTICLE_PARAM, commentId: 'ID do comentário.' }

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
  {
    code: 'SD_NOT_AGENT',
    when: 'Solicitante (sem departamento) tentando editar',
  },
]
const NOT_FOUND: ErrorEntry = {
  code: 'SD_KB_ARTICLE_NOT_FOUND',
  when: 'Artigo inexistente, de outro workspace ou (solicitante) fora do portal',
}
const COMMENT_NOT_FOUND: ErrorEntry = {
  code: 'SD_KB_COMMENT_NOT_FOUND',
  when: 'Comentário inexistente ou de outro artigo',
}
const CATEGORY_NOT_FOUND: ErrorEntry = {
  code: 'SD_CATEGORY_NOT_FOUND',
  when: 'Categoria inexistente, inativa ou de outro workspace',
}

const READ =
  'Acesso: sessão + membro com o módulo **ServiceDesk** e `sd-knowledge` × `VIEW`. **Agentes** veem tudo; **solicitantes** só artigos publicados com visibilidade portal.'
function edit(action: 'CREATE' | 'EDIT' | 'DELETE' | 'VIEW'): string {
  return `Acesso: só **agentes** (membros de um departamento ou admins do módulo) com \`sd-knowledge\` × \`${action}\` (OWNER/ADMIN sempre passam).`
}

function d(...parts: string[]): string {
  return parts.join('\n\n')
}

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: BASE,
    tags: [...TAG],
    summary: 'Listar a árvore de artigos',
    description: d(
      'Artigos vivos ordenados por pai e posição (sem o conteúdo). `archived=true` lista a lixeira (só agentes).',
      READ,
    ),
    query: ListSdKbArticlesSchema,
    responses: {
      200: { description: 'Artigos.', schema: z.array(SdKbArticleSummaryDTO) },
    },
    errors: [...SD_ERRORS, 'SD_NOT_AGENT'],
  },
  {
    method: 'post',
    path: BASE,
    tags: [...TAG],
    summary: 'Criar artigo',
    description: d(
      'Cria um rascunho vazio no fim dos irmãos (`parentId` opcional).',
      edit('CREATE'),
    ),
    consent: true,
    body: CreateSdKbArticleSchema,
    responses: {
      201: { description: 'Artigo criado.', schema: SdKbArticleDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      NOT_FOUND,
      CATEGORY_NOT_FOUND,
      { code: 'SD_KB_ARTICLE_MOVE_INVALID', when: 'Pai arquivado' },
    ],
  },
  {
    method: 'get',
    path: `${BASE}/search`,
    tags: [...TAG],
    summary: 'Buscar artigos',
    description: d(
      "Relevância por `to_tsvector('portuguese')` sobre título (peso maior) + texto, mais um bônus quando o termo aparece no título (ILIKE). Sem `q`, os atualizados mais recentemente. Filtros de status/visibilidade valem só para agentes.",
      READ,
    ),
    query: SearchSdKbArticlesSchema,
    responses: {
      200: { description: 'Resultados.', schema: z.array(SdKbSearchResultDTO) },
    },
    errors: SD_ERRORS,
  },
  {
    method: 'get',
    path: `${BASE}/categories`,
    tags: [...TAG],
    summary: 'Categorias com contagem de artigos',
    description: d(
      'Categorias ativas do catálogo com a contagem de artigos visíveis ao leitor.',
      READ,
    ),
    responses: {
      200: { description: 'Categorias.', schema: z.array(SdKbCategoryDTO) },
    },
    errors: SD_ERRORS,
  },
  {
    method: 'get',
    path: `${BASE}/suggest`,
    tags: [...TAG],
    summary: 'Sugerir artigos para um chamado',
    description: d(
      'Artigos publicados que batem com algum termo do título do chamado ou com a categoria/subcategoria/serviço dele.',
      edit('VIEW'),
    ),
    query: SuggestSdKbArticlesSchema,
    responses: {
      200: { description: 'Sugestões.', schema: z.array(SdKbSearchResultDTO) },
    },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND'],
  },
  {
    method: 'get',
    path: `${BASE}/members`,
    tags: [...TAG],
    summary: 'Membros para @menção',
    description: d(
      'Membros do workspace cujo nome contém `q` (até 8).',
      edit('VIEW'),
    ),
    query: ListSdKbMentionableMembersSchema,
    responses: {
      200: {
        description: 'Membros.',
        schema: z.array(SdKbMentionableMemberDTO),
      },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: ARTICLE,
    tags: [...TAG],
    summary: 'Obter artigo',
    description: d('Artigo completo com o voto do leitor (`myVote`).', READ),
    params: ARTICLE_PARAM,
    responses: { 200: { description: 'Artigo.', schema: SdKbArticleDTO } },
    errors: [...SD_ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: ARTICLE,
    tags: [...TAG],
    summary: 'Atualizar artigo (autosave)',
    description: d(
      'Título, ícone, capa, conteúdo (recalcula o texto plano da busca), categoria, visibilidade e tags. O autosave só de conteúdo não é auditado.',
      edit('EDIT'),
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: UpdateSdKbArticleSchema,
    responses: {
      200: { description: 'Artigo salvo.', schema: SdKbArticleDTO },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND, CATEGORY_NOT_FOUND],
  },
  {
    method: 'delete',
    path: ARTICLE,
    tags: [...TAG],
    summary: 'Excluir artigo definitivamente',
    description: d(
      'Apaga o artigo, a subárvore, comentários, vínculos, votos e mídia.',
      edit('DELETE'),
    ),
    consent: true,
    params: ARTICLE_PARAM,
    responses: { 200: { description: 'Excluído.', schema: null } },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: `${ARTICLE}/move`,
    tags: [...TAG],
    summary: 'Mover/reordenar artigo',
    description: d(
      'Muda o pai e a posição entre os irmãos (renumerados). Não aceita o próprio artigo, um descendente ou um destino arquivado.',
      edit('EDIT'),
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: MoveSdKbArticleSchema,
    responses: { 200: { description: 'Movido.', schema: SdKbArticleDTO } },
    errors: [...AGENT_ERRORS, NOT_FOUND, 'SD_KB_ARTICLE_MOVE_INVALID'],
  },
  {
    method: 'patch',
    path: `${ARTICLE}/status`,
    tags: [...TAG],
    summary: 'Publicar ou voltar para rascunho',
    description: d(
      'Publicar carimba `publishedAt`; exige título e artigo não arquivado.',
      edit('EDIT'),
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: SetSdKbArticleStatusSchema,
    responses: {
      200: { description: 'Status salvo.', schema: SdKbArticleDTO },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: `${ARTICLE}/archive`,
    tags: [...TAG],
    summary: 'Arquivar artigo (e subárvore)',
    description: d(
      'Arquiva o artigo e os descendentes com o mesmo carimbo.',
      edit('EDIT'),
    ),
    consent: true,
    params: ARTICLE_PARAM,
    responses: { 200: { description: 'Arquivado.', schema: SdKbArticleDTO } },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: `${ARTICLE}/restore`,
    tags: [...TAG],
    summary: 'Restaurar artigo arquivado',
    description: d(
      'Traz de volta o artigo e o que foi arquivado junto; com o pai ainda arquivado, volta para a raiz.',
      edit('EDIT'),
    ),
    consent: true,
    params: ARTICLE_PARAM,
    responses: { 200: { description: 'Restaurado.', schema: SdKbArticleDTO } },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: `${ARTICLE}/view`,
    tags: [...TAG],
    summary: 'Registrar visualização',
    description: d('Conta uma vez por usuário por dia (Redis).', READ),
    consent: true,
    params: ARTICLE_PARAM,
    responses: {
      200: { description: 'Contagem.', schema: SdKbViewResultDTO },
    },
    errors: [...SD_ERRORS, NOT_FOUND],
  },
  {
    method: 'put',
    path: `${ARTICLE}/vote`,
    tags: [...TAG],
    summary: 'Votar "Este artigo ajudou?"',
    description: d(
      'Um voto por usuário: `true`/`false` grava ou troca, `null` retira.',
      READ,
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: VoteSdKbArticleSchema,
    responses: { 200: { description: 'Totais.', schema: SdKbVoteResultDTO } },
    errors: [
      ...SD_ERRORS,
      NOT_FOUND,
      { code: 'STORAGE_ERROR', when: 'Redis indisponível' },
    ],
  },
  {
    method: 'get',
    path: `${ARTICLE}/related`,
    tags: [...TAG],
    summary: 'Artigos relacionados',
    description: d('Mesma categoria ou alguma tag em comum (até 5).', READ),
    params: ARTICLE_PARAM,
    responses: {
      200: {
        description: 'Relacionados.',
        schema: z.array(SdKbArticleSummaryDTO),
      },
    },
    errors: [...SD_ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: `${ARTICLE}/media`,
    tags: [...TAG],
    summary: 'Enviar mídia do editor',
    description: d(
      'Multipart, campo `file`. Imagem até 10 MB, vídeo 200 MB, áudio 50 MB, documento 25 MB. Guarda no bucket privado `servicedesk` e devolve a URL estável servida pela API.',
      edit('EDIT'),
    ),
    rateLimit: 'upload',
    consent: true,
    params: ARTICLE_PARAM,
    body: {
      contentType: 'multipart/form-data',
      schema: {
        type: 'object',
        properties: { file: { type: 'string', format: 'binary' } },
        required: ['file'],
      },
    },
    responses: { 201: { description: 'Mídia salva.', schema: SdKbMediaDTO } },
    errors: [
      ...AGENT_ERRORS,
      NOT_FOUND,
      'SD_ATTACHMENT_INVALID',
      'BAD_REQUEST',
      'STORAGE_ERROR',
    ],
  },
  {
    method: 'get',
    path: `${ARTICLE}/media/{fileName}`,
    tags: [...TAG],
    summary: 'Baixar mídia do artigo',
    description: d(
      'Arquivo como gravado (mesma regra de leitura do artigo).',
      READ,
    ),
    params: { ...ARTICLE_PARAM, fileName: 'Nome do arquivo (`<cuid>.<ext>`).' },
    responses: {
      200: {
        description: 'Arquivo.',
        envelope: false,
        contentType: 'application/octet-stream',
        schema: { type: 'string', format: 'binary' },
      },
    },
    errors: [...SD_ERRORS, NOT_FOUND, 'SD_ATTACHMENT_NOT_FOUND'],
  },
  {
    method: 'get',
    path: `${ARTICLE}/comments`,
    tags: [...TAG],
    summary: 'Listar comentários do artigo',
    description: d(
      'Discussões do editor (internas dos agentes), por marca e data.',
      edit('VIEW'),
    ),
    params: ARTICLE_PARAM,
    responses: {
      200: { description: 'Comentários.', schema: z.array(SdKbCommentDTO) },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: `${ARTICLE}/comments`,
    tags: [...TAG],
    summary: 'Comentar',
    description: d(
      'Raiz de discussão numa marca do editor ou resposta (`parentId`, que herda a marca da raiz).',
      edit('EDIT'),
    ),
    consent: true,
    params: ARTICLE_PARAM,
    body: CreateSdKbCommentSchema,
    responses: { 201: { description: 'Comentário.', schema: SdKbCommentDTO } },
    errors: [
      ...AGENT_ERRORS,
      NOT_FOUND,
      COMMENT_NOT_FOUND,
      'SD_KB_COMMENT_NESTING_TOO_DEEP',
    ],
  },
  {
    method: 'patch',
    path: `${ARTICLE}/comments/{commentId}`,
    tags: [...TAG],
    summary: 'Editar comentário',
    description: d('Só o autor edita.', edit('EDIT')),
    consent: true,
    params: COMMENT_PARAMS,
    body: UpdateSdKbCommentSchema,
    responses: { 200: { description: 'Comentário.', schema: SdKbCommentDTO } },
    errors: [
      ...AGENT_ERRORS,
      NOT_FOUND,
      COMMENT_NOT_FOUND,
      'SD_KB_COMMENT_FORBIDDEN',
    ],
  },
  {
    method: 'delete',
    path: `${ARTICLE}/comments/{commentId}`,
    tags: [...TAG],
    summary: 'Excluir comentário',
    description: d('O autor ou um admin do módulo.', edit('EDIT')),
    consent: true,
    params: COMMENT_PARAMS,
    responses: { 200: { description: 'Excluído.', schema: null } },
    errors: [
      ...AGENT_ERRORS,
      NOT_FOUND,
      COMMENT_NOT_FOUND,
      'SD_KB_COMMENT_FORBIDDEN',
    ],
  },
  {
    method: 'patch',
    path: `${ARTICLE}/comments/{commentId}/resolve`,
    tags: [...TAG],
    summary: 'Resolver/reabrir discussão',
    description: d('Só a raiz da discussão.', edit('EDIT')),
    consent: true,
    params: COMMENT_PARAMS,
    body: ResolveSdKbCommentSchema,
    responses: { 200: { description: 'Comentário.', schema: SdKbCommentDTO } },
    errors: [
      ...AGENT_ERRORS,
      NOT_FOUND,
      COMMENT_NOT_FOUND,
      'SD_KB_COMMENT_FORBIDDEN',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/servicedesk/tickets/{ticketId}/kb-links',
    tags: [...TAG],
    summary: 'Artigos vinculados ao chamado',
    description: d(
      'Base da aba "Conhecimento" do chamado. Solicitante: só nos chamados que abriu ou em que participa, e só artigos do portal.',
      READ,
    ),
    params: { ticketId: 'ID do chamado.' },
    responses: {
      200: { description: 'Vínculos.', schema: z.array(SdTicketKbLinkDTO) },
    },
    errors: [...SD_ERRORS, 'SD_TICKET_NOT_FOUND', 'SD_TICKET_FORBIDDEN'],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/servicedesk/tickets/{ticketId}/kb-links',
    tags: [...TAG],
    summary: 'Vincular artigo ao chamado',
    description: d(
      'Idempotente.',
      'Acesso: só **agentes** com `sd-tickets` × `EDIT`.',
    ),
    consent: true,
    params: { ticketId: 'ID do chamado.' },
    body: LinkSdKbArticleToTicketSchema,
    responses: { 201: { description: 'Vínculo.', schema: SdTicketKbLinkDTO } },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND', NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/servicedesk/tickets/{ticketId}/kb-links',
    tags: [...TAG],
    summary: 'Desvincular artigo do chamado',
    description: d(
      'Idempotente. O artigo vai na query (`articleId`).',
      'Acesso: só **agentes** com `sd-tickets` × `EDIT`.',
    ),
    consent: true,
    params: { ticketId: 'ID do chamado.' },
    query: LinkSdKbArticleToTicketSchema,
    responses: { 200: { description: 'Desvinculado.', schema: null } },
    errors: [...AGENT_ERRORS, 'SD_TICKET_NOT_FOUND'],
  },
]

export function registerServiceDeskKnowledgePaths(
  registry: OpenApiRegistry,
): void {
  for (const route of routes) registry.registerRoute(route)
}
