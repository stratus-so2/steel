import type { SdTicketTemplate } from '@prisma/client'
import z from 'zod'
import {
  type SdTicketTemplateDefaults,
  SdTicketTemplateDefaultsSchema,
  SdTicketTemplateTaskSchema,
} from '@/src/schemas/sd-ticket-template.schema'
import type {
  SdTicketTemplateDTO,
  SdTicketTemplateTaskDTO,
} from '@/types/sd-config'

export function toSdTemplateDefaults(value: unknown): SdTicketTemplateDefaults {
  const parsed = SdTicketTemplateDefaultsSchema.safeParse(value)
  return parsed.success ? parsed.data : {}
}

export function toSdTemplateTasks(value: unknown): SdTicketTemplateTaskDTO[] {
  const parsed = z.array(z.unknown()).safeParse(value)
  if (!parsed.success) return []
  return parsed.data.flatMap((item) => {
    const task = SdTicketTemplateTaskSchema.safeParse(item)
    return task.success ? [task.data] : []
  })
}

export function toSdTicketTemplateDTO(
  template: SdTicketTemplate,
): SdTicketTemplateDTO {
  return {
    id: template.id,
    ticketType: template.ticketType,
    name: template.name,
    description: template.description,
    defaults: toSdTemplateDefaults(template.defaults),
    tasks: toSdTemplateTasks(template.tasks),
    portalVisible: template.portalVisible,
    active: template.active,
    position: template.position,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}
