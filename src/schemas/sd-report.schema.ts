import z from 'zod'
import { booleanQuery, sdId, sdName } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

/**
 * Relatórios de SLA agendados (`SdScheduledReport`): o recorte (clientes,
 * departamentos, tipos — vazio = todos), o período apurado, os formatos, a
 * agenda (dia do mês, hora e fuso **do relatório**) e os destinatários. A
 * apuração é pura (`src/lib/servicedesk/report-sla.ts`), a agenda também
 * (`src/lib/servicedesk/report-schedule.ts`); autorização e auditoria ficam
 * no `SdReportService`.
 */

export const SD_REPORT_KINDS = ['SLA'] as const
export const SdReportKindEnum = z.enum(SD_REPORT_KINDS)

export const SD_REPORT_FORMATS = ['PDF', 'CSV'] as const
export const SdReportFormatEnum = z.enum(SD_REPORT_FORMATS)

export const SD_REPORT_PERIODS = [
  'LAST_MONTH',
  'LAST_WEEK',
  'CURRENT_MONTH',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
] as const
export const SdReportPeriodEnum = z.enum(SD_REPORT_PERIODS)

export const SD_REPORT_RUN_STATUSES = ['GENERATED', 'SENT', 'FAILED'] as const
export const SdReportRunStatusEnum = z.enum(SD_REPORT_RUN_STATUSES)

/** `HH:MM` (00:00–23:59) — hora local do fuso do relatório. */
const atTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)')

/** Fuso IANA; a existência é checada no service. */
const timezone = z.string().trim().min(1, 'Fuso é obrigatório').max(64)

/** 1–28: todo mês tem esses dias, então a agenda nunca "pula" fevereiro. */
const dayOfMonth = z.coerce.number().int().min(1).max(28)

const recipients = z
  .array(
    z.string().trim().toLowerCase().pipe(z.email('E-mail inválido').max(320)),
  )
  .max(50, 'No máximo 50 destinatários')

const ids = z.array(sdId).max(100)
const ticketTypes = z.array(SdTicketTypeEnum).max(4)

const formats = z
  .array(SdReportFormatEnum)
  .min(1, 'Escolha ao menos um formato')
  .max(SD_REPORT_FORMATS.length)
  /** `['CSV','PDF','CSV']` → `['PDF','CSV']` (ordem do enum, sem repetir). */
  .transform((list) => SD_REPORT_FORMATS.filter((f) => list.includes(f)))

export const CreateSdScheduledReportSchema = z.object({
  name: sdName,
  kind: SdReportKindEnum.default('SLA'),
  customerIds: ids.default([]),
  departmentIds: ids.default([]),
  ticketTypes: ticketTypes.default([]),
  period: SdReportPeriodEnum.default('LAST_MONTH'),
  formats: formats.default([...SD_REPORT_FORMATS]),
  dayOfMonth: dayOfMonth.default(1),
  atTime: atTime.default('07:00'),
  timezone: timezone.default('America/Sao_Paulo'),
  recipients: recipients.default([]),
  /** Soma o responsável de cada cliente do recorte aos destinatários. */
  includeAccountOwners: z.boolean().default(false),
  active: z.boolean().default(true),
})
export type CreateSdScheduledReportDTO = z.infer<
  typeof CreateSdScheduledReportSchema
>

export const UpdateSdScheduledReportSchema = z
  .object({
    name: sdName.optional(),
    customerIds: ids.optional(),
    departmentIds: ids.optional(),
    ticketTypes: ticketTypes.optional(),
    period: SdReportPeriodEnum.optional(),
    formats: formats.optional(),
    dayOfMonth: dayOfMonth.optional(),
    atTime: atTime.optional(),
    timezone: timezone.optional(),
    recipients: recipients.optional(),
    includeAccountOwners: z.boolean().optional(),
    /** `false` pausa o agendamento (sem próximo envio); `true` retoma. */
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdScheduledReportDTO = z.infer<
  typeof UpdateSdScheduledReportSchema
>

export const ListSdScheduledReportsSchema = z.object({
  includeInactive: booleanQuery,
})
export type ListSdScheduledReportsDTO = z.infer<
  typeof ListSdScheduledReportsSchema
>

export const ListSdReportRunsSchema = z.object({
  /** Histórico de um agendamento; sem ele, o histórico do workspace. */
  reportId: sdId.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
export type ListSdReportRunsDTO = z.infer<typeof ListSdReportRunsSchema>

/**
 * "Gerar agora": com `reportId` usa o recorte e os destinatários do
 * agendamento; sem ele é um relatório pontual (sob demanda) com o recorte do
 * próprio pedido. `recipients` sobrepõe os destinatários do agendamento;
 * vazio em um relatório pontual gera os arquivos sem enviar e-mail.
 */
export const GenerateSdReportSchema = z.object({
  reportId: sdId.optional(),
  period: SdReportPeriodEnum.optional(),
  customerIds: ids.optional(),
  departmentIds: ids.optional(),
  ticketTypes: ticketTypes.optional(),
  formats: formats.optional(),
  recipients: recipients.optional(),
})
export type GenerateSdReportDTO = z.infer<typeof GenerateSdReportSchema>

export const SdReportDownloadQuerySchema = z.object({
  format: SdReportFormatEnum.default('PDF'),
})
export type SdReportDownloadQueryDTO = z.infer<
  typeof SdReportDownloadQuerySchema
>
