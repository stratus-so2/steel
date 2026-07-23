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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  useCreateCrmProposal,
  useCrmProposals,
  useDeleteCrmProposal,
  useSetCrmProposalPublished,
  useUpdateCrmProposal,
} from '@/src/hooks/use-crm-proposal'
import type {
  CrmDocumentTypeDTO,
  CrmProposalStatusDTO,
} from '@/types/crm-proposal'

const DOCUMENT_TYPES: CrmDocumentTypeDTO[] = [
  'PROPOSAL',
  'PREMISES',
  'PORTFOLIO',
  'CONTRACT',
]

const STATUS_VARIANT: Record<
  CrmProposalStatusDTO,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  PUBLISHED: 'default',
}

export function CrmProposalsPanel({ workspaceId }: { workspaceId: string }) {
  const { data: proposals, isLoading } = useCrmProposals(workspaceId)
  const deleteProposal = useDeleteCrmProposal(workspaceId)
  const setPublished = useSetCrmProposalPublished(workspaceId)

  async function handleDelete(proposalId: string) {
    try {
      await deleteProposal.mutateAsync(proposalId)
      notify.success('Documento removido')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleTogglePublished(proposalId: string, published: boolean) {
    try {
      await setPublished.mutateAsync({ proposalId, published })
      notify.success(
        published ? 'Documento publicado' : 'Documento despublicado',
      )
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-end'>
        <CreateCrmProposalDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Link público</TableHead>
            <TableHead className='w-56' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && proposals?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className='text-center text-muted-foreground'
              >
                Nenhum documento
              </TableCell>
            </TableRow>
          )}
          {proposals?.map((proposal) => (
            <TableRow key={proposal.id}>
              <TableCell>{proposal.title}</TableCell>
              <TableCell>{proposal.type}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[proposal.status]}>
                  {proposal.status}
                </Badge>
              </TableCell>
              <TableCell className='max-w-56 truncate font-mono text-xs'>
                {proposal.status === 'PUBLISHED'
                  ? `/api/crm/proposals/${proposal.shareToken}`
                  : '-'}
              </TableCell>
              <TableCell className='flex items-center justify-end gap-1'>
                <EditCrmProposalDialog
                  workspaceId={workspaceId}
                  proposal={proposal}
                />
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() =>
                    handleTogglePublished(
                      proposal.id,
                      proposal.status !== 'PUBLISHED',
                    )
                  }
                >
                  {proposal.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}
                </Button>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(proposal.id)}
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

function EditCrmProposalDialog({
  workspaceId,
  proposal,
}: {
  workspaceId: string
  proposal: {
    id: string
    title: string
    content: string
    type: CrmDocumentTypeDTO
  }
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(proposal.title)
  const [content, setContent] = useState(proposal.content)
  const [type, setType] = useState<CrmDocumentTypeDTO>(proposal.type)
  const updateProposal = useUpdateCrmProposal(workspaceId)

  function handleClose() {
    setOpen(false)
    updateProposal.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await updateProposal.mutateAsync({
        proposalId: proposal.id,
        data: { title, content, type },
      })
      notify.success('Documento atualizado')
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
              <Select
                items={DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))}
                value={type}
                onValueChange={(value) => setType(value as CrmDocumentTypeDTO)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Textarea
                placeholder='Conteúdo (HTML)'
                value={content}
                onChange={(e) => setContent(e.target.value)}
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
              disabled={updateProposal.isPending || !title}
            >
              {updateProposal.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateCrmProposalDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<CrmDocumentTypeDTO>('PROPOSAL')
  const createProposal = useCreateCrmProposal(workspaceId)

  function handleClose() {
    setOpen(false)
    setTitle('')
    setType('PROPOSAL')
    createProposal.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createProposal.mutateAsync({ title, type })
      notify.success('Documento criado')
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
            Novo documento
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
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
              <Select
                items={DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))}
                value={type}
                onValueChange={(value) => setType(value as CrmDocumentTypeDTO)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
              disabled={createProposal.isPending || !title}
            >
              {createProposal.isPending ? 'Criando...' : 'Criar documento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
