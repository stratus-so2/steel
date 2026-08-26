'use client'

import { LayoutTopIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { apiFetch } from '@/src/hooks/_fetch'
import {
  createCrmResource,
  useCrmResourceList,
} from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import {
  MARKETING_TEMPLATES,
  type MarketingTemplateId,
} from '@/src/lib/crm-marketing-templates'
import type { CrmEmailTemplateDTO } from '@/types/crm-email-marketing'

const LOOKUP_KINDS: LookupKind[] = ['users']

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    required: true,
    primary: true,
    placeholder: 'Boas-vindas',
  },
  {
    key: 'subject',
    header: 'Assunto',
    kind: 'text',
    required: true,
    placeholder: 'Seja bem-vindo ao nosso CRM',
  },
  {
    key: 'contentHtml',
    header: 'Conteúdo',
    kind: 'emailhtml',
    required: true,
    placeholder: 'Escrever email…',
  },
  {
    key: 'createdById',
    header: 'Criado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  {
    key: 'updatedById',
    header: 'Atualizado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

export function CrmEmailTemplatesTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmEmailTemplateDTO>(
    workspaceId,
    'email-templates',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const columns = useMemo(() => COLUMNS, [])
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false)

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div className='flex shrink-0 justify-end'>
        <Button
          size='sm'
          variant='outline'
          onClick={() => setLayoutDialogOpen(true)}
        >
          <SteelIcon icon={LayoutTopIcon} strokeWidth={2} />
          Criar a partir de um layout
        </Button>
      </div>
      <div className='min-h-0 flex-1'>
        <DataTable
          columns={columns}
          data={items}
          workspaceId={workspaceId}
          slug={slug}
          resource='email-templates'
          createTitle='template'
          lookups={lookups}
          isLoading={isLoading}
          searchPlaceholder='Buscar templates…'
          refetch={refetch}
        />
      </div>

      <CreateFromLayoutDialog
        workspaceId={workspaceId}
        open={layoutDialogOpen}
        onClose={() => setLayoutDialogOpen(false)}
        onCreated={() => {
          setLayoutDialogOpen(false)
          refetch()
        }}
      />
    </div>
  )
}

/** Fluxo "escolher layout → preencher texto/imagem" — a única forma de criar
 * um template a partir de um dos layouts fixos em MARKETING_TEMPLATES;
 * estrutura/estilo não são editáveis, só os campos declarados no layout. */
function CreateFromLayoutDialog({
  workspaceId,
  open,
  onClose,
  onCreated,
}: {
  workspaceId: string
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [templateId, setTemplateId] = useState<MarketingTemplateId | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [previewHtml, setPreviewHtml] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTemplateId(null)
      setName('')
      setSubject('')
      setFieldValues({})
      setPreviewHtml('')
    }
  }, [open])

  useEffect(() => {
    if (!templateId) return
    setFieldValues(MARKETING_TEMPLATES[templateId].defaultProps)
  }, [templateId])

  useEffect(() => {
    if (!templateId) return
    const handle = setTimeout(async () => {
      try {
        const result = await apiFetch<{ html: string }>(
          `/api/workspaces/${workspaceId}/crm/email-templates/preview`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId, templateProps: fieldValues }),
          },
          'Erro ao gerar preview',
        )
        setPreviewHtml(result.html)
      } catch {
        // Preview é best-effort; erros de digitação parcial não bloqueiam o form.
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [templateId, fieldValues, workspaceId])

  async function handleSubmit() {
    if (!templateId) return
    if (!name.trim()) {
      notify.error('Informe o nome do template')
      return
    }
    if (!subject.trim()) {
      notify.error('Informe o assunto')
      return
    }
    const definition = MARKETING_TEMPLATES[templateId]
    for (const field of definition.fields) {
      if (field.required && !fieldValues[field.key]?.trim()) {
        notify.error(`Preencha "${field.label}"`)
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await createCrmResource<CrmEmailTemplateDTO>(
        workspaceId,
        'email-templates',
        {
          name: name.trim(),
          subject: subject.trim(),
          templateId,
          templateProps: fieldValues,
        },
      )
      if (!result.ok) {
        notify.error(result.message ?? 'Não foi possível criar o template.')
        return
      }
      notify.success('Template criado')
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className='flex max-h-[85vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0'>
        <div className='flex items-center justify-between border-b p-4'>
          <DialogTitle>Criar template a partir de um layout</DialogTitle>
        </div>

        {!templateId ? (
          <div className='grid grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2'>
            {Object.values(MARKETING_TEMPLATES).map((def) => (
              <button
                key={def.id}
                type='button'
                onClick={() => setTemplateId(def.id)}
                className='flex flex-col items-start gap-1 rounded-lg border border-border p-4 text-left hover:border-primary hover:bg-muted/40'
              >
                <span className='font-medium text-sm'>{def.label}</span>
                <span className='text-muted-foreground text-xs'>
                  {def.description}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className='grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-2'>
            <div className='flex flex-col gap-4 overflow-y-auto p-4'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='w-fit text-muted-foreground'
                onClick={() => setTemplateId(null)}
              >
                ← Trocar layout
              </Button>

              <div className='grid gap-1.5'>
                <Label className='text-muted-foreground text-xs'>
                  Nome do template
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Ex: Promoção de verão'
                />
              </div>
              <div className='grid gap-1.5'>
                <Label className='text-muted-foreground text-xs'>
                  Assunto do email
                </Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder='Ex: Não perca essa novidade'
                />
              </div>

              {MARKETING_TEMPLATES[templateId].fields.map((field) => (
                <div key={field.key} className='grid gap-1.5'>
                  <Label className='text-muted-foreground text-xs'>
                    {field.label}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={fieldValues[field.key] ?? ''}
                      onChange={(e) =>
                        setFieldValues((cur) => ({
                          ...cur,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      rows={4}
                    />
                  ) : (
                    <Input
                      value={fieldValues[field.key] ?? ''}
                      onChange={(e) =>
                        setFieldValues((cur) => ({
                          ...cur,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={
                        field.type === 'image'
                          ? 'https://…/imagem.png'
                          : field.placeholder
                      }
                      type={field.type === 'url' ? 'url' : 'text'}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className='hidden min-h-0 border-l bg-muted/30 sm:block'>
              {previewHtml ? (
                <iframe
                  title='Preview do email'
                  srcDoc={previewHtml}
                  className='h-full w-full border-0'
                />
              ) : (
                <div className='flex h-full items-center justify-center text-muted-foreground text-xs'>
                  Preview aparece aqui
                </div>
              )}
            </div>
          </div>
        )}

        <div className='flex shrink-0 items-center justify-end gap-2 border-t p-3'>
          <Button variant='ghost' onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          {templateId ? (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Criando…' : 'Criar template'}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
