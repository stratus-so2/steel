'use client'

import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  useCreateWhatsAppContact,
  useDeleteWhatsAppContact,
  useWhatsAppContacts,
} from '@/src/hooks/use-whatsapp-contacts'

function CreateContactDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [waId, setWaId] = useState('')
  const [name, setName] = useState('')
  const createContact = useCreateWhatsAppContact(workspaceId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    createContact.mutate(
      { waId, name: name || undefined },
      {
        onSuccess: () => {
          notify.success('Contato cadastrado')
          setWaId('')
          setName('')
          setOpen(false)
        },
        onError: (error) => notify.error(error, 'Não foi possível cadastrar'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='sm'>Cadastrar contato</Button>} />
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='waId'>Número (DDI + DDD + número)</Label>
            <Input
              id='waId'
              required
              placeholder='5511999999999'
              value={waId}
              onChange={(event) => setWaId(event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='name'>Nome (opcional)</Label>
            <Input
              id='name'
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={createContact.isPending}>
              {createContact.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WhatsappSettingsContacts({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [search, setSearch] = useState('')
  const contacts = useWhatsAppContacts(workspaceId, search)
  const deleteContact = useDeleteWhatsAppContact(workspaceId)

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <Input
          placeholder='Buscar contato'
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className='max-w-xs'
        />
        <CreateContactDialog workspaceId={workspaceId} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Número</TableHead>
            <TableHead className='w-24' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(contacts.data ?? []).map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>{contact.name ?? '—'}</TableCell>
              <TableCell>{contact.waId}</TableCell>
              <TableCell>
                <Button
                  size='xs'
                  variant='destructive'
                  disabled={deleteContact.isPending}
                  onClick={() =>
                    deleteContact.mutate(contact.id, {
                      onSuccess: () => notify.success('Contato removido'),
                      onError: (error) =>
                        notify.error(error, 'Não foi possível remover'),
                    })
                  }
                >
                  Remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {contacts.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className='text-muted-foreground text-sm'>
                Nenhum contato cadastrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
