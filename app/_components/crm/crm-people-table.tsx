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
  useCreateCrmPerson,
  useCrmPeople,
  useDeleteCrmPerson,
} from '@/src/hooks/use-crm-person'

export function CrmPeopleTable({ workspaceId }: { workspaceId: string }) {
  const { data: people, isLoading } = useCrmPeople(workspaceId)
  const deletePerson = useDeleteCrmPerson(workspaceId)

  async function handleDelete(personId: string) {
    try {
      await deletePerson.mutateAsync(personId)
      notify.success('Pessoa removida')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex justify-end'>
        <CreateCrmPersonDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && people?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhuma pessoa cadastrada
              </TableCell>
            </TableRow>
          )}
          {people?.map((person) => (
            <TableRow key={person.id}>
              <TableCell>{person.name}</TableCell>
              <TableCell>{person.emails[0] ?? '—'}</TableCell>
              <TableCell>{person.jobTitle ?? '—'}</TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(person.id)}
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

function CreateCrmPersonDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const createPerson = useCreateCrmPerson(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    createPerson.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createPerson.mutateAsync({ name })
      notify.success('Pessoa criada')
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
            Adicionar pessoa
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome da pessoa'
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              disabled={createPerson.isPending || !name}
            >
              {createPerson.isPending ? 'Criando...' : 'Criar pessoa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
