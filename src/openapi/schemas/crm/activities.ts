import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs de atividades, tarefas, notas e eventos de calendário
 * (`types/crm-activity.d.ts`, `crm-task.d.ts`, `crm-note.d.ts`,
 * `crm-email-sync.d.ts`).
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

export const CrmActivityDTO = dto(
  'CrmActivity',
  z
    .object({
      id: z.string(),
      workspaceId: z.string(),
      actorUserId: z
        .string()
        .nullable()
        .meta({ description: '`null` quando a ação veio do sistema.' }),
      action: z.string().meta({ example: 'created' }),
      entity: z.string().meta({ example: 'task' }),
      entityId: z.string(),
      companyId: z.string().nullable(),
      personId: z.string().nullable(),
      opportunityId: z.string().nullable(),
      summary: z.string().nullable(),
      createdAt: dateTime(),
    })
    .meta({ description: 'Evento da linha do tempo do CRM.' }),
)

export const CrmTaskDTO = dto(
  'CrmTask',
  z.object({
    id: z.string(),
    title: z.string().meta({ example: 'Ligar para o cliente' }),
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
    body: z.string().nullable(),
    dueDate: nullableDateTime(),
    assigneeId: z.string().nullable(),
    companyId: z.string().nullable(),
    personId: z.string().nullable(),
    opportunityId: z.string().nullable(),
    workspaceId: z.string(),
    createdById: z.string(),
    updatedById: z.string().nullable(),
    position: z.number(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const CrmNoteDTO = dto(
  'CrmNote',
  z.object({
    id: z.string(),
    title: z.string().nullable(),
    body: z.string().nullable(),
    companyId: z.string().nullable(),
    personId: z.string().nullable(),
    opportunityId: z.string().nullable(),
    leadId: z.string().nullable(),
    workspaceId: z.string(),
    createdById: z.string(),
    updatedById: z.string().nullable(),
    position: z.number(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const CrmCalendarEventDTO = dto(
  'CrmCalendarEvent',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    accountId: z
      .string()
      .nullable()
      .meta({ description: 'Conta de e-mail sincronizada vinculada.' }),
    createdById: z.string(),
    title: z.string().meta({ example: 'Reunião de apresentação' }),
    description: z.string().nullable(),
    startsAt: dateTime(),
    endsAt: dateTime(),
    attendees: z.array(z.string()).meta({ example: ['carlos@empresa.com.br'] }),
    personId: z.string().nullable(),
    opportunityId: z.string().nullable(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)
