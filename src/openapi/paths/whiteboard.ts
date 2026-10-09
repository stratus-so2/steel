import { z } from 'zod'
import {
  ArchiveWhiteboardSchema,
  CreateWhiteboardSchema,
  CreateWhiteboardVersionSchema,
  ListWhiteboardsSchema,
  SaveWhiteboardSceneSchema,
  UpdateWhiteboardSchema,
  UpdateWhiteboardSettingsSchema,
  WhiteboardSceneSchema,
} from '@/src/schemas/whiteboard.schema'
import {
  dto,
  WORKSPACE_MEMBER_ERRORS,
  WORKSPACE_PRIVILEGED_ERRORS,
} from '../common'
import type { ErrorEntry, OpenApiRegistry, RouteConfig } from '../registry'

/**
 * Quadro-branco (Excalidraw). Tudo passa por `assertWhiteboardMember`:
 * membro do workspace **e** Quadro-branco ligado. VIEWER só lê.
 */

const dateTime = () => z.iso.datetime()
const Person = z.object({ id: z.string(), name: z.string() }).nullable()

const Scene = WhiteboardSceneSchema.meta({
  description:
    'Cena do Excalidraw: elementos, recorte do appState (fundo, grade, viewport) e referências dos arquivos (sem base64).',
})

const summaryShape = {
  id: z.string(),
  workspaceId: z.string(),
  title: z.string().meta({ example: 'Retro da sprint' }),
  revision: z.number().int(),
  thumbnailUrl: z.string().nullable(),
  createdBy: Person,
  updatedBy: Person,
  archivedAt: dateTime().nullable(),
  editedAt: dateTime(),
  createdAt: dateTime(),
}

const Lock = z
  .object({
    holder: z.object({ id: z.string(), name: z.string() }),
    until: dateTime(),
  })
  .nullable()

const WhiteboardSummaryDTO = dto('WhiteboardSummary', z.object(summaryShape))
const WhiteboardDTO = dto(
  'Whiteboard',
  z.object({ ...summaryShape, scene: Scene, lock: Lock }),
)
const LockStateDTO = dto(
  'WhiteboardLockState',
  z.object({
    canEdit: z.boolean(),
    readOnlyRole: z.boolean(),
    lock: Lock,
  }),
)
const SaveResultDTO = dto(
  'WhiteboardSaveResult',
  z.object({
    revision: z.number().int(),
    editedAt: dateTime(),
    versionCreated: z.boolean(),
  }),
)
const versionShape = {
  id: z.string(),
  whiteboardId: z.string(),
  kind: z.enum(['AUTO', 'MANUAL', 'RESTORE']),
  name: z.string().nullable(),
  revision: z.number().int(),
  elementCount: z.number().int(),
  restoredFromId: z.string().nullable(),
  createdBy: Person,
  createdAt: dateTime(),
}
const VersionSummaryDTO = dto(
  'WhiteboardVersionSummary',
  z.object(versionShape),
)
const VersionDTO = dto(
  'WhiteboardVersion',
  z.object({ ...versionShape, scene: Scene }),
)
const SettingsDTO = dto(
  'WhiteboardSettings',
  z.object({ enabled: z.boolean() }),
)

const WS = { id: 'ID do workspace.' }
const BOARD = { ...WS, whiteboardId: 'ID do quadro.' }
const VERSION = { ...BOARD, versionId: 'ID da versão.' }

const MEMBER_ERRORS: ErrorEntry[] = [
  ...WORKSPACE_MEMBER_ERRORS,
  { code: 'WHITEBOARD_DISABLED', when: 'O Quadro-branco está desligado' },
]
const EDIT_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  {
    code: 'WHITEBOARD_FORBIDDEN',
    when: 'VIEWER, quadro arquivado ou de outro workspace',
  },
]
const BOARD_ERRORS: ErrorEntry[] = [...EDIT_ERRORS, 'WHITEBOARD_NOT_FOUND']
const binary = (description: string, contentType: string) => ({
  description,
  envelope: false,
  contentType,
  schema: { type: 'string', format: 'binary' },
})

