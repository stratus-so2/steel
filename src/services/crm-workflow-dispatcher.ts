import {
  parseCrmWorkflowDefinition,
  triggerTypeToPrisma,
} from '@/src/mappers/crm-workflow.mapper'
import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
} from '@/src/repositories/crm-workflow.repository'
import type {
  CrmWorkflowEntity,
  CrmWorkflowTriggerType,
} from '@/src/schemas/crm-workflow.schema'
import { runCrmWorkflow } from '@/src/services/crm-workflow-runner'

type Event = 'created' | 'updated' | 'deleted'

const EVENT_TO_TRIGGER: Record<Event, CrmWorkflowTriggerType[]> = {
  created: ['record-is-created', 'record-is-created-or-updated'],
  updated: ['record-is-updated', 'record-is-created-or-updated'],
  deleted: ['record-is-deleted'],
}

/**
 * Disparado pelos services CRUD (Company/Person/Opportunity/Task/Note) após
 * commit — mesmo ponto de chamada de `recordCrmActivity`, mas para
 * automação em vez de timeline. Carrega workflows ACTIVE da workspace,
 * filtra pelos que casam com `(entity, event)` e dispara uma run por match.
 * Best-effort: nunca lança — erros do runner ficam persistidos no próprio
 * `CrmWorkflowRun`.
 */
export async function dispatchCrmWorkflowRecordEvent(params: {
  workspaceId: string
  actorUserId: string
  entity: CrmWorkflowEntity
  event: Event
  record: unknown
  changedFields?: string[]
}): Promise<void> {
  const candidates = EVENT_TO_TRIGGER[params.event]
  const wfList = await CrmWorkflowRepository.findActiveByWorkspace(
    params.workspaceId,
  )
  if (!wfList.ok || wfList.value.length === 0) return

  for (const wf of wfList.value) {
    if (!wf.activeVersion) continue
    const definition = parseCrmWorkflowDefinition(wf.activeVersion.definition)
    const trigger = definition.trigger.data
    if (!trigger) continue
    if (!candidates.includes(trigger.type)) continue
    if ('entity' in trigger && trigger.entity !== params.entity) continue

    // Trigger update/created-or-updated com `fields` exige interseção.
    if (
      'fields' in trigger &&
      Array.isArray(trigger.fields) &&
      trigger.fields.length > 0 &&
      params.changedFields &&
      params.changedFields.length > 0
    ) {
      const hit = params.changedFields.some((f) => trigger.fields.includes(f))
      if (!hit) continue
    }

    const payload = {
      event: params.event,
      record: params.record,
      changedFields: params.changedFields ?? [],
    }
    const run = await CrmWorkflowRunRepository.create({
      workflowId: wf.id,
      versionId: wf.activeVersion.id,
      triggerType: triggerTypeToPrisma(trigger.type),
      triggerPayload: payload as object,
      startedById: params.actorUserId,
    })
    if (!run.ok) continue

    // Não bloqueia o caller; o runner cuida do status. Erros ficam
    // persistidos no próprio run + steps.
    void runCrmWorkflow({
      runId: run.value.id,
      workspaceId: params.workspaceId,
      actingUserId: params.actorUserId,
      definition,
      triggerType: trigger.type,
      triggerPayload: payload,
      testMode: false,
    }).catch(() => {
      // erros já persistidos no CrmWorkflowRun pelo próprio runner.
    })
  }
}
