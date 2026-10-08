'use client'

import { type RefObject, useRef } from 'react'
import { toast } from 'sonner'
import { useShortcut } from '@/app/_components/shortcuts/shortcuts-provider'
import { notify } from '@/lib/notify'
import { useCrmPipelineStages } from '@/src/hooks/use-crm-pipeline'
import {
  createCrmResource,
  updateCrmResource,
} from '@/src/hooks/use-crm-resource-list'
import type { CrmStageCategoryDTO } from '@/types/crm-pipeline'

/** Field that links a task/note to a record of this resource. */
export const CRM_LINK_FIELD: Record<string, string> = {
  companies: 'companyId',
  people: 'personId',
  opportunities: 'opportunityId',
}

type Record_ = { id: string } & Record<string, unknown>

/**
 * Keyboard of an open CRM record (`crm.record.*`, `crm.opportunity.*`,
 * Ctrl+S): mounted inside the record sheet so it works while it is open.
 */
export function RecordPanelShortcuts<T extends Record_>({
  record,
  workspaceId,
  slug,
  resource,
  onClose,
  onSave,
  onSaved,
}: {
  record: T
  workspaceId: string
  slug: string
  resource: string
  onClose: () => void
  onSave: () => void
  onSaved: (updated: T) => void
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const anchor = ref as RefObject<Element | null>
  const linkField = CRM_LINK_FIELD[resource]
  const name = typeof record.name === 'string' ? record.name : ''
  const pipelineId =
    resource === 'opportunities' && typeof record.pipelineId === 'string'
      ? record.pipelineId
      : ''

  useShortcut('crm.record.back', onClose, { ref: anchor })
  useShortcut('global.save', onSave, { ref: anchor })

  async function createLinked(kind: 'tasks' | 'notes') {
    const title =
      kind === 'tasks'
        ? `Tarefa: ${name || 'registro'}`
        : `Nota: ${name || 'registro'}`
    const res = await createCrmResource<{ id: string }>(workspaceId, kind, {
      title,
      [linkField]: record.id,
    })
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível criar.')
      return
    }
    const id = res.data.id
    toast.success(kind === 'tasks' ? 'Tarefa criada' : 'Nota criada', {
      action: {
        label: 'Abrir',
        onClick: () => {
          window.location.assign(`/${slug}/crm/${kind}?record=${id}`)
        },
      },
    })
  }
  useShortcut('crm.record.new-task', () => void createLinked('tasks'), {
    ref: anchor,
    enabled: Boolean(linkField),
  })
  useShortcut('crm.record.new-note', () => void createLinked('notes'), {
    ref: anchor,
    enabled: Boolean(linkField),
  })

  return (
    <span ref={ref} hidden>
      {pipelineId ? (
        <OpportunityCloseShortcuts
          record={record}
          workspaceId={workspaceId}
          resource={resource}
          pipelineId={pipelineId}
          anchor={anchor}
          onSaved={onSaved}
        />
      ) : null}
    </span>
  )
}

/** Shift+G / Shift+P: move the opportunity to its funnel's won/lost stage. */
function OpportunityCloseShortcuts<T extends Record_>({
  record,
  workspaceId,
  resource,
  pipelineId,
  anchor,
  onSaved,
}: {
  record: T
  workspaceId: string
  resource: string
  pipelineId: string
  anchor: RefObject<Element | null>
  onSaved: (updated: T) => void
}) {
  const stages = useCrmPipelineStages(workspaceId, pipelineId)

  async function close(category: CrmStageCategoryDTO) {
    const stage = stages.data?.find((s) => s.category === category)
    if (!stage) {
      notify.error(
        category === 'WON'
          ? 'O funil não tem etapa de ganho.'
          : 'O funil não tem etapa de perda.',
      )
      return
    }
    const res = await updateCrmResource<T>(workspaceId, resource, record.id, {
      pipelineId,
      stageId: stage.id,
    })
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível atualizar.')
      return
    }
    onSaved(res.data)
    notify.success(
      category === 'WON'
        ? 'Oportunidade marcada como ganha'
        : 'Oportunidade marcada como perdida',
    )
  }
  useShortcut('crm.opportunity.won', () => void close('WON'), { ref: anchor })
  useShortcut('crm.opportunity.lost', () => void close('LOST'), {
    ref: anchor,
  })
  return null
}
