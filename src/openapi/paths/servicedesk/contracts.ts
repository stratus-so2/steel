import { z } from 'zod'
import {
  CloseSdContractPeriodSchema,
  CreateSdContractSchema,
  ListSdContractsSchema,
  UpdateSdContractSchema,
} from '@/src/schemas/sd-contract.schema'
import {
  CreateSdTimeEntrySchema,
  SdTimerActionSchema,
  UpdateSdTimeEntrySchema,
} from '@/src/schemas/sd-time-entry.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdContractDTO,
  SdContractPeriodDTO,
  SdContractSummaryDTO,
  SdTimeEntryDTO,
  SdTimeEntryListDTO,
} from '../../schemas/servicedesk/contracts'

/**
 * ServiceDesk · Contratos e horas —
 * `app/api/workspaces/[id]/servicedesk/contracts/**` e a aba "Horas" do
 * chamado (`.../tickets/{ticketId}/time-entries/**`).
 *
 * O cadastro do contrato é de **admins** do módulo; a leitura é de qualquer
 * agente com `sd-contracts:VIEW`. Apontar hora é do dia a dia do agente, e
 * por isso usa a permissão do chamado (`sd-tickets`).
 */

const CONTRACTS = 'ServiceDesk · Contratos e horas' as const

const contracts = '/workspaces/{id}/servicedesk/contracts'
const contract = `${contracts}/{contractId}`
const periods = `${contract}/periods`
const timeEntries =
  '/workspaces/{id}/servicedesk/tickets/{ticketId}/time-entries'
const timeEntry = `${timeEntries}/{entryId}`

const CONTRACT_PARAM = { contractId: 'Id do contrato.' }
const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`INC-000123`).',
}
const ENTRY_PARAM = { ...TICKET_PARAM, entryId: 'Id do apontamento.' }

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

const CONTRACT_NOT_FOUND: ErrorEntry = {
  code: 'SD_CONTRACT_NOT_FOUND',
  when: 'Contrato inexistente, removido ou de outro workspace',
}

const TICKET_ERRORS: ErrorEntry[] = [
  ...AGENT_ERRORS,
  { code: 'SD_TICKET_NOT_FOUND', when: 'Chamado inexistente ou removido' },
  { code: 'SD_TICKET_FORBIDDEN', when: 'Sem visibilidade sobre o chamado' },
]

const ENTRY_NOT_FOUND: ErrorEntry = {
  code: 'SD_TIME_ENTRY_NOT_FOUND',
  when: 'Apontamento inexistente, removido ou de outro chamado',
}

const PERIOD_CLOSED: ErrorEntry = {
  code: 'SD_CONTRACT_PERIOD_CLOSED',
  when: 'O período do contrato já foi fechado e está congelado',
}

const AGENT_ACCESS =
  'Acesso: sessão + **agente** do ServiceDesk (membro de um departamento ou admin do módulo) com o módulo habilitado.'
const ADMIN_ACCESS =
  'Acesso: sessão + **admin do ServiceDesk** (OWNER/ADMIN do workspace ou perfil administrativo do módulo) com o módulo habilitado.'

const RULES =
  'As regras do contrato decidem o apontamento: os minutos são arredondados **para cima** no múltiplo de `roundingMinutes`; o `minimumMinutes` entra no primeiro apontamento do dia naquele chamado; a janela (`BUSINESS_HOURS`, `AFTER_HOURS`, `WEEKEND`, `HOLIDAY`) sai do calendário de expediente da política de SLA do contrato (ou do calendário padrão do workspace); e o valor vem da primeira `SdContractRate` que casa com tipo × prioridade × janela, senão do valor da hora do contrato.'

