import { z } from 'zod'
import { OpenSdApprovalRoundSchema } from '@/src/schemas/sd-approval-round.schema'
import {
  CreateSdCabBoardSchema,
  UpdateSdCabBoardSchema,
} from '@/src/schemas/sd-cab-board.schema'
import {
  CreateSdChangeWindowSchema,
  SD_CHANGE_WINDOW_KINDS,
  UpdateSdChangeWindowSchema,
} from '@/src/schemas/sd-change-window.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdApprovalRoundDTO,
  SdApprovalRoundListDTO,
  SdCabBoardDTO,
  SdCabBoardListDTO,
  SdChangeCalendarDTO,
  SdChangeWindowDTO,
  SdChangeWindowListDTO,
  SdTicketChangeScheduleDTO,
} from '../../schemas/servicedesk/change-cab'

/**
 * ServiceDesk · calendário de mudanças e comitê (CAB) — janelas de manutenção
 * e congelamento, o calendário em si, os comitês e as rodadas de aprovação do
 * chamado de mudança.
 */

const CHANGE = 'ServiceDesk · Mudanças e CAB' as const

const base = '/workspaces/{id}/servicedesk'
const ticket = `${base}/tickets/{ticketId}`
const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`CHG-000123`).',
}

const ACCESS_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede `sd-change-calendar`',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
  { code: 'SD_NOT_AGENT', when: 'Solicitante (sem departamento)' },
]

const ADMIN_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é admin do ServiceDesk (`sd-settings:EDIT`, OWNER ou ADMIN)',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
  'VALIDATION_ERROR',
]

const TICKET_ERRORS: ErrorEntry[] = [
  ...ACCESS_ERRORS,
  'SD_TICKET_NOT_FOUND',
  { code: 'SD_TICKET_FORBIDDEN', when: 'Sem visibilidade sobre o chamado' },
]

const READ_ACCESS =
  'Acesso: sessão + agente (membro de um departamento) com o módulo **ServiceDesk** habilitado e a permissão `sd-change-calendar`.'
const WRITE_ACCESS =
  'Acesso: só **admins** do ServiceDesk — é configuração do módulo.'

