import { z } from 'zod'
import {
  CreateSdOnCallLayerSchema,
  CreateSdOnCallOverrideSchema,
  CreateSdOnCallScheduleSchema,
  ListSdOnCallOverridesSchema,
  ListSdOnCallSchedulesSchema,
  SdOnCallNowSchema,
  SdOnCallTimelineSchema,
  SetSdOnCallParticipantsSchema,
  UpdateSdOnCallLayerSchema,
  UpdateSdOnCallScheduleSchema,
} from '@/src/schemas/sd-oncall.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdOnCallNowDTO,
  SdOnCallOverrideDTO,
  SdOnCallScheduleDTO,
  SdOnCallTimelineDTO,
} from '../../schemas/servicedesk/oncall'

/**
 * ServiceDesk · plantão — `app/api/workspaces/[id]/servicedesk/oncall/**`:
 * escalas (camadas, participantes e trocas), quem está de plantão agora e a
 * linha do tempo. Admin do módulo mantém; agente consulta.
 */

const TAG = 'ServiceDesk · Plantão' as const
const BASE = '/workspaces/{id}/servicedesk/oncall'
const SCHEDULE = `${BASE}/{scheduleId}`
const LAYER = `${SCHEDULE}/layers/{layerId}`

const AGENT =
  'Acesso: sessão + módulo **ServiceDesk** habilitado; só **agentes** (membros de um departamento) e admins do módulo, com `sd-oncall` × `VIEW`.'
const ADMIN =
  'Acesso: sessão + módulo **ServiceDesk** habilitado; só **admins do módulo** (OWNER/ADMIN ou perfil com `sd-settings` × `EDIT`).'

const MEMBER_ERRORS: ErrorEntry[] = [
  { code: 'FORBIDDEN', when: 'Não é membro do workspace' },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]
const AGENT_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
]
const ADMIN_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    message:
      'Apenas administradores do ServiceDesk podem alterar a configuração',
    when: 'Não é membro ou não é admin do módulo',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]
const REF_ERROR: ErrorEntry = {
  code: 'SD_CONFIG_NOT_FOUND',
  when: 'Departamento, calendário ou usuário de outra workspace',
}
const NOT_FOUND: ErrorEntry = 'SD_ONCALL_SCHEDULE_NOT_FOUND'
const LAYER_ERROR: ErrorEntry = {
  code: 'SD_ONCALL_LAYER_INVALID',
  when: 'Camada inexistente ou nível já usado na escala',
}

const SCHEDULE_PARAM = {
  id: 'Id do workspace.',
  scheduleId: 'Id da escala de plantão.',
}
const LAYER_PARAM = {
  ...SCHEDULE_PARAM,
  layerId: 'Id da camada (1 = primeira chamada).',
}

const ROTATION_DOC =
  'O rodízio é determinístico: a âncora é `handoffTime` no dia civil de `rotationStart`, no fuso da escala, e cada período (`DAILY` = 1 dia, `WEEKLY` = 7, `BIWEEKLY` = 14) passa a vez ao próximo participante da camada — contado em dias civis, então o horário de verão não desloca a escala. Uma **troca** vence o rodízio na janela dela. Com `calendarId`, a escala só vale **fora** do expediente: dentro dele quem atende é a fila normal.'

