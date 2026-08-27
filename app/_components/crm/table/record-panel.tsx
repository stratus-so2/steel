'use client'

import { Cancel01Icon, Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import * as React from 'react'
import {
  CellEditor,
  type GridColumn,
  type WithId,
} from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { notify } from '@/lib/notify'
import {
  deleteCrmResource,
  updateCrmResource,
} from '@/src/hooks/use-crm-resource-list'
import type { Lookups } from '@/src/hooks/use-crm-workspace-lookups'

/** Painel lateral de detalhes/edição de um registro (estilo Sheet). */
export function RecordPanel<T extends WithId>({
  open,
  onOpenChange,
  record,
  columns,
  workspaceId,
  slug,
  resource,
  title,
  lookups,
  renderExtra,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: T
  columns: GridColumn[]
  /** Usado nas chamadas de API (PATCH/DELETE). */
  workspaceId: string
  /** Usado nos links de navegação das colunas de relação. */
  slug: string
  resource: string
  /** Nome singular da entidade, ex.: "empresa". */
  title: string
  lookups: Lookups
  /** Conteúdo extra abaixo dos campos (ex.: line items da oportunidade). */
  renderExtra?: (record: T) => React.ReactNode
  onSaved: (updated: T) => void
  onDeleted: (id: string) => void
}) {
  const [values, setValues] = React.useState<Record<string, unknown>>(() => ({
    ...(record as Record<string, unknown>),
  }))
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  /** Campos que podem ser alterados (exclui created/updated e datas auto). */
  const editable = React.useMemo(
    () => columns.filter((c) => !c.readonly && c.kind !== 'readonly-date'),
    [columns],
  )

  function setValue(key: string, next: unknown) {
    setValues((cur) => ({ ...cur, [key]: next }))
  }

  async function handleSave() {
    const before = record as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    const customFields: Record<string, unknown> = {}
    for (const col of editable) {
      const prev = before[col.key] ?? null
      const next = values[col.key] ?? null
      if (JSON.stringify(prev) === JSON.stringify(next)) continue
      // Campos customizados (EAV) vão agrupados em `customFields` no PATCH.
      if (col.customFieldId) {
        customFields[col.customFieldId] = next
      } else {
        patch[col.key] = next
      }
    }
    if (Object.keys(customFields).length > 0) {
      patch.customFields = customFields
    }
    if (Object.keys(patch).length === 0) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    const res = await updateCrmResource<T>(
      workspaceId,
      resource,
      record.id,
      patch,
    )
    setSaving(false)
    if (!res.ok || !res.data) {
      notify.error(res.message ?? 'Não foi possível salvar.')
      return
    }
    onSaved(res.data)
    onOpenChange(false)
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    const res = await deleteCrmResource(workspaceId, resource, record.id)
    setDeleting(false)
    if (!res.ok) {
      notify.error(res.message ?? 'Não foi possível excluir.')
      return
    }
    onDeleted(record.id)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        showCloseButton={false}
        className='flex w-[440px] max-w-[440px] flex-col gap-0 p-0 sm:max-w-[440px]'
      >
        {/* Cabeçalho: X (cancelar) à esquerda */}
        <div className='flex items-center gap-2 border-b p-3'>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={() => onOpenChange(false)}
            aria-label='Cancelar'
          >
            <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
          <SheetTitle className='truncate capitalize'>{title}</SheetTitle>
        </div>

        {/* Campos */}
        <div className='min-h-0 flex-1 overflow-y-auto p-4'>
          <div className='grid gap-4'>
            {columns.map((col) => (
              <div key={col.key} className='grid gap-1.5'>
                <span className='text-muted-foreground text-xs'>
                  {col.header}
                </span>
                <div className='min-w-0'>
                  <CellEditor
                    col={col}
                    value={values[col.key]}
                    commit={(v) => setValue(col.key, v)}
                    autofill={(fields) =>
                      setValues((cur) => ({ ...cur, ...fields }))
                    }
                    slug={slug}
                    lookups={lookups}
                    workspaceId={workspaceId}
                  />
                </div>
              </div>
            ))}
          </div>

          {renderExtra ? (
            <div className='mt-6 border-t pt-4'>{renderExtra(record)}</div>
          ) : null}
        </div>

        {/* Ações: Delete + Salvar lado a lado */}
        <div className='flex items-center gap-2 border-t p-3'>
          <Button
            variant='destructive'
            className='flex-1'
            onClick={handleDelete}
            disabled={deleting}
          >
            <SteelIcon icon={Delete02Icon} strokeWidth={2} />
            {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
          </Button>
          <Button className='flex-1' onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