const T: ['Quadro-branco'] = ['Quadro-branco']

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/whiteboard/settings',
    tags: T,
    summary: 'Ler o interruptor do Quadro-branco',
    params: WS,
    responses: { 200: { description: 'Estado.', schema: SettingsDTO } },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/whiteboard/settings',
    tags: T,
    summary: 'Ligar/desligar o Quadro-branco',
    description: 'Só OWNER/ADMIN.',
    params: WS,
    consent: true,
    body: UpdateWhiteboardSettingsSchema,
    responses: { 200: { description: 'Estado salvo.', schema: SettingsDTO } },
    errors: WORKSPACE_PRIVILEGED_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/whiteboards',
    tags: T,
    summary: 'Listar quadros',
    description:
      'Mais recentemente editados primeiro (até 200), sem a cena. `archived=true` lista os arquivados; `q` filtra pelo título.',
    params: WS,
    query: ListWhiteboardsSchema,
    responses: {
      200: { description: 'Quadros.', schema: z.array(WhiteboardSummaryDTO) },
    },
    errors: MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whiteboards',
    tags: T,
    summary: 'Criar quadro',
    params: WS,
    consent: true,
    body: CreateWhiteboardSchema,
    responses: {
      201: { description: 'Quadro criado.', schema: WhiteboardDTO },
    },
    errors: EDIT_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}',
    tags: T,
    summary: 'Abrir quadro',
    description: 'Com a cena e a trava de edição ativa (se houver).',
    params: BOARD,
    responses: { 200: { description: 'Quadro.', schema: WhiteboardDTO } },
    errors: BOARD_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}',
    tags: T,
    summary: 'Renomear quadro',
    params: BOARD,
    consent: true,
    body: UpdateWhiteboardSchema,
    responses: { 200: { description: 'Quadro salvo.', schema: WhiteboardDTO } },
    errors: BOARD_ERRORS,
  },
  {
    method: 'put',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/scene',
    tags: T,
    summary: 'Salvar a cena (autosave)',
    description:
      'Grava só se `baseRevision` for a revisão atual e a trava de edição estiver livre para quem salva (renova a trava). A cada 10 min ou 100 salvamentos corta uma versão automática.',
    params: BOARD,
    consent: true,
    body: SaveWhiteboardSceneSchema,
    responses: { 200: { description: 'Cena salva.', schema: SaveResultDTO } },
    errors: [
      ...BOARD_ERRORS,
      { code: 'WHITEBOARD_LOCKED', when: 'Outra pessoa está editando' },
      { code: 'WHITEBOARD_REVISION_CONFLICT', when: 'Revisão desatualizada' },
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/duplicate',
    tags: T,
    summary: 'Duplicar quadro',
    description:
      'Novo quadro com a mesma cena, título "(cópia)" e sem histórico.',
    params: BOARD,
    consent: true,
    responses: { 201: { description: 'Cópia criada.', schema: WhiteboardDTO } },
    errors: BOARD_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/archive',
    tags: T,
    summary: 'Arquivar ou restaurar quadro',
    description:
      'MEMBER arquiva os quadros que criou; OWNER/ADMIN, qualquer um. Nada é apagado.',
    params: BOARD,
    consent: true,
    body: ArchiveWhiteboardSchema,
    responses: { 200: { description: 'Quadro salvo.', schema: WhiteboardDTO } },
    errors: BOARD_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/lock',
    tags: T,
    summary: 'Pegar/renovar a trava de edição',
    description:
      'Trava de 60 s renovada pelo canvas aberto. Quem não consegue a trava (ou é VIEWER) abre em modo leitura.',
    params: BOARD,
    responses: {
      200: { description: 'Estado da trava.', schema: LockStateDTO },
    },
    errors: BOARD_ERRORS,
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/lock',
    tags: T,
    summary: 'Soltar a trava de edição',
    params: BOARD,
    responses: {
      200: {
        description: 'Trava solta (ou já não era sua).',
        schema: z.object({ released: z.boolean() }),
      },
    },
    errors: BOARD_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/versions',
    tags: T,
    summary: 'Histórico de versões',
    params: BOARD,
    responses: {
      200: { description: 'Versões.', schema: z.array(VersionSummaryDTO) },
    },
    errors: BOARD_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/versions',
    tags: T,
    summary: 'Salvar versão',
    description:
      'Versão MANUAL (opcionalmente nomeada) da cena salva; nunca é podada.',
    params: BOARD,
    consent: true,
    body: CreateWhiteboardVersionSchema,
    responses: {
      201: { description: 'Versão criada.', schema: VersionSummaryDTO },
    },
    errors: BOARD_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/versions/{versionId}',
    tags: T,
    summary: 'Ver versão',
    params: VERSION,
    responses: {
      200: { description: 'Versão com a cena.', schema: VersionDTO },
    },
    errors: [...BOARD_ERRORS, 'WHITEBOARD_VERSION_NOT_FOUND'],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/versions/{versionId}/restore',
    tags: T,
    summary: 'Restaurar versão',
    description:
      'Guarda antes a cena atual (se tiver edições sem versão) e cria uma versão RESTORE — o histórico nunca é apagado.',
    params: VERSION,
    consent: true,
    responses: {
      200: { description: 'Quadro restaurado.', schema: WhiteboardDTO },
    },
    errors: [
      ...BOARD_ERRORS,
      'WHITEBOARD_VERSION_NOT_FOUND',
      { code: 'WHITEBOARD_LOCKED', when: 'Outra pessoa está editando' },
      {
        code: 'WHITEBOARD_REVISION_CONFLICT',
        when: 'O quadro mudou durante a restauração',
      },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/thumbnail',
    tags: T,
    summary: 'Miniatura do quadro',
    params: BOARD,
    responses: { 200: binary('PNG.', 'image/png') },
    errors: [...BOARD_ERRORS, 'WHITEBOARD_FILE_NOT_FOUND', 'STORAGE_ERROR'],
  },
  {
    method: 'put',
    path: '/workspaces/{id}/whiteboards/{whiteboardId}/thumbnail',
    tags: T,
    summary: 'Enviar miniatura',
    description: 'Corpo **binário** PNG até 512 KB.',
    params: BOARD,
    consent: true,
    rateLimit: 'upload',
    body: {
      contentType: 'image/png',
      schema: { type: 'string', format: 'binary' },
      description: 'Bytes do PNG.',
    },
    responses: {
      200: {
        description: 'Miniatura salva.',
        schema: z.object({ thumbnailAt: dateTime() }),
      },
    },
    errors: [...BOARD_ERRORS, 'VALIDATION_ERROR', 'STORAGE_ERROR'],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/whiteboards/files',
    tags: T,
    summary: 'Enviar imagem do canvas',
    description:
      'Multipart com `file` (PNG, JPEG, GIF, WebP ou SVG até 10 MB) e `fileId` (id do arquivo no Excalidraw).',
    params: WS,
    consent: true,
    rateLimit: 'upload',
    body: {
      contentType: 'multipart/form-data',
      schema: {
        type: 'object',
        required: ['file', 'fileId'],
        properties: {
          file: { type: 'string', format: 'binary' },
          fileId: { type: 'string' },
        },
      },
    },
    responses: {
      201: {
        description: 'Imagem salva.',
        schema: z.object({ fileId: z.string() }),
      },
    },
    errors: [...EDIT_ERRORS, 'VALIDATION_ERROR', 'STORAGE_ERROR'],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/whiteboards/files/{fileId}',
    tags: T,
    summary: 'Baixar imagem do canvas',
    params: { ...WS, fileId: 'ID do arquivo no Excalidraw.' },
    responses: { 200: binary('Imagem.', 'image/*') },
    errors: [...MEMBER_ERRORS, 'WHITEBOARD_FILE_NOT_FOUND', 'STORAGE_ERROR'],
  },
]

export function registerWhiteboardPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
