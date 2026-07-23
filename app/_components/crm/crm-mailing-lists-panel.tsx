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
import { notify } from '@/lib/notify'
import {
  useAddCrmMailingListMember,
  useCreateCrmMailingList,
  useCrmMailingListMembers,
  useCrmMailingLists,
  useDeleteCrmMailingList,
  useRemoveCrmMailingListMember,
} from '@/src/hooks/use-crm-email-marketing'

export function CrmMailingListsPanel({ workspaceId }: { workspaceId: string }) {
  const { data: lists, isLoading } = useCrmMailingLists(workspaceId)
  const deleteList = useDeleteCrmMailingList(workspaceId)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)

  async function handleDelete(listId: string) {
    try {
      await deleteList.mutateAsync(listId)
      notify.success('Lista removida')
      if (selectedListId === listId) setSelectedListId(null)
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-end'>
        <CreateCrmMailingListDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className='w-24' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && lists?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className='text-center text-muted-foreground'
              >
                Nenhuma lista de e-mail
              </TableCell>
            </TableRow>
          )}
          {lists?.map((list) => (
            <TableRow key={list.id}>
              <TableCell>{list.name}</TableCell>
              <TableCell>{list.description ?? '-'}</TableCell>
              <TableCell className='flex items-center justify-end gap-1'>
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() =>
                    setSelectedListId(
                      selectedListId === list.id ? null : list.id,
                    )
                  }
                >
                  Contatos
                </Button>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(list.id)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {selectedListId && (
        <CrmMailingListMembersPanel
          workspaceId={workspaceId}
          listId={selectedListId}
        />
      )}
    </div>
  )
}

function CrmMailingListMembersPanel({
  workspaceId,
  listId,
}: {
  workspaceId: string
  listId: string
}) {
  const { data: members, isLoading } = useCrmMailingListMembers(
    workspaceId,
    listId,
  )
  const removeMember = useRemoveCrmMailingListMember(workspaceId, listId)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const addMember = useAddCrmMailingListMember(workspaceId, listId)

  async function handleAdd(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await addMember.mutateAsync({ email, name: name || undefined })
      setEmail('')
      setName('')
      notify.success('Contato adicionado')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await removeMember.mutateAsync(memberId)
      notify.success('Contato removido')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-2 rounded-md border p-3'>
      <form onSubmit={handleAdd} className='flex items-center gap-2'>
        <Input
          placeholder='E-mail'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          placeholder='Nome (opcional)'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          type='submit'
          size='xs'
          disabled={addMember.isPending || !email}
        >
          <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
          Adicionar
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-mail</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && members?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className='text-center text-muted-foreground'
              >
                Nenhum contato nesta lista
              </TableCell>
            </TableRow>
          )}
          {members?.map((member) => (
            <TableRow key={member.id}>
              <TableCell>{member.email}</TableCell>
              <TableCell>{member.name ?? '-'}</TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleRemove(member.id)}
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

function CreateCrmMailingListDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createList = useCreateCrmMailingList(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setDescription('')
    createList.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createList.mutateAsync({
        name,
        description: description || undefined,
      })
      notify.success('Lista criada')
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
            Nova lista
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
                placeholder='Descrição (opcional)'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              disabled={createList.isPending || !name}
            >
              {createList.isPending ? 'Criando...' : 'Criar lista'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
