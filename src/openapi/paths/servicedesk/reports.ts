import { z } from 'zod'
import {
  CreateSdScheduledReportSchema,
  GenerateSdReportSchema,
  UpdateSdScheduledReportSchema,
} from '@/src/schemas/sd-report.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdReportRunDTO,
  SdScheduledReportDTO,
} from '../../schemas/servicedesk/reports'

/**
 * ServiceDesk · Relatórios de SLA —
 * `app/api/workspaces/[id]/servicedesk/reports/**`. Qualquer agente com
 * `sd-reports:VIEW` lê os agendamentos, o histórico e baixa os arquivos;
 * configurar, excluir e "gerar agora" são do admin do módulo.
 */

const REPORTS = 'ServiceDesk · Relatórios de SLA' as const

const collection = '/workspaces/{id}/servicedesk/reports'
const item = `${collection}/{reportId}`
const runs = `${collection}/runs`
const download = `${runs}/{runId}/download`

const ITEM_PARAM = { reportId: 'Id do relatório agendado.' }

const MEMBER_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede `sd-reports`',
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
  code: 'SD_REPORT_NOT_FOUND',
  when: 'Relatório inexistente, excluído ou de outro workspace',
}

const SCHEDULE_INVALID: ErrorEntry = {
  code: 'SD_REPORT_SCHEDULE_INVALID',
  when: 'Fuso desconhecido, horário fora do formato ou dia do mês fora de 1–28',
}

const SCOPE_NOT_FOUND: ErrorEntry = {
  code: 'SD_CONFIG_NOT_FOUND',
  when: 'Cliente ou departamento do recorte é de outro workspace',
}

const AGENT_ACCESS =
  'Acesso: sessão + **agente** do ServiceDesk (membro de um departamento) ou admin do módulo, com `sd-reports:VIEW` e o módulo habilitado.'

const ADMIN_ACCESS =
  'Acesso: sessão + **admin do ServiceDesk** (OWNER/ADMIN do workspace ou perfil com `sd-settings`) com o módulo habilitado.'

const MEASURE_RULES =
  'A apuração é do período `[periodStart, periodEnd)` no **fuso do relatório**: abertos por `createdAt`, resolvidos por `resolvedAt`, fechados por `closedAt` e o backlog pelo retrato do fim do período. O cumprimento de SLA só conta chamado **com prazo** (primeira resposta medida sobre quem respondeu no período; resolução sobre quem resolveu), e tempos e atrasos saem em **minutos úteis** do calendário do chamado.'