export const sdOnCallRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: BASE,
    tags: [TAG],
    summary: 'Listar escalas de plantão',
    description: `Escalas ativas (ou todas com \`includeInactive=true\`), em ordem alfabética, já com as camadas e os participantes na ordem do rodízio. ${AGENT}`,
    params: { id: 'Id do workspace.' },
    query: ListSdOnCallSchedulesSchema,
    responses: {
      200: { description: 'Escalas.', schema: z.array(SdOnCallScheduleDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: BASE,
    tags: [TAG],
    summary: 'Criar escala de plantão',
    description: `A escala nasce sem camadas — crie ao menos a camada 1 e coloque os participantes. ${ROTATION_DOC}\n\n${ADMIN}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    body: CreateSdOnCallScheduleSchema,
    responses: {
      201: { description: 'Escala criada.', schema: SdOnCallScheduleDTO },
    },
    errors: [...ADMIN_ERRORS, REF_ERROR],
  },
  {
    method: 'get',
    path: SCHEDULE,
    tags: [TAG],
    summary: 'Obter uma escala de plantão',
    description: `A escala com as camadas e os participantes. ${AGENT}`,
    params: SCHEDULE_PARAM,
    responses: {
      200: { description: 'Escala.', schema: SdOnCallScheduleDTO },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: SCHEDULE,
    tags: [TAG],
    summary: 'Atualizar escala de plantão',
    description: `Nome, time, fuso, rodízio, âncora, hora da virada, calendário e ativação. Mexer na âncora ou no rodízio recalcula quem cobre cada período. ${ADMIN}`,
    consent: true,
    params: SCHEDULE_PARAM,
    body: UpdateSdOnCallScheduleSchema,
    responses: {
      200: { description: 'Escala salva.', schema: SdOnCallScheduleDTO },
    },
    errors: [...ADMIN_ERRORS, NOT_FOUND, REF_ERROR],
  },
  {
    method: 'delete',
    path: SCHEDULE,
    tags: [TAG],
    summary: 'Excluir escala de plantão',
    description: `Exclusão lógica: a escala sai das listas e para de valer; as trocas já registradas continuam no histórico. ${ADMIN}`,
    consent: true,
    params: SCHEDULE_PARAM,
    responses: { 200: { description: 'Escala excluída.', schema: null } },
    errors: [...ADMIN_ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: `${SCHEDULE}/layers`,
    tags: [TAG],
    summary: 'Adicionar camada à escala',
    description: `Cada camada tem o seu rodízio: 1 é a primeira chamada, 2 a retaguarda e assim por diante. O nível é único na escala. ${ADMIN}`,
    consent: true,
    params: SCHEDULE_PARAM,
    body: CreateSdOnCallLayerSchema,
    responses: {
      201: {
        description: 'Escala com a camada nova.',
        schema: SdOnCallScheduleDTO,
      },
    },
    errors: [...ADMIN_ERRORS, NOT_FOUND, LAYER_ERROR],
  },
  {
    method: 'patch',
    path: LAYER,
    tags: [TAG],
    summary: 'Renomear camada ou trocar o nível',
    description: `Nome e nível da camada. ${ADMIN}`,
    consent: true,
    params: LAYER_PARAM,
    body: UpdateSdOnCallLayerSchema,
    responses: {
      200: { description: 'Escala salva.', schema: SdOnCallScheduleDTO },
    },
    errors: [...ADMIN_ERRORS, NOT_FOUND, LAYER_ERROR],
  },
  {
    method: 'delete',
    path: LAYER,
    tags: [TAG],
    summary: 'Excluir camada',
    description: `A camada e os participantes dela saem de vez. ${ADMIN}`,
    consent: true,
    params: LAYER_PARAM,
    responses: {
      200: { description: 'Escala salva.', schema: SdOnCallScheduleDTO },
    },
    errors: [...ADMIN_ERRORS, NOT_FOUND, LAYER_ERROR],
  },
  {
    method: 'put',
    path: `${LAYER}/participants`,
    tags: [TAG],
    summary: 'Definir os participantes da camada',
    description: `Substitui a lista inteira: a **ordem do array é a ordem do rodízio**, então o mesmo endpoint adiciona, remove e reordena (é o que a tela faz ao arrastar). Lista vazia deixa a camada sem ninguém — o escalonamento então cai no destino normal da regra. ${ADMIN}`,
    consent: true,
    params: LAYER_PARAM,
    body: SetSdOnCallParticipantsSchema,
    responses: {
      200: { description: 'Escala salva.', schema: SdOnCallScheduleDTO },
    },
    errors: [...ADMIN_ERRORS, NOT_FOUND, LAYER_ERROR, REF_ERROR],
  },
  {
    method: 'get',
    path: `${SCHEDULE}/timeline`,
    tags: [TAG],
    summary: 'Linha do tempo da escala',
    description: `Quem cobre cada período, por camada, a partir de \`from\` (padrão: agora) por \`days\` dias (padrão 14). As bordas são as viradas do rodízio e os limites das trocas; trechos seguidos do mesmo responsável vêm juntos. ${AGENT}`,
    params: SCHEDULE_PARAM,
    query: SdOnCallTimelineSchema,
    responses: {
      200: { description: 'Linha do tempo.', schema: SdOnCallTimelineDTO },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'get',
    path: `${BASE}/now`,
    tags: [TAG],
    summary: 'Quem está de plantão agora',
    description: `Responsável de cada camada no instante pedido (\`at\`, padrão agora). Com \`departmentId\`, devolve só a escala que cobre o time — a do próprio departamento, ou a escala geral da workspace como rede. \`applies\` diz se a escala está valendo: dentro do expediente do calendário quem atende é a fila normal. ${AGENT}`,
    params: { id: 'Id do workspace.' },
    query: SdOnCallNowSchema,
    responses: {
      200: {
        description: 'Plantão por escala.',
        schema: z.array(SdOnCallNowDTO),
      },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: `${BASE}/overrides`,
    tags: [TAG],
    summary: 'Listar trocas de plantão',
    description: `Trocas que ainda não terminaram, em ordem de início. Filtre por escala e por janela (\`from\`/\`to\`). ${AGENT}`,
    params: { id: 'Id do workspace.' },
    query: ListSdOnCallOverridesSchema,
    responses: {
      200: { description: 'Trocas.', schema: z.array(SdOnCallOverrideDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: `${BASE}/overrides`,
    tags: [TAG],
    summary: 'Registrar troca de plantão',
    description: `Quem cobre o plantão nesta janela, no lugar do rodízio. Sem \`layerId\` a troca vale para a escala inteira. Duas trocas que disputam a mesma camada no mesmo período são recusadas. ${ADMIN}`,
    consent: true,
    params: { id: 'Id do workspace.' },
    body: CreateSdOnCallOverrideSchema,
    responses: {
      201: { description: 'Troca registrada.', schema: SdOnCallOverrideDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      NOT_FOUND,
      LAYER_ERROR,
      REF_ERROR,
      {
        code: 'SD_ONCALL_OVERRIDE_OVERLAP',
        when: 'Já existe troca na mesma camada e no mesmo período',
      },
    ],
  },
  {
    method: 'delete',
    path: `${BASE}/overrides/{overrideId}`,
    tags: [TAG],
    summary: 'Excluir troca de plantão',
    description: `A janela volta para o rodízio. ${ADMIN}`,
    consent: true,
    params: {
      id: 'Id do workspace.',
      overrideId: 'Id da troca de plantão.',
    },
    responses: { 200: { description: 'Troca excluída.', schema: null } },
    errors: [...ADMIN_ERRORS, NOT_FOUND],
  },
]
