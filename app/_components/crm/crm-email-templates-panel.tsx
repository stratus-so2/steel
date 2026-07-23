'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useCreateCrmEmailTemplate,
  useCrmEmailTemplates,
  useDeleteCrmEmailTemplate,
} from '@/src/hooks/use-crm-email-marketing'

export function CrmEmailTemplatesPanel({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data: templates, isLoading } = useCrmEmailTemplates(workspaceId)
  const deleteTemplate = useDeleteCrmEmailTemplate(workspaceId)

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
        <CreateCrmEmailTemplateDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Assunto</TableHead>
            <TableHead className='w-10' />
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
              <TableCell>
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
    </div>
  )
}

function CreateCrmEmailTemplateDialog({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const createTemplate = useCreateCrmEmailTemplate(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setSubject('')
    setContentHtml('')
    createTemplate.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createTemplate.mutateAsync({ name, subject, contentHtml })
      notify.success('Template criado')
      handleClose()
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
            <Field>
              <Textarea
                placeholder='Conteúdo (HTML)'
                value={contentHtml}
                onChange={(e) => setContentHtml(e.target.value)}
                rows={8}
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
              disabled={
                createTemplate.isPending || !name || !subject || !contentHtml
              }
            >
              {createTemplate.isPending ? 'Criando...' : 'Criar template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
