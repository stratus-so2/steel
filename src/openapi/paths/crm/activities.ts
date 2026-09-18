import { z } from 'zod'
import { ListCrmActivitiesSchema } from '@/src/schemas/crm-activity.schema'
import {
  CreateCrmCalendarEventSchema,
  UpdateCrmCalendarEventSchema,
} from '@/src/schemas/crm-email-sync.schema'
import {
  CreateCrmNoteSchema,
  ListCrmNotesSchema,
  ReorderCrmNotesSchema,
  UpdateCrmNoteSchema,
} from '@/src/schemas/crm-note.schema'
import {
  CreateCrmTaskSchema,
  ListCrmTasksSchema,
  ReorderCrmTasksSchema,
  UpdateCrmTaskSchema,
} from '@/src/schemas/crm-task.schema'
import type { RouteConfig } from '../../registry'
import {
  CrmActivityDTO,
  CrmCalendarEventDTO,
  CrmNoteDTO,
  CrmTaskDTO,
} from '../../schemas/crm/activities'
import { CRM_ERRORS, crmAccess, describe, notFoundError } from './shared'

/** CRM · Atividades e tarefas — `activities`, `tasks/**`, `notes/**`, `calendar-events/**`. */

const TAG = 'CRM · Atividades e tarefas' as const

const TASK_ID = { taskId: 'ID da tarefa.' }
const NOTE_ID = { noteId: 'ID da nota.' }
const EVENT_ID = { eventId: 'ID do evento de calendário.' }

const TASK_NOT_FOUND = notFoundError('CrmTask', 'Tarefa inexistente')
const NOTE_NOT_FOUND = notFoundError('CrmNote', 'Nota inexistente')
const EVENT_NOT_FOUND = notFoundError('CrmCalendarEvent', 'Evento inexistente')

const REORDER_NOTE =
  '`orderedIds` é a nova ordem completa: o índice de cada ID vira sua `position`.'

const CLEARABLE_NOTE =
  'Atualização parcial; `null` (ou `""` nos textos) limpa o valor ou desvincula o registro.'