export const sdContractRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: contracts,
    tags: [CONTRACTS],
    summary: 'Listar contratos de atendimento',
    description: `Contratos do workspace com a tabela de valores, o cliente e o período aberto do ciclo corrente. ${AGENT_ACCESS}`,
    query: ListSdContractsSchema,
    responses: {
      200: { description: 'Contratos.', schema: z.array(SdContractDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: contracts,
    tags: [CONTRACTS],
    summary: 'Cadastrar contrato de atendimento',
    description: `Cria o contrato com a tabela de valores junto. Um cliente não pode ter dois contratos **ativos** com vigência sobreposta (\`SD_CONTRACT_OVERLAP\`). Contrato que já nasce ativo ganha o período do ciclo corrente. Auditado. ${ADMIN_ACCESS}`,
    consent: true,
    body: CreateSdContractSchema,
    responses: { 201: { description: 'Criado.', schema: SdContractDTO } },
    errors: [
      ...ADMIN_ERRORS,
      {
        code: 'SD_CONTRACT_OVERLAP',
        when: 'O cliente já tem um contrato ativo cobrindo o período',
      },
      {
        code: 'VALIDATION_ERROR',
        when: 'Cliente, política de SLA ou prioridade da tabela de valores inexistente',
      },
    ],
  },
  {
    method: 'get',
    path: `${contracts}/summary`,
    tags: [CONTRACTS],
    summary: 'Contrato vigente de um cliente',
    description: `Contrato ativo e vigente do cliente mais o consumo do período corrente (franquia, excedente, acumulado e valor) — é o bloco "Contrato" da tela do cliente. Sem contrato vigente devolve tudo nulo. ${AGENT_ACCESS}`,
    query: z.object({ customerId: z.string() }),
    queryValidationError: false,
    responses: {
      200: { description: 'Resumo.', schema: SdContractSummaryDTO },
    },
    errors: [
      ...AGENT_ERRORS,
      { code: 'VALIDATION_ERROR', when: '`customerId` ausente' },
    ],
  },
  {
    method: 'get',
    path: contract,
    tags: [CONTRACTS],
    summary: 'Detalhar contrato',
    description: `Contrato com a tabela de valores e o período aberto. ${AGENT_ACCESS}`,
    params: CONTRACT_PARAM,
    responses: { 200: { description: 'Contrato.', schema: SdContractDTO } },
    errors: [...AGENT_ERRORS, CONTRACT_NOT_FOUND],
  },
  {
    method: 'patch',
    path: contract,
    tags: [CONTRACTS],
    summary: 'Atualizar contrato',
    description: `Informar \`rates\` **substitui a tabela de valores inteira**; omitir mantém a atual. Deixar o contrato ativo revalida a sobreposição de vigência com os outros contratos do cliente. Auditado. ${ADMIN_ACCESS}`,
    params: CONTRACT_PARAM,
    consent: true,
    body: UpdateSdContractSchema,
    responses: { 200: { description: 'Atualizado.', schema: SdContractDTO } },
    errors: [
      ...ADMIN_ERRORS,
      CONTRACT_NOT_FOUND,
      {
        code: 'SD_CONTRACT_OVERLAP',
        when: 'O cliente já tem outro contrato ativo cobrindo o período',
      },
    ],
  },
  {
    method: 'delete',
    path: contract,
    tags: [CONTRACTS],
    summary: 'Excluir contrato',
    description: `Exclusão lógica: o contrato sai das listas e fica \`ENDED\`. Os apontamentos e períodos já gravados continuam. Auditado. ${ADMIN_ACCESS}`,
    params: CONTRACT_PARAM,
    consent: true,
    responses: { 200: 'Removido (`data: null`).' },
    errors: [...ADMIN_ERRORS, CONTRACT_NOT_FOUND],
  },
  {
    method: 'get',
    path: periods,
    tags: [CONTRACTS],
    summary: 'Histórico de períodos do contrato',
    description: `Últimos 60 períodos (mais recente primeiro) com franquia, consumo, excedente, saldo acumulado e valor apurado. ${AGENT_ACCESS}`,
    params: CONTRACT_PARAM,
    responses: {
      200: { description: 'Períodos.', schema: z.array(SdContractPeriodDTO) },
    },
    errors: [...AGENT_ERRORS, CONTRACT_NOT_FOUND],
  },
  {
    method: 'post',
    path: `${periods}/close`,
    tags: [CONTRACTS],
    summary: 'Fechar o período do contrato',
    description: `Consolida os apontamentos do período (franquia na ordem cronológica, excedente pela hora de excedente) e congela tudo. Sem \`periodId\`, fecha o período do ciclo corrente. O worker (\`servicedesk-billing\`, 00:20) faz o mesmo sozinho no virar do ciclo. Auditado. ${ADMIN_ACCESS}`,
    params: CONTRACT_PARAM,
    consent: true,
    body: CloseSdContractPeriodSchema,
    responses: {
      200: { description: 'Período fechado.', schema: SdContractPeriodDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      CONTRACT_NOT_FOUND,
      {
        code: 'SD_CONTRACT_PERIOD_NOT_FOUND',
        when: 'Período inexistente ou de outro contrato',
      },
      PERIOD_CLOSED,
    ],
  },
  {
    method: 'get',
    path: timeEntries,
    tags: [CONTRACTS],
    summary: 'Horas apontadas no chamado',
    description: `Apontamentos do chamado (mais recentes primeiro), o total por janela, o cronômetro aberto de quem pediu (mesmo que seja de outro chamado) e o contrato carimbado no chamado com o consumo do período. ${AGENT_ACCESS}`,
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Apontamentos.', schema: SdTimeEntryListDTO },
    },
    errors: TICKET_ERRORS,
  },
  {
    method: 'post',
    path: timeEntries,
    tags: [CONTRACTS],
    summary: 'Lançar horas manualmente',
    description: `Início e fim informados pelo agente; os minutos cobrados e o valor **não vêm do cliente**, são calculados aqui. ${RULES} Apontar por outro agente (\`userId\`) é restrito a admins do módulo. Auditado. ${AGENT_ACCESS}`,
    params: TICKET_PARAM,
    consent: true,
    body: CreateSdTimeEntrySchema,
    responses: { 201: { description: 'Lançado.', schema: SdTimeEntryDTO } },
    errors: [
      ...TICKET_ERRORS,
      { code: 'SD_TICKET_CLOSED', when: 'Chamado fechado ou cancelado' },
      {
        code: 'FORBIDDEN',
        when: 'Agente não-admin tentando apontar por outro agente',
      },
      PERIOD_CLOSED,
      { code: 'SD_TIME_ENTRY_INVALID', when: 'Trecho sem duração' },
    ],
  },
  {
    method: 'post',
    path: `${timeEntries}/timer`,
    tags: [CONTRACTS],
    summary: 'Cronômetro do chamado',
    description: `O cronômetro é **por trecho**: \`start\`/\`resume\` abrem um apontamento (fim vazio) e \`pause\`/\`stop\` fecham o aberto, consolidando minutos, janela e valor — são quatro nomes para a interface, duas operações no banco. Só pode haver **um cronômetro aberto por usuário** em todo o workspace (\`SD_TIME_ENTRY_RUNNING\`); fechar exige que o cronômetro aberto seja deste chamado. ${RULES} Auditado. ${AGENT_ACCESS}`,
    params: TICKET_PARAM,
    consent: true,
    body: SdTimerActionSchema,
    responses: {
      200: {
        description: 'Apontamento aberto ou fechado.',
        schema: SdTimeEntryDTO,
      },
    },
    errors: [
      ...TICKET_ERRORS,
      {
        code: 'SD_TICKET_CLOSED',
        when: 'Chamado fechado ou cancelado (só ao abrir um trecho)',
      },
      {
        code: 'SD_TIME_ENTRY_RUNNING',
        when: 'O usuário já tem um cronômetro em andamento',
      },
      {
        code: 'SD_TIME_ENTRY_INVALID',
        when: 'Nenhum cronômetro em andamento neste chamado, ou trecho sem duração',
      },
      PERIOD_CLOSED,
    ],
  },
  {
    method: 'patch',
    path: timeEntry,
    tags: [CONTRACTS],
    summary: 'Ajustar um apontamento',
    description: `Mudar início/fim recalcula minutos, janela e valor. Um cronômetro **em andamento** só aceita descrição e \`billable\` — pare-o antes de ajustar horários. Quem pode: o autor enquanto o período está aberto, e os admins do módulo. Auditado. ${AGENT_ACCESS}`,
    params: ENTRY_PARAM,
    consent: true,
    body: UpdateSdTimeEntrySchema,
    responses: { 200: { description: 'Atualizado.', schema: SdTimeEntryDTO } },
    errors: [
      ...TICKET_ERRORS,
      ENTRY_NOT_FOUND,
      {
        code: 'FORBIDDEN',
        when: 'Apontamento de outro agente e quem pediu não é admin',
      },
      PERIOD_CLOSED,
      {
        code: 'SD_TIME_ENTRY_INVALID',
        when: 'Horários incoerentes ou ajuste de horário num cronômetro aberto',
      },
    ],
  },
  {
    method: 'delete',
    path: timeEntry,
    tags: [CONTRACTS],
    summary: 'Excluir um apontamento',
    description: `Exclusão lógica: sai da lista e do cálculo do período. Mesma regra de quem pode mexer. Auditado. ${AGENT_ACCESS}`,
    params: ENTRY_PARAM,
    consent: true,
    responses: { 200: 'Removido (`data: null`).' },
    errors: [
      ...TICKET_ERRORS,
      ENTRY_NOT_FOUND,
      {
        code: 'FORBIDDEN',
        when: 'Apontamento de outro agente e quem pediu não é admin',
      },
      PERIOD_CLOSED,
    ],
  },
]