export const sdChangeCabRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${base}/change-windows`,
    tags: [CHANGE],
    summary: 'Janelas de manutenção e congelamento',
    description: `Janelas cadastradas, da mais antiga para a mais nova. A recorrência vem como foi salva (RRULE simplificada); as **ocorrências** expandidas estão em \`GET ${base}/change-calendar\`. ${READ_ACCESS}`,
    query: z.object({
      kind: z.enum(SD_CHANGE_WINDOW_KINDS).optional(),
    }),
    responses: {
      200: { description: 'Janelas.', schema: SdChangeWindowListDTO },
    },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'post',
    path: `${base}/change-windows`,
    tags: [CHANGE],
    summary: 'Criar uma janela',
    description: `Cria uma janela de manutenção (\`MAINTENANCE\`) ou de congelamento (\`FREEZE\`). O período é conferido aqui: fim depois do início, no máximo um ano, e a recorrência não pode terminar antes da primeira ocorrência — qualquer um desses casos devolve \`SD_CHANGE_WINDOW_INVALID\`. \`configItemIds\`/\`departmentIds\` vazios fazem a janela valer para a workspace inteira. ${WRITE_ACCESS}`,
    consent: true,
    body: CreateSdChangeWindowSchema,
    responses: {
      201: { description: 'Janela criada.', schema: SdChangeWindowDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      {
        code: 'SD_CHANGE_WINDOW_INVALID',
        when: 'Período ou recorrência impossíveis',
      },
      { code: 'SD_CONFIG_NOT_FOUND', when: 'Departamento de outra workspace' },
    ],
  },
  {
    method: 'patch',
    path: `${base}/change-windows/{windowId}`,
    tags: [CHANGE],
    summary: 'Atualizar uma janela',
    description: `Campos parciais; o período é revalidado contra o que está salvo. \`recurrence: null\` apaga a repetição. ${WRITE_ACCESS}`,
    consent: true,
    params: { windowId: 'Id da janela.' },
    body: UpdateSdChangeWindowSchema,
    responses: {
      200: { description: 'Janela salva.', schema: SdChangeWindowDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      'SD_CHANGE_WINDOW_NOT_FOUND',
      'SD_CHANGE_WINDOW_INVALID',
      'SD_CONFIG_NOT_FOUND',
    ],
  },
  {
    method: 'delete',
    path: `${base}/change-windows/{windowId}`,
    tags: [CHANGE],
    summary: 'Excluir uma janela',
    description: `Exclusão lógica: a janela sai do calendário e deixa de gerar avisos, mas os eventos de rastreabilidade que a citam continuam. ${WRITE_ACCESS}`,
    consent: true,
    params: { windowId: 'Id da janela.' },
    responses: { 200: { description: 'Janela excluída.' } },
    errors: [...ADMIN_ERRORS, 'SD_CHANGE_WINDOW_NOT_FOUND'],
  },
  {
    method: 'get',
    path: `${base}/change-calendar`,
    tags: [CHANGE],
    summary: 'Calendário de mudanças',
    description: `Tudo o que a tela do calendário precisa num pedido: as **ocorrências** das janelas no intervalo (recorrência já expandida — as faixas de fundo) e as mudanças com janela planejada, cada uma com \`frozenWindowIds\` (congelamentos que a cobrem) e \`conflictTicketIds\` (outras mudanças ativas no mesmo item de configuração). Intervalo máximo de 400 dias (\`SD_CHANGE_WINDOW_INVALID\`). ${READ_ACCESS}`,
    query: z.object({
      from: z.string().meta({ example: '2026-10-01T00:00:00.000Z' }),
      to: z.string().meta({ example: '2026-11-01T00:00:00.000Z' }),
      kind: z.enum(SD_CHANGE_WINDOW_KINDS).optional(),
    }),
    responses: {
      200: { description: 'Calendário.', schema: SdChangeCalendarDTO },
    },
    errors: [
      ...ACCESS_ERRORS,
      {
        code: 'SD_CHANGE_WINDOW_INVALID',
        when: 'Intervalo invertido ou maior que 400 dias',
      },
    ],
  },
  {
    method: 'get',
    path: `${ticket}/change-schedule`,
    tags: [CHANGE],
    summary: 'Agenda da mudança do chamado',
    description: `Bloco de agenda da tela do chamado: a janela planejada, as janelas que a cobrem e os avisos detectados. São **avisos, não bloqueios** — quando a mudança é salva com um aviso pendente, \`PATCH ${ticket}\` recusa com \`SD_CHANGE_FROZEN\` ou \`SD_CHANGE_CONFLICT\`, e um **admin** pode reenviar com \`confirmChangeSchedule: true\`; o que foi ignorado vira o evento \`change.schedule_forced\` na rastreabilidade. ${READ_ACCESS}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Agenda.', schema: SdTicketChangeScheduleDTO },
    },
    errors: TICKET_ERRORS,
  },
  {
    method: 'get',
    path: `${base}/cab-boards`,
    tags: [CHANGE],
    summary: 'Comitês de mudança (CAB)',
    description: `Comitês na ordem de \`position\`, com os membros (obrigatórios primeiro) e o quórum efetivo. \`quorum: 0\` significa **todos os membros**, e \`effectiveQuorum\` já traz esse número resolvido. ${READ_ACCESS}`,
    query: z.object({
      includeInactive: z
        .enum(['true', 'false'])
        .optional()
        .meta({ description: 'Inclui comitês desativados.' }),
    }),
    responses: {
      200: { description: 'Comitês.', schema: SdCabBoardListDTO },
    },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'post',
    path: `${base}/cab-boards`,
    tags: [CHANGE],
    summary: 'Criar um comitê',
    description: `As \`conditions\` (mesmo contrato das regras de SLA e automação, agora também com \`changeType\` e \`changeRisk\`) decidem qual comitê atende o chamado: vale o primeiro ativo, na ordem de \`position\`, cujas condições casam — então deixe o comitê sem condições por último, como padrão. Quórum maior que o número de membros, ou comitê sem membros, devolve \`SD_CAB_QUORUM_INVALID\`. ${WRITE_ACCESS}`,
    consent: true,
    body: CreateSdCabBoardSchema,
    responses: {
      201: { description: 'Comitê criado.', schema: SdCabBoardDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      {
        code: 'SD_CAB_QUORUM_INVALID',
        when: 'Quórum não cabe nos membros, ou comitê sem membros',
      },
      { code: 'SD_CONFIG_NOT_FOUND', when: 'Membro fora do workspace' },
    ],
  },
  {
    method: 'patch',
    path: `${base}/cab-boards/{boardId}`,
    tags: [CHANGE],
    summary: 'Atualizar um comitê',
    description: `Campos parciais. \`members\`, quando enviado, **substitui a lista inteira**; o quórum é revalidado contra a lista resultante. ${WRITE_ACCESS}`,
    consent: true,
    params: { boardId: 'Id do comitê.' },
    body: UpdateSdCabBoardSchema,
    responses: { 200: { description: 'Comitê salvo.', schema: SdCabBoardDTO } },
    errors: [
      ...ADMIN_ERRORS,
      'SD_CAB_BOARD_NOT_FOUND',
      'SD_CAB_QUORUM_INVALID',
      'SD_CONFIG_NOT_FOUND',
    ],
  },
  {
    method: 'delete',
    path: `${base}/cab-boards/{boardId}`,
    tags: [CHANGE],
    summary: 'Excluir um comitê',
    description: `Exclusão lógica (também desativa). As rodadas já abertas continuam valendo e seguem contando os votos. ${WRITE_ACCESS}`,
    consent: true,
    params: { boardId: 'Id do comitê.' },
    responses: { 200: { description: 'Comitê excluído.' } },
    errors: [...ADMIN_ERRORS, 'SD_CAB_BOARD_NOT_FOUND'],
  },
  {
    method: 'get',
    path: `${ticket}/approval-rounds`,
    tags: [CHANGE],
    summary: 'Rodadas de aprovação do chamado',
    description: `Rodadas da mais recente para a mais antiga, cada uma com os pedidos (um por membro) e a contagem de votos (\`tally\`: aprovados, reprovados, pendentes, obrigatórios pendentes e quanto falta para o quórum). Expiração é **lazy**: a rodada cujos pedidos todos venceram é marcada \`EXPIRED\` nesta leitura. ${READ_ACCESS}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Rodadas.', schema: SdApprovalRoundListDTO },
    },
    errors: TICKET_ERRORS,
  },
  {
    method: 'post',
    path: `${ticket}/approval-rounds`,
    tags: [CHANGE],
    summary: 'Abrir uma rodada de aprovação',
    description: `Escolhe o comitê (\`boardId\` explícito ou a seleção por condições), dispara **um \`SdTicketApproval\` por membro** — mesmo link público por e-mail do pedido avulso — e guarda o quórum aplicado. A cada resposta a rodada é reapurada: fecha em \`APPROVED\` ao bater o quórum (desde que todo membro \`required\` já tenha votado), em \`REJECTED\` na primeira reprovação quando \`rejectEnds\`, e os pedidos que sobram são cancelados. Uma fase com \`requiresApproval\` aceita uma **rodada aprovada** tanto quanto um pedido avulso aprovado. Só uma rodada aberta por chamado. ${READ_ACCESS}`,
    consent: true,
    params: TICKET_PARAM,
    body: OpenSdApprovalRoundSchema,
    responses: {
      201: { description: 'Rodada aberta.', schema: SdApprovalRoundDTO },
    },
    errors: [
      ...TICKET_ERRORS,
      'VALIDATION_ERROR',
      { code: 'SD_TICKET_CLOSED', when: 'Chamado encerrado ou cancelado' },
      {
        code: 'SD_CAB_BOARD_NOT_FOUND',
        when: 'Comitê informado não existe, ou nenhum comitê ativo atende o chamado',
      },
      {
        code: 'SD_CAB_QUORUM_INVALID',
        when: 'Comitê sem membros, ou nenhum membro com e-mail cadastrado',
      },
      {
        code: 'SD_APPROVAL_ROUND_CLOSED',
        when: 'Já existe uma rodada em andamento no chamado',
      },
    ],
  },
  {
    method: 'delete',
    path: `${ticket}/approval-rounds/{roundId}`,
    tags: [CHANGE],
    summary: 'Cancelar uma rodada',
    description: `Fecha a rodada como \`CANCELED\` e cancela os pedidos que ainda não responderam — os links já enviados param de funcionar. Os votos já dados ficam registrados. ${READ_ACCESS}`,
    consent: true,
    params: { ...TICKET_PARAM, roundId: 'Id da rodada.' },
    responses: {
      200: { description: 'Rodada cancelada.', schema: SdApprovalRoundDTO },
    },
    errors: [
      ...TICKET_ERRORS,
      'SD_APPROVAL_ROUND_NOT_FOUND',
      {
        code: 'SD_APPROVAL_ROUND_CLOSED',
        when: 'A rodada já tinha sido decidida ou cancelada',
      },
    ],
  },
]