export const crmActivitiesRoutes: RouteConfig[] = [
  /* ------------------------------- atividades ------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/activities',
    tags: [TAG],
    summary: 'Listar atividades',
    description: describe(
      'Linha do tempo gerada automaticamente pelas mutações do CRM (criação/edição de registros), da mais recente para a mais antiga. Filtre por empresa, pessoa ou oportunidade.',
      crmAccess('audit-logs', 'VIEW'),
    ),
    query: ListCrmActivitiesSchema,
    responses: {
      200: { description: 'Atividades.', schema: z.array(CrmActivityDTO) },
    },
    errors: CRM_ERRORS,
  },

  /* --------------------------------- tarefas -------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/tasks',
    tags: [TAG],
    summary: 'Listar tarefas',
    description: describe(
      'Filtros opcionais por registro vinculado e status.',
      crmAccess('tasks', 'VIEW'),
    ),
    query: ListCrmTasksSchema,
    responses: {
      200: { description: 'Tarefas.', schema: z.array(CrmTaskDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/tasks',
    tags: [TAG],
    summary: 'Criar tarefa',
    description: describe(
      'Status padrão `TODO`. Registra atividade e dispara os workflows de "tarefa criada".',
      crmAccess('tasks', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmTaskSchema,
    responses: { 201: { description: 'Tarefa criada.', schema: CrmTaskDTO } },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/tasks/reorder',
    tags: [TAG],
    summary: 'Reordenar tarefas',
    description: describe(REORDER_NOTE, crmAccess('tasks', 'EDIT')),
    consent: true,
    body: ReorderCrmTasksSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/tasks/{taskId}',
    tags: [TAG],
    summary: 'Atualizar tarefa',
    description: describe(CLEARABLE_NOTE, crmAccess('tasks', 'EDIT')),
    params: TASK_ID,
    consent: true,
    body: UpdateCrmTaskSchema,
    responses: {
      200: { description: 'Tarefa atualizada.', schema: CrmTaskDTO },
    },
    errors: [...CRM_ERRORS, TASK_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/tasks/{taskId}',
    tags: [TAG],
    summary: 'Excluir tarefa',
    description: crmAccess('tasks', 'DELETE'),
    params: TASK_ID,
    consent: true,
    responses: { 200: { description: 'Tarefa excluída.', schema: null } },
    errors: [...CRM_ERRORS, TASK_NOT_FOUND],
  },

  /* ---------------------------------- notas --------------------------------- */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/notes',
    tags: [TAG],
    summary: 'Listar notas',
    description: describe(
      'Filtros opcionais por registro vinculado.',
      crmAccess('notes', 'VIEW'),
    ),
    query: ListCrmNotesSchema,
    responses: {
      200: { description: 'Notas.', schema: z.array(CrmNoteDTO) },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/notes',
    tags: [TAG],
    summary: 'Criar nota',
    description: describe(
      'Registra atividade e dispara os workflows de "nota criada".',
      crmAccess('notes', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmNoteSchema,
    responses: { 201: { description: 'Nota criada.', schema: CrmNoteDTO } },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/notes/reorder',
    tags: [TAG],
    summary: 'Reordenar notas',
    description: describe(REORDER_NOTE, crmAccess('notes', 'EDIT')),
    consent: true,
    body: ReorderCrmNotesSchema,
    responses: { 200: { description: 'Ordem salva.', schema: null } },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/notes/{noteId}',
    tags: [TAG],
    summary: 'Atualizar nota',
    description: describe(CLEARABLE_NOTE, crmAccess('notes', 'EDIT')),
    params: NOTE_ID,
    consent: true,
    body: UpdateCrmNoteSchema,
    responses: { 200: { description: 'Nota atualizada.', schema: CrmNoteDTO } },
    errors: [...CRM_ERRORS, NOTE_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/notes/{noteId}',
    tags: [TAG],
    summary: 'Excluir nota',
    description: crmAccess('notes', 'DELETE'),
    params: NOTE_ID,
    consent: true,
    responses: { 200: { description: 'Nota excluída.', schema: null } },
    errors: [...CRM_ERRORS, NOTE_NOT_FOUND],
  },

  /* --------------------------- eventos de calendário ------------------------ */
  {
    method: 'get',
    path: '/workspaces/{id}/crm/calendar-events',
    tags: [TAG],
    summary: 'Listar eventos de calendário',
    description: describe(
      'Eventos do workspace, opcionalmente filtrados por pessoa ou oportunidade.',
      crmAccess('email', 'VIEW'),
    ),
    query: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'Só eventos desta pessoa.' },
        opportunityId: {
          type: 'string',
          description: 'Só eventos desta oportunidade.',
        },
      },
    },
    responses: {
      200: {
        description: 'Eventos.',
        schema: z.array(CrmCalendarEventDTO),
      },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/crm/calendar-events',
    tags: [TAG],
    summary: 'Criar evento de calendário',
    description: describe(
      'Evento registrado no CRM (opcionalmente associado a uma conta de e-mail sincronizada em `accountId`). `attendees` são e-mails.',
      crmAccess('email', 'CREATE'),
    ),
    consent: true,
    body: CreateCrmCalendarEventSchema,
    responses: {
      201: { description: 'Evento criado.', schema: CrmCalendarEventDTO },
    },
    errors: CRM_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/crm/calendar-events/{eventId}',
    tags: [TAG],
    summary: 'Atualizar evento de calendário',
    description: describe(
      'Atualização parcial de título, descrição, horário e participantes.',
      crmAccess('email', 'EDIT'),
    ),
    params: EVENT_ID,
    consent: true,
    body: UpdateCrmCalendarEventSchema,
    responses: {
      200: { description: 'Evento atualizado.', schema: CrmCalendarEventDTO },
    },
    errors: [...CRM_ERRORS, EVENT_NOT_FOUND],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/crm/calendar-events/{eventId}',
    tags: [TAG],
    summary: 'Excluir evento de calendário',
    description: crmAccess('email', 'DELETE'),
    params: EVENT_ID,
    consent: true,
    responses: { 200: { description: 'Evento excluído.', schema: null } },
    errors: [...CRM_ERRORS, EVENT_NOT_FOUND],
  },
]
