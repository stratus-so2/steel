import { z } from 'zod'
import {
  ListSdIncidentClustersSchema,
  ListSdRiskTicketsSchema,
  OpenSdClusterProblemSchema,
} from '@/src/schemas/sd-risk.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import { SdIncidentClusterDTO } from '../../schemas/servicedesk/risk'
import { SdTicketDTO, SdTicketRiskDTO } from '../../schemas/servicedesk-tickets'

/**
 * ServiceDesk · Risco preditivo —
 * `app/api/workspaces/[id]/servicedesk/risk/**`.
 *
 * A nota **não é calculada aqui**: o worker (`servicedesk-risk`, a cada 10
 * min) grava uma previsão por chamado aberto com uma heurística explicável,
 * e a tela só lê o que está pronto (ADR 0016). Nada passa por LLM.
 *
 * Tudo é de **agente** com a permissão do chamado (`sd-tickets`): quem vê o
 * chamado vê o risco. Abrir o problema de um agrupamento exige `CREATE`
 * (o mesmo que abrir um chamado) e é sempre ação humana.
 */

const RISK = 'ServiceDesk · Risco preditivo' as const

const tickets = '/workspaces/{id}/servicedesk/risk/tickets'
const ticket = `${tickets}/{ticketId}`
const clusters = '/workspaces/{id}/servicedesk/risk/clusters'
const cluster = `${clusters}/{clusterId}`

const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`INC-000123`).',
}
const CLUSTER_PARAM = { clusterId: 'Id do agrupamento.' }

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

const CLUSTER_NOT_FOUND: ErrorEntry = {
  code: 'SD_INCIDENT_CLUSTER_NOT_FOUND',
  when: 'Agrupamento inexistente ou de outro workspace',
}

const AGENT_ACCESS =
  'Acesso: sessão + **agente** do ServiceDesk (membro de um departamento ou admin do módulo) com o módulo habilitado.'

const FACTORS =
  'Cada fator que pegou traz a frase em pt-BR do motivo (`detail`) e os pontos que somou — a interface nunca mostra a nota sem o porquê.'

export const sdRiskRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: tickets,
    tags: [RISK],
    summary: 'Fila por risco de violar o SLA',
    description: `Chamados abertos da faixa pedida (padrão \`HIGH\`), nota maior primeiro, com a previsão dentro do próprio chamado (\`risk\`). ${FACTORS} ${AGENT_ACCESS}`,
    query: ListSdRiskTicketsSchema,
    responses: {
      200: { description: 'Chamados em risco.', schema: z.array(SdTicketDTO) },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'get',
    path: ticket,
    tags: [RISK],
    summary: 'Previsão de risco de um chamado',
    description: `Nota, faixa, fatores e a previsão de quando o prazo estoura se o ritmo atual seguir (\`breachEtaAt\`, já em horário útil do calendário da política). ${FACTORS} Chamado sem previsão calculada responde \`SD_RISK_PREDICTION_NOT_FOUND\`. ${AGENT_ACCESS}`,
    params: TICKET_PARAM,
    responses: { 200: { description: 'Previsão.', schema: SdTicketRiskDTO } },
    errors: [
      ...AGENT_ERRORS,
      { code: 'SD_TICKET_NOT_FOUND', when: 'Chamado inexistente ou removido' },
      { code: 'SD_TICKET_FORBIDDEN', when: 'Sem visibilidade sobre o chamado' },
      {
        code: 'SD_RISK_PREDICTION_NOT_FOUND',
        when: 'O worker ainda não calculou a previsão deste chamado',
      },
    ],
  },
  {
    method: 'get',
    path: clusters,
    tags: [RISK],
    summary: 'Sugestões de problema (incidentes repetidos)',
    description: `Grupos de incidentes parecidos da janela de 7 dias, agrupados por assinatura (categoria, subcategoria, serviço e os termos normalizados do título) a partir de 3 ocorrências. \`status=open\` traz as sugestões vivas; \`handled\`, as que já viraram problema ou foram descartadas. ${AGENT_ACCESS}`,
    query: ListSdIncidentClustersSchema,
    responses: {
      200: {
        description: 'Agrupamentos.',
        schema: z.array(SdIncidentClusterDTO),
      },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: `${cluster}/problem`,
    tags: [RISK],
    summary: 'Abrir um problema a partir do agrupamento',
    description: `Abre o chamado de **problema** pelo motor (roteamento, SLA e fase inicial normais), com a lista dos incidentes na descrição, e vincula os incidentes sem pai como filhos (\`linkIncidents\`). O corpo é opcional: sem nada informado, usa o título do grupo. Um grupo já tratado (problema aberto ou descartado) responde \`SD_INCIDENT_CLUSTER_CLOSED\`. Auditado. ${AGENT_ACCESS}`,
    params: CLUSTER_PARAM,
    consent: true,
    body: OpenSdClusterProblemSchema,
    responses: {
      201: {
        description: 'Agrupamento com o problema vinculado.',
        schema: SdIncidentClusterDTO,
      },
    },
    errors: [
      ...AGENT_ERRORS,
      CLUSTER_NOT_FOUND,
      {
        code: 'SD_INCIDENT_CLUSTER_CLOSED',
        when: 'O agrupamento já virou um problema ou foi descartado',
      },
      {
        code: 'VALIDATION_ERROR',
        when: 'Departamento, responsável, prioridade ou categoria inexistente',
      },
    ],
  },
  {
    method: 'post',
    path: `${cluster}/dismiss`,
    tags: [RISK],
    summary: 'Descartar a sugestão',
    description: `O grupo sai da lista de sugestões e só volta a sugerir se os incidentes se repetirem **de novo** depois do descarte (3 novos). Auditado. ${AGENT_ACCESS}`,
    params: CLUSTER_PARAM,
    consent: true,
    responses: {
      200: {
        description: 'Agrupamento descartado.',
        schema: SdIncidentClusterDTO,
      },
    },
    errors: [
      ...AGENT_ERRORS,
      CLUSTER_NOT_FOUND,
      {
        code: 'SD_INCIDENT_CLUSTER_CLOSED',
        when: 'O agrupamento já virou um problema ou já tinha sido descartado',
      },
    ],
  },
]
