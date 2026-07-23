'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
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
  useCreateCrmLandingPage,
  useCrmLandingPages,
  useDeleteCrmLandingPage,
  useSetCrmLandingPagePublished,
  useUpdateCrmLandingPage,
} from '@/src/hooks/use-crm-landing-page'
import type { CrmLandingPageStatusDTO } from '@/types/crm-landing-page'

const STATUS_VARIANT: Record<
  CrmLandingPageStatusDTO,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  PUBLISHED: 'default',
}

export function CrmLandingPagesPanel({ workspaceId }: { workspaceId: string }) {
  const { data: pages, isLoading } = useCrmLandingPages(workspaceId)
  const deletePage = useDeleteCrmLandingPage(workspaceId)
  const setPublished = useSetCrmLandingPagePublished(workspaceId)

  async function handleDelete(pageId: string) {
    try {
      await deletePage.mutateAsync(pageId)
      notify.success('Landing page removida')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleTogglePublished(pageId: string, published: boolean) {
    try {
      await setPublished.mutateAsync({ pageId, published })
      notify.success(published ? 'Página publicada' : 'Página despublicada')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-end'>
        <CreateCrmLandingPageDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Link público</TableHead>
            <TableHead className='w-56' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && pages?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhuma landing page
              </TableCell>
            </TableRow>
          )}
          {pages?.map((page) => (
            <TableRow key={page.id}>
              <TableCell>{page.title}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[page.status]}>
                  {page.status}
                </Badge>
              </TableCell>
              <TableCell className='max-w-56 truncate font-mono text-xs'>
                {page.status === 'PUBLISHED'
                  ? `/api/crm/landing-pages/${page.shareToken}`
                  : '-'}
              </TableCell>
              <TableCell className='flex items-center justify-end gap-1'>
                <EditCrmLandingPageDialog
                  workspaceId={workspaceId}
                  page={page}
                />
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() =>
                    handleTogglePublished(page.id, page.status !== 'PUBLISHED')
                  }
                >
                  {page.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}
                </Button>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(page.id)}
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

function EditCrmLandingPageDialog({
  workspaceId,
  page,
}: {
  workspaceId: string
  page: { id: string; title: string; html: string }
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(page.title)
  const [html, setHtml] = useState(page.html)
  const updatePage = useUpdateCrmLandingPage(workspaceId)

  function handleClose() {
    setOpen(false)
    updatePage.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await updatePage.mutateAsync({ pageId: page.id, data: { title, html } })
      notify.success('Landing page atualizada')
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
          <Button variant='outline' size='xs'>
            Editar
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-lg'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Título'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Textarea
                placeholder='HTML da página'
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={10}
                className='font-mono text-xs'
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
              disabled={updatePage.isPending || !title}
            >
              {updatePage.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateCrmLandingPageDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [html, setHtml] = useState('')
  const createPage = useCreateCrmLandingPage(workspaceId)

  function handleClose() {
    setOpen(false)
    setTitle('')
    setHtml('')
    createPage.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createPage.mutateAsync({ title, html })
      notify.success('Landing page criada')
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
            Nova landing page
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-lg'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Título'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Textarea
                placeholder='HTML da página (opcional)'
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                rows={8}
                className='font-mono text-xs'
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
              disabled={createPage.isPending || !title}
            >
              {createPage.isPending ? 'Criando...' : 'Criar página'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
