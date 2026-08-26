'use client'

import { RefreshIcon } from '@hugeicons-pro/core-stroke-rounded'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { type FormEvent, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useCreateWhatsAppContact,
  useDeleteWhatsAppContact,
  useSyncWhatsAppContactAvatar,
  useUpdateWhatsAppContact,
  useWhatsAppContacts,
} from '@/src/hooks/use-whatsapp-contacts'
import type { WhatsAppContactDTO } from '@/types/whatsapp-contact'

interface ContactFormState {
  waId: string
  name: string
  avatarUrl: string
  description: string
}

const EMPTY_FORM: ContactFormState = {
  waId: '',
  name: '',
  avatarUrl: '',
  description: '',
}

function ContactFormFields({
  form,
  onChange,
  lockWaId,
}: {
  form: ContactFormState
  onChange: (form: ContactFormState) => void
  lockWaId?: boolean
}) {
  return (
    <div className='space-y-3'>
      <div className='space-y-1.5'>
        <Label htmlFor='contactWaId'>Número (DDI + DDD + número)</Label>
        <Input
          id='contactWaId'
          required
          disabled={lockWaId}
          placeholder='5511999999999'
          value={form.waId}
          onChange={(event) => onChange({ ...form, waId: event.target.value })}
        />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='contactName'>Nome</Label>
        <Input
          id='contactName'
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='contactAvatarUrl'>Foto (URL)</Label>
        <Input
          id='contactAvatarUrl'
          placeholder='https://...'
          value={form.avatarUrl}
          onChange={(event) =>
            onChange({ ...form, avatarUrl: event.target.value })
          }
        />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='contactDescription'>Descrição / recado</Label>
        <Textarea
          id='contactDescription'
          rows={3}
          placeholder='Notas sobre este contato...'
          value={form.description}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
        />
      </div>
    </div>
  )
}

function CreateContactDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM)
  const createContact = useCreateWhatsAppContact(workspaceId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    createContact.mutate(
      {
        waId: form.waId,
        name: form.name || undefined,
        avatarUrl: form.avatarUrl || undefined,
        description: form.description || undefined,
      },
      {
        onSuccess: () => {
          notify.success('Contato cadastrado')
          setForm(EMPTY_FORM)
          setOpen(false)
        },
        onError: (error) => notify.error(error, 'Não foi possível cadastrar'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='sm'>Novo contato</Button>} />
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <ContactFormFields form={form} onChange={setForm} />
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

function EditContactDialog({
  workspaceId,
  contact,
  open,
  onOpenChange,
}: {
  workspaceId: string
  contact: WhatsAppContactDTO
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = useState<ContactFormState>({
    waId: contact.waId,
    name: contact.name ?? '',
    avatarUrl: contact.avatarUrl ?? '',
    description: contact.description ?? '',
  })
  const updateContact = useUpdateWhatsAppContact(workspaceId, contact.id)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    updateContact.mutate(
      {
        name: form.name || undefined,
        avatarUrl: form.avatarUrl || undefined,
        description: form.description || undefined,
      },
      {
        onSuccess: () => {
          notify.success('Contato atualizado')
          onOpenChange(false)
        },
        onError: (error) => notify.error(error, 'Não foi possível atualizar'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <ContactFormFields form={form} onChange={setForm} lockWaId />
          <DialogFooter>
            <Button type='submit' disabled={updateContact.isPending}>
              {updateContact.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WhatsappContactsPage({ workspaceId }: { workspaceId: string }) {
  const [search, setSearch] = useState('')
  const [editingContact, setEditingContact] =
    useState<WhatsAppContactDTO | null>(null)
  const [deletingContact, setDeletingContact] =
    useState<WhatsAppContactDTO | null>(null)
  const contacts = useWhatsAppContacts(workspaceId, search)
  const deleteContact = useDeleteWhatsAppContact(workspaceId)
  const syncAvatar = useSyncWhatsAppContactAvatar(workspaceId)

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

      <div className='max-h-[calc(100vh-16rem)] overflow-auto rounded-lg border border-border'>
        <Table>
          <TableHeader className='sticky top-0 z-10 bg-card/85 backdrop-blur-md'>
            <TableRow>
              <TableHead className='w-10' />
              <TableHead>Nome</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Conversas</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className='w-32' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(contacts.data ?? []).map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className='group relative w-fit'>
                    <Avatar className='size-8'>
                      <AvatarImage src={contact.avatarUrl ?? undefined} />
                      <AvatarFallback className='text-xs'>
                        {(contact.name ?? contact.waId)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type='button'
                      aria-label='Buscar foto de perfil'
                      disabled={syncAvatar.isPending}
                      className='absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100'
                      onClick={() =>
                        syncAvatar.mutate(contact.id, {
                          onSuccess: () => notify.success('Foto atualizada'),
                          onError: (error) =>
                            notify.error(
                              error,
                              'Não foi possível buscar a foto (exige conexão Z-API)',
                            ),
                        })
                      }
                    >
                      <SteelIcon
                        icon={RefreshIcon}
                        size={14}
                        className='text-white'
                      />
                    </button>
                  </div>
                </TableCell>
                <TableCell>{contact.name ?? '—'}</TableCell>
                <TableCell>{contact.waId}</TableCell>
                <TableCell
                  className='max-w-56 truncate text-muted-foreground'
                  title={contact.description ?? undefined}
                >
                  {contact.description ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant='secondary'>{contact.conversationCount}</Badge>
                </TableCell>
                <TableCell className='text-muted-foreground text-xs'>
                  {format(new Date(contact.createdAt), 'dd/MM/yyyy', {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-1.5'>
                    <Button
                      size='xs'
                      variant='outline'
                      onClick={() => setEditingContact(contact)}
                    >
                      Editar
                    </Button>
                    <Button
                      size='xs'
                      variant='destructive'
                      onClick={() => setDeletingContact(contact)}
                    >
                      Remover
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {contacts.data?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='text-muted-foreground text-sm'
                >
                  Nenhum contato cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editingContact && (
        <EditContactDialog
          workspaceId={workspaceId}
          contact={editingContact}
          open={Boolean(editingContact)}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null)
          }}
        />
      )}

      <AlertDialog
        open={deletingContact !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingContact(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingContact?.name ?? deletingContact?.waId} será removido da
              lista de contatos. Conversas já existentes não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteContact.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={deleteContact.isPending}
              onClick={() => {
                if (!deletingContact) return
                deleteContact.mutate(deletingContact.id, {
                  onSuccess: () => {
                    notify.success('Contato removido')
                    setDeletingContact(null)
                  },
                  onError: (error) =>
                    notify.error(error, 'Não foi possível remover'),
                })
              }}
            >
              {deleteContact.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