export const sdReportRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: collection,
    tags: [REPORTS],
    summary: 'Listar relatórios agendados',
    description: `Agendamentos com o recorte, o período, os formatos, a agenda e o próximo envio (\`nextRunAt\`). \`includeInactive=true\` traz os pausados. ${AGENT_ACCESS}`,
    query: z.object({
      includeInactive: z
        .enum(['true', 'false'])
        .optional()
        .meta({ description: 'Inclui os agendamentos pausados.' }),
    }),
    responses: {
      200: {
        description: 'Agendamentos.',
        schema: z.array(SdScheduledReportDTO),
      },
    },
    errors: AGENT_ERRORS,
  },
  {
    method: 'post',
    path: collection,
    tags: [REPORTS],
    summary: 'Criar relatório agendado',
    description: `Cria o agendamento e já calcula o primeiro envio (\`dayOfMonth\` às \`atTime\` no fuso do relatório, 1–28 para o dia existir em todo mês). Destinatários são e-mails livres; com \`includeAccountOwners\`, soma o e-mail de cada cliente do recorte e de quem mantém o cadastro. Auditado. ${ADMIN_ACCESS}`,
    consent: true,
    body: CreateSdScheduledReportSchema,
    responses: {
      201: { description: 'Criado.', schema: SdScheduledReportDTO },
    },
    errors: [...ADMIN_ERRORS, SCHEDULE_INVALID, SCOPE_NOT_FOUND],
  },
  {
    method: 'get',
    path: item,
    tags: [REPORTS],
    summary: 'Ver um relatório agendado',
    description: `O agendamento com o recorte já resolvido em nomes. ${AGENT_ACCESS}`,
    params: ITEM_PARAM,
    responses: {
      200: { description: 'Agendamento.', schema: SdScheduledReportDTO },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'patch',
    path: item,
    tags: [REPORTS],
    summary: 'Atualizar, pausar ou retomar o relatório',
    description: `Qualquer campo da agenda recalcula o próximo envio a partir de agora. \`active: false\` **pausa** (sem próximo envio) e \`active: true\` **retoma**. Auditado. ${ADMIN_ACCESS}`,
    params: ITEM_PARAM,
    consent: true,
    body: UpdateSdScheduledReportSchema,
    responses: {
      200: { description: 'Atualizado.', schema: SdScheduledReportDTO },
    },
    errors: [...ADMIN_ERRORS, NOT_FOUND, SCHEDULE_INVALID, SCOPE_NOT_FOUND],
  },
  {
    method: 'delete',
    path: item,
    tags: [REPORTS],
    summary: 'Excluir o relatório agendado',
    description: `Exclusão lógica: para de enviar e sai das listas. O histórico de execuções e os arquivos já gerados continuam. Auditado. ${ADMIN_ACCESS}`,
    params: ITEM_PARAM,
    consent: true,
    responses: { 200: 'Excluído (`data: null`).' },
    errors: [...ADMIN_ERRORS, NOT_FOUND],
  },
  {
    method: 'get',
    path: runs,
    tags: [REPORTS],
    summary: 'Histórico de execuções',
    description: `Execuções em ordem decrescente, com o resumo apurado (volume, SLA, MTTR, CSAT, violações), os formatos disponíveis para download, os destinatários e o envio. \`reportId\` filtra um agendamento; \`limit\` entre 1 e 200 (padrão 50). ${AGENT_ACCESS}`,
    query: z.object({
      reportId: z
        .string()
        .optional()
        .meta({ description: 'Histórico de um agendamento específico.' }),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .meta({ description: 'Padrão 50.' }),
    }),
    responses: {
      200: { description: 'Execuções.', schema: z.array(SdReportRunDTO) },
    },
    errors: [...AGENT_ERRORS, NOT_FOUND],
  },
  {
    method: 'post',
    path: runs,
    tags: [REPORTS],
    summary: 'Gerar o relatório agora',
    description: `Apura, grava PDF/CSV no bucket privado e envia o e-mail na hora. Com \`reportId\` usa o recorte e os destinatários do agendamento — e vale a trava \`(reportId, periodStart)\`: o mesmo período **não** é reenviado, a resposta devolve a execução anterior. Sem \`reportId\` é um relatório pontual (sob demanda) com o recorte do pedido; sem destinatário, só gera os arquivos e avisa quem pediu pelo evento \`report.ready\`. ${MEASURE_RULES} Auditado. ${ADMIN_ACCESS}`,
    consent: true,
    body: { schema: GenerateSdReportSchema, required: false },
    responses: {
      201: { description: 'Execução registrada.', schema: SdReportRunDTO },
    },
    errors: [
      ...ADMIN_ERRORS,
      NOT_FOUND,
      SCOPE_NOT_FOUND,
      {
        code: 'SD_REPORT_GENERATION_FAILED',
        when: 'Falha ao renderizar ou gravar os arquivos (a execução fica registrada como FAILED)',
      },
    ],
  },
  {
    method: 'get',
    path: download,
    tags: [REPORTS],
    summary: 'Baixar o PDF ou o CSV de uma execução',
    description: `Serve o arquivo do bucket privado conferindo o acesso a cada pedido (a API do MinIO não é pública, então esta rota autenticada é o "link assinado" do módulo). \`format\` escolhe PDF (padrão) ou CSV. ${AGENT_ACCESS}`,
    params: {
      runId: 'Id da execução.',
    },
    query: z.object({
      format: z
        .enum(['PDF', 'CSV'])
        .optional()
        .meta({ description: 'Padrão PDF.' }),
    }),
    responses: {
      200: {
        description:
          'Arquivo do relatório (`application/pdf` ou `text/csv`), com `Content-Disposition: attachment`.',
        envelope: false,
        contentType: 'application/pdf',
        schema: { type: 'string', format: 'binary' },
        headers: {
          'Content-Disposition': {
            description: '`attachment; filename="sla-mensal-2026-09-01.pdf"`.',
          },
        },
      },
    },
    errors: [
      ...AGENT_ERRORS,
      {
        code: 'SD_REPORT_RUN_NOT_FOUND',
        when: 'Execução inexistente, de outro workspace, sem o formato pedido ou arquivo indisponível',
      },
    ],
  },
]
