import z from 'zod'
import { booleanQuery, sdId, sdName } from './sd-config.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

/**
 * Origens de monitoramento (Zabbix ou webhook genérico) e o corpo do alerta
 * recebido na entrada pública `POST /api/servicedesk/monitoring/<token>`.
 */

export const SdMonitorKindEnum = z.enum(['ZABBIX', 'WEBHOOK'])
export type SdMonitorKindInput = z.infer<typeof SdMonitorKindEnum>

export const SdMonitorAlertStatusEnum = z.enum(['OPEN', 'RESOLVED', 'IGNORED'])

/** `severidade da origem → prioridade do ServiceDesk`. */
export const SdMonitorSeverityMapEntrySchema = z.object({
  /** Severidade como a origem manda (comparada sem diferenciar maiúsculas). */
  from: z.string().trim().min(1, 'Informe a severidade').max(60),
  priorityId: sdId,
})
export type SdMonitorSeverityMapEntryDTO = z.infer<
  typeof SdMonitorSeverityMapEntrySchema
>

export const SdMonitorSeverityMapSchema = z
  .array(SdMonitorSeverityMapEntrySchema)
  .max(20, 'Até 20 severidades')
  .refine(
    (entries) =>
      new Set(entries.map((e) => e.from.toLowerCase())).size === entries.length,
    { message: 'Severidade repetida no mapa' },
  )

const nullableId = sdId.nullable().optional()

const flappingWindowMinutes = z
  .number()
  .int()
  .min(0, 'A janela não pode ser negativa')
  .max(1440, 'A janela vai até 1440 minutos (24 h)')

export const CreateSdMonitorSourceSchema = z.object({
  name: sdName,
  kind: SdMonitorKindEnum.default('ZABBIX'),
  active: z.boolean().default(true),
  ticketType: SdTicketTypeEnum.default('INCIDENT'),
  departmentId: nullableId,
  categoryId: nullableId,
  customerId: nullableId,
  severityMap: SdMonitorSeverityMapSchema.default([]),
  autoResolve: z.boolean().default(true),
  flappingWindowMinutes: flappingWindowMinutes.default(30),
})
export type CreateSdMonitorSourceDTO = z.infer<
  typeof CreateSdMonitorSourceSchema
>

export const UpdateSdMonitorSourceSchema = z
  .object({
    name: sdName.optional(),
    kind: SdMonitorKindEnum.optional(),
    active: z.boolean().optional(),
    ticketType: SdTicketTypeEnum.optional(),
    departmentId: nullableId,
    categoryId: nullableId,
    customerId: nullableId,
    severityMap: SdMonitorSeverityMapSchema.optional(),
    autoResolve: z.boolean().optional(),
    flappingWindowMinutes: flappingWindowMinutes.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdMonitorSourceDTO = z.infer<
  typeof UpdateSdMonitorSourceSchema
>

export const ListSdMonitorSourcesSchema = z.object({
  includeInactive: booleanQuery,
})
export type ListSdMonitorSourcesDTO = z.infer<typeof ListSdMonitorSourcesSchema>

export const ListSdMonitorAlertsSchema = z.object({
  sourceId: sdId.optional(),
  /** Alerta que abriu este chamado (bloco de origem na tela do chamado). */
  ticketId: sdId.optional(),
  status: SdMonitorAlertStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListSdMonitorAlertsDTO = z.infer<typeof ListSdMonitorAlertsSchema>

/** Token da URL pública: 32 bytes em base64url (como o da aprovação). */
export const SdMonitorTokenSchema = z
  .string()
  .min(20)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/)
