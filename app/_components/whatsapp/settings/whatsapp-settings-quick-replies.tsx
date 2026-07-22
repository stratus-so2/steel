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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  useCreateWhatsAppQuickReply,
  useDeleteWhatsAppQuickReply,
  useWhatsAppQuickReplies,
} from '@/src/hooks/use-whatsapp-quick-replies'
import { QUICK_REPLY_VARIABLES } from '@/src/lib/whatsapp/template-variables'

function CreateQuickReplyDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [shortcut, setShortcut] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const createQuickReply = useCreateWhatsAppQuickReply(workspaceId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    createQuickReply.mutate(
      { shortcut, title, body },
      {
        onSuccess: () => {
          notify.success('Mensagem rápida criada')
          setShortcut('')
          setTitle('')
          setBody('')
          setOpen(false)
        },
        onError: (error) => notify.error(error, 'Não foi possível criar'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='sm'>Nova mensagem rápida</Button>} />
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Nova mensagem rápida</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='shortcut'>Atalho</Label>
            <Input
              id='shortcut'
              required
              placeholder='saudacao'
              value={shortcut}
              onChange={(event) => setShortcut(event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='title'>Título</Label>
            <Input
              id='title'
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='body'>Mensagem</Label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant='ghost' size='xs' type='button'>
                      Inserir variável
                    </Button>
                  }
                />
                <DropdownMenuContent align='end'>
                  {QUICK_REPLY_VARIABLES.map((variable) => (
                    <DropdownMenuItem
                      key={variable.token}
                      onClick={() =>
                        setBody((current) => `${current}{${variable.token}}`)
                      }
                    >
                      {variable.label} — {`{${variable.token}}`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              id='body'
              required
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={createQuickReply.isPending}>
              {createQuickReply.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WhatsappSettingsQuickReplies({
  workspaceId,
}: {
  workspaceId: string
}) {
  const quickReplies = useWhatsAppQuickReplies(workspaceId)
  const deleteQuickReply = useDeleteWhatsAppQuickReply(workspaceId)

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='font-medium text-sm'>Mensagens rápidas</h3>
          <p className='text-muted-foreground text-xs'>
            Respostas prontas disponíveis no composer da conversa
          </p>
        </div>
        <CreateQuickReplyDialog workspaceId={workspaceId} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atalho</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Mensagem</TableHead>
            <TableHead className='w-24' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(quickReplies.data ?? []).map((quickReply) => (
            <TableRow key={quickReply.id}>
              <TableCell>/{quickReply.shortcut}</TableCell>
              <TableCell>{quickReply.title}</TableCell>
              <TableCell className='max-w-64 truncate'>
                {quickReply.body}
              </TableCell>
              <TableCell>
                <Button
                  size='xs'
                  variant='destructive'
                  disabled={deleteQuickReply.isPending}
                  onClick={() =>
                    deleteQuickReply.mutate(quickReply.id, {
                      onSuccess: () => notify.success('Mensagem removida'),
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
          {quickReplies.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className='text-muted-foreground text-sm'>
                Nenhuma mensagem rápida cadastrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
