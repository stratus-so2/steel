import { z } from 'zod'
import {
  CreateSdRecurringTicketSchema,
  UpdateSdRecurringTicketSchema,
} from '@/src/schemas/sd-recurring-ticket.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdRecurringTicketDTO,
  SdRecurringTicketRunDTO,
} from '../../schemas/servicedesk/recurring'

/**
 * ServiceDesk · Chamados recorrentes —
 * `app/api/workspaces/[id]/servicedesk/recurring-tickets/**`. Leitura de
 * qualquer agente (a tela do item de configuração mostra as rotinas que
 * incidem sobre ele); criar, editar, pausar, excluir e "gerar agora" só
 * para os admins do módulo.
 */

const RECURRING = 'ServiceDesk · Chamados recorrentes' as const

const collection = '/workspaces/{id}/servicedesk/recurring-tickets'
const item = `${collection}/{recurringId}`

const ITEM_PARAM = { recurringId: 'Id da rotina.' }

const MEMBER_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]

const AGENT_ERRORS: ErrorEntry[] = [
  ...MEMBER_ERRORS,
  { code: 'SD_NOT_AGENT', when: 'Solicitante (membro sem departamento)' },
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

const NOT_FOUND: ErrorEntry = {
  code: 'SD_RECURRING_NOT_FOUND',
  when: 'Rotina inexistente, excluída ou de outro workspace',
}

const SCHEDULE_INVALID: ErrorEntry = {
  code: 'SD_RECURRING_SCHEDULE_INVALID',
  when: 'Fuso desconhecido, horário fora do formato, vigência invertida ou agenda que nunca dispara',
}

const REF_NOT_FOUND: ErrorEntry = {
  code: 'SD_CONFIG_NOT_FOUND',
  when: 'Modelo, departamento, responsável, cliente ou item de configuração de outro workspace',
}

const AGENT_ACCESS =
  'Acesso: sessão + **agente** do ServiceDesk (membro de um departamento) ou admin do módulo, com o módulo habilitado.'

const ADMIN_ACCESS =
  'Acesso: sessão + **admin do ServiceDesk** (OWNER/ADMIN do workspace ou perfil com `sd-settings`) com o módulo habilitado.'

const SCHEDULE_RULES =
  'A agenda vale no **fuso da regra**: `atTime` é hora local, `interval` conta a partir de `startsAt`, `byWeekday` filtra DAILY e escolhe os dias do WEEKLY, `byMonthday` vale para MONTHLY/YEARLY e um dia que não existe no mês cai no último dia dele. `leadTimeMinutes` antecipa só a abertura.'

export const sdRecurringRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: collection,
    tags: [RECURRING],
    summary: 'Listar rotinas recorrentes',
    description: `Rotinas de manutenção preventiva com o próximo disparo (\`nextRunAt\`) e a pré-visualização das próximas ocorrências (\`upcoming\`). Filtros: tipo de chamado, item de configuração, cliente e \`includeInactive\` (traz as pausadas). ${AGENT_ACCESS}`,
    responses: {
      200: { description: 'Rotinas.', schema: z.array(SdRecurringTicketDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: collection,
    tags: [RECURRING],
    summary: 'Criar rotina recorrente',
    description: `Cria a rotina e já calcula o primeiro disparo — **sem backfill**: ocorrências anteriores a agora ficam para trás. ${SCHEDULE_RULES} Auditado. ${ADMIN_ACCESS}`,
    consent: true,
    body: CreateSdRecurringTicketSchema,
    responses: {
      201: { description: 'Criada.', schema: SdRecurringTicketDTO },
    },
    errors: [...ADMIN_ERRORS, SCHEDULE_INVALID, REF_NOT_FOUND],
  },
  {
    method: 'get',
    path: item,
    tags: [RECURRING],
    summary: 'Ver uma rotina recorrente',
    description: `A rotina com a agenda, os valores do chamado gerado e as próximas ocorrências. ${AGENT_ACCESS}`,
    params: ITEM_PARAM,
    responses: {
      200: { description: 'Rotina.', schema: SdRecurringTicketDTO },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: item,
    tags: [RECURRING],
    summary: 'Atualizar, pausar ou retomar a rotina',
    description: `Qualquer campo da agenda recalcula o próximo disparo a partir de agora. \`active: false\` **pausa** (sem próximo disparo) e \`active: true\` **retoma**. Auditado. ${ADMIN_ACCESS}`,
    params: ITEM_PARAM,
    consent: true,
    body: UpdateSdRecurringTicketSchema,
    responses: {
      200: { description: 'Atualizada.', schema: SdRecurringTicketDTO },
    },
    errors: [...ADMIN_ERRORS, NOT_FOUND, SCHEDULE_INVALID, REF_NOT_FOUND],
  },
  {
    method: 'delete',
    path: item,
    tags: [RECURRING],
    summary: 'Excluir a rotina',
    description: `Exclusão lógica: a rotina para de disparar e sai das listas. Os chamados e as ocorrências já registradas ficam. Auditado. ${ADMIN_ACCESS}`,
    params: ITEM_PARAM,
    consent: true,
    responses: { 200: 'Excluída (`data: null`).' },
    errors: [...ADMIN_ERRORS, NOT_FOUND],
  },
  {
    method: 'get',
    path: `${item}/runs`,
    tags: [RECURRING],
    summary: 'Histórico de ocorrências',
    description: `Cada ocorrência da rotina em ordem decrescente: \`CREATED\` (com o chamado gerado), \`SKIPPED\` (a anterior ainda estava aberta e \`skipIfOpen\` está ligado) ou \`FAILED\` (com o código do erro). \`limit\` entre 1 e 200 (padrão 50). ${AGENT_ACCESS}`,
    params: ITEM_PARAM,
    responses: {
      200: {
        description: 'Ocorrências.',
        schema: z.array(SdRecurringTicketRunDTO),
      },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: `${item}/run-now`,
    tags: [RECURRING],
    summary: 'Gerar o chamado agora',
    description: `Abre a ocorrência na hora, para testar a configuração: ignora \`skipIfOpen\`, registra a ocorrência com o horário do clique e carimba \`lastRunAt\` **sem** consumir a agenda — o próximo disparo continua o mesmo. Auditado. ${ADMIN_ACCESS}`,
    params: ITEM_PARAM,
    consent: true,
    responses: {
      201: {
        description: 'Ocorrência registrada.',
        schema: SdRecurringTicketRunDTO,
      },
    },
    errors: [
      ...ADMIN_ERRORS,
      NOT_FOUND,
      {
        code: 'SD_CONFIG_CONFLICT',
        when: 'Já existe uma ocorrência registrada neste instante',
      },
      {
        code: 'SD_PHASE_NOT_FOUND',
        when: 'O tipo de chamado da rotina não tem fase inicial configurada',
      },
    ],
  },
]
