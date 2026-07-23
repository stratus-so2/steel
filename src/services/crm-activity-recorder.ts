import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'

type Event = 'created' | 'updated' | 'deleted'
type Entity = 'company' | 'person' | 'opportunity' | 'task' | 'note'

const EVENT_TO_ACTION: Record<Event, string> = {
  created: 'CREATED',
  updated: 'UPDATED',
  deleted: 'DELETED',
}

const ENTITY_LABEL: Record<Entity, string> = {
  company: 'Empresa',
  person: 'Pessoa',
  opportunity: 'Oportunidade',
  task: 'Tarefa',
  note: 'Anotação',
}

const ACTION_LABEL: Record<Event, string> = {
  created: 'criou',
  updated: 'atualizou',
  deleted: 'removeu',
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Resolve os vínculos de timeline (company/person/opportunity) a partir do
 * DTO. Para a própria entidade, o `id` é o vínculo (ex.: company →
 * companyId = id). Para entidades-filho usa os FKs do registro.
 */
function resolveLinks(
  entity: Entity,
  record: Record<string, unknown>,
): { companyId?: string; personId?: string; opportunityId?: string } {
  const id = str(record.id)
  return {
    companyId: entity === 'company' ? id : str(record.companyId),
    personId:
      entity === 'person'
        ? id
        : (str(record.personId) ?? str(record.pointOfContactId)),
    opportunityId: entity === 'opportunity' ? id : str(record.opportunityId),
  }
}

/** Texto curto para a timeline (ex.: "atualizou Empresa Acme"). */
function buildSummary(
  entity: Entity,
  event: Event,
  record: Record<string, unknown>,
): string {
  const name = str(record.name) ?? str(record.title) ?? ''
  const base = `${ACTION_LABEL[event]} ${ENTITY_LABEL[entity]}`
  return name ? `${base} ${name}` : base
}

/**
 * Registra uma atividade de CRUD na timeline. Chamado pelos services de
 * Empresas/Pessoas/Oportunidades/Tarefas/Notas após create/update/delete.
 * **Nunca lança** — falha de auditoria não pode derrubar a operação
 * principal; `CrmActivityRepository.record` já engole erros de banco e
 * retorna `Result`, então basta ignorar o resultado.
 */
export async function recordCrmActivity(params: {
  workspaceId: string
  actorUserId: string
  entity: Entity
  event: Event
  record: object
}): Promise<void> {
  const record = params.record as Record<string, unknown>
  const entityId = str(record.id)
  if (!entityId) return

  const links = resolveLinks(params.entity, record)

  await CrmActivityRepository.record({
    workspaceId: params.workspaceId,
    actorUserId: params.actorUserId,
    action: EVENT_TO_ACTION[params.event],
    entity: params.entity,
    entityId,
    companyId: links.companyId,
    personId: links.personId,
    opportunityId: links.opportunityId,
    summary: buildSummary(params.entity, params.event, record),
  })
}
