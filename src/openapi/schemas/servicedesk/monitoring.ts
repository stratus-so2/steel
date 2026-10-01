import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs do monitoramento do ServiceDesk (`types/sd-monitor.d.ts`): origens
 * (Zabbix / webhook genérico) e os alertas recebidos.
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const Kind = z.enum(['ZABBIX', 'WEBHOOK'])
const AlertStatus = z.enum(['OPEN', 'RESOLVED', 'IGNORED'])
const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])

const SeverityMapEntry = z.object({
  from: z.string().meta({
    description: 'Severidade como a origem manda (comparada sem caixa).',
    example: 'Disaster',
  }),
  priorityId: z.string(),
})

const sourceShape = {
  id: z.string(),
  name: z.string().meta({ example: 'Zabbix matriz' }),
  kind: Kind,
  active: z.boolean(),
  ticketType: TicketType,
  departmentId: z.string().nullable(),
  categoryId: z.string().nullable(),
  customerId: z.string().nullable(),
  severityMap: z.array(SeverityMapEntry),
  autoResolve: z.boolean().meta({
    description:
      'Leva o chamado à fase RESOLVED do tipo quando o alerta normaliza.',
  }),
  flappingWindowMinutes: z.number().int().meta({
    description:
      'O mesmo alerta voltando dentro desta janela reabre o chamado anterior em vez de abrir outro (0 desliga).',
    example: 30,
  }),
  lastEventAt: nullableDateTime(),
  createdAt: dateTime(),
  updatedAt: dateTime(),
}

export const SdMonitorSourceDTO = dto('SdMonitorSource', z.object(sourceShape))

export const SdMonitorSourceWithTokenDTO = dto(
  'SdMonitorSourceWithToken',
  z.object({
    ...sourceShape,
    token: z.string().meta({
      description:
        'Token da URL pública, em claro. **Só aparece aqui** — o banco guarda apenas o SHA-256.',
      example: 'q8Zr4m2XoV0n1bQ5d7T3k9Wc6yLpA2sHjE4uR8tN0fG',
    }),
    webhookPath: z.string().meta({
      description: 'Caminho a colar na ferramenta, sem o domínio.',
      example:
        '/api/servicedesk/monitoring/q8Zr4m2XoV0n1bQ5d7T3k9Wc6yLpA2sHjE4uR8tN0fG',
    }),
  }),
)

export const SdMonitorAlertDTO = dto(
  'SdMonitorAlert',
  z.object({
    id: z.string(),
    sourceId: z.string(),
    sourceName: z.string(),
    status: AlertStatus,
    externalId: z.string().meta({
      description:
        'Chave de deduplicação dentro da origem (`{EVENT.ID}` do Zabbix). Sem id explícito, o hash de `host|assunto` (`auto:…`).',
      example: '31415',
    }),
    severity: z.string().nullable(),
    host: z.string().nullable(),
    subject: z.string(),
    body: z.string().nullable(),
    configItem: z
      .object({ id: z.string(), name: z.string() })
      .nullable()
      .meta({ description: 'Item de configuração casado pelo host.' }),
    ticket: z
      .object({
        id: z.string(),
        number: z.number().int(),
        title: z.string(),
        phase: z.string(),
      })
      .nullable(),
    startedAt: dateTime(),
    resolvedAt: nullableDateTime(),
    createdAt: dateTime(),
  }),
)

export const SdMonitorIngestDTO = dto(
  'SdMonitorIngest',
  z.object({
    alertId: z.string(),
    status: AlertStatus,
    outcome: z
      .enum([
        'ticket_created',
        'ticket_reopened',
        'alert_updated',
        'ticket_resolved',
        'alert_resolved',
      ])
      .meta({ description: 'O que o alerta provocou no ServiceDesk.' }),
    ticket: z
      .object({
        id: z.string(),
        number: z.number().int(),
        code: z.string().nullable(),
      })
      .nullable(),
  }),
)

/** Corpo aceito na entrada pública (Zabbix e genérico, tolerante). */
export const SdMonitorAlertPayload = dto(
  'SdMonitorAlertPayload',
  z
    .object({
      externalId: z.string().optional(),
      status: z.string().optional(),
      severity: z.string().optional(),
      host: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      tags: z.array(z.string()).optional(),
      startedAt: z.string().optional(),
      eventId: z.string().optional(),
      eventValue: z.string().optional(),
      eventStatus: z.string().optional(),
      eventName: z.string().optional(),
      eventSeverity: z.string().optional(),
      eventDate: z.string().optional(),
      eventTime: z.string().optional(),
      eventTags: z.string().optional(),
      hostName: z.string().optional(),
      hostIp: z.string().optional(),
      message: z.string().optional(),
    })
    .loose(),
)
