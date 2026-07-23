'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { EmailEditorPanel } from '@/app/_components/crm/email-editor-panel'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import {
  useCreateCrmEmailTemplate,
  useCrmEmailTemplates,
  useDeleteCrmEmailTemplate,
  useUpdateCrmEmailTemplate,
} from '@/src/hooks/use-crm-email-marketing'
import type { CrmEmailTemplateDTO } from '@/types/crm-email-marketing'

export function CrmEmailTemplatesPanel({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data: templates, isLoading } = useCrmEmailTemplates(workspaceId)
  const deleteTemplate = useDeleteCrmEmailTemplate(workspaceId)
  const [editingTemplate, setEditingTemplate] =
    useState<CrmEmailTemplateDTO | null>(null)

  async function handleDelete(templateId: string) {
    try {
      await deleteTemplate.mutateAsync(templateId)
      notify.success('Template removido')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-end'>
        <CreateCrmEmailTemplateDialog
          workspaceId={workspaceId}
          onCreated={setEditingTemplate}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Assunto</TableHead>
            <TableHead className='w-24' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && templates?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className='text-center text-muted-foreground'
              >
                Nenhum template de e-mail
              </TableCell>
            </TableRow>
          )}
          {templates?.map((template) => (
            <TableRow key={template.id}>
              <TableCell>{template.name}</TableCell>
              <TableCell>{template.subject}</TableCell>
              <TableCell className='flex items-center justify-end gap-1'>
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() => setEditingTemplate(template)}
                >
                  Editar conteúdo
                </Button>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(template.id)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editingTemplate && (
        <EditCrmEmailTemplateContentPanel
          workspaceId={workspaceId}
          template={editingTemplate}
          onOpenChange={(open) => {
            if (!open) setEditingTemplate(null)
          }}
        />
      )}
    </div>
  )
}

function EditCrmEmailTemplateContentPanel({
  workspaceId,
  template,
  onOpenChange,
}: {
  workspaceId: string
  template: CrmEmailTemplateDTO
  onOpenChange: (open: boolean) => void
}) {
  const updateTemplate = useUpdateCrmEmailTemplate(workspaceId)

  async function handleSave(html: string) {
    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data: { contentHtml: html },
      })
      notify.success('Conteúdo salvo')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <EmailEditorPanel
      open
      onOpenChange={onOpenChange}
      value={template.contentHtml}
      title={template.name}
      onSave={handleSave}
    />
  )
}

function CreateCrmEmailTemplateDialog({
  workspaceId,
  onCreated,
}: {
  workspaceId: string
  onCreated: (template: CrmEmailTemplateDTO) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const createTemplate = useCreateCrmEmailTemplate(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setSubject('')
    createTemplate.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const created = await createTemplate.mutateAsync({
        name,
        subject,
        contentHtml: '<p></p>',
      })
      handleClose()
      onCreated(created)
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          <Button variant='default' size='xs'>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo template
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Input
                placeholder='Assunto'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          <div className='flex justify-end gap-2'>
            <DialogClose
              render={
                <Button
                  variant='outline'
                  size='sm'
                  type='button'
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
              }
            />
            <Button
              size='sm'
              type='submit'
              disabled={createTemplate.isPending || !name || !subject}
            >
              {createTemplate.isPending ? 'Criando...' : 'Criar template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
