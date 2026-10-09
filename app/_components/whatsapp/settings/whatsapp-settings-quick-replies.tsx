'use client'

import {
  Attachment01Icon,
  Cancel01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { useCan } from '@/app/_components/workspace/workspace-permissions'
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
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
import { useUploadWhatsAppMedia } from '@/src/hooks/use-whatsapp-media-upload'
import {
  useCreateWhatsAppQuickReply,
  useDeleteWhatsAppQuickReply,
  useWhatsAppQuickReplies,
} from '@/src/hooks/use-whatsapp-quick-replies'
import { fileNameFromUrl } from '@/src/lib/whatsapp/quick-reply-match'
import { QUICK_REPLY_VARIABLES } from '@/src/lib/whatsapp/template-variables'
import type { WhatsAppQuickReplyDTO } from '@/types/whatsapp-quick-reply'

function CreateQuickReplyDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [shortcut, setShortcut] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<{ name: string; url: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createQuickReply = useCreateWhatsAppQuickReply(workspaceId)
  const uploadMedia = useUploadWhatsAppMedia(workspaceId)

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    uploadMedia.mutate(file, {
      onSuccess: (uploaded) => setMedia({ name: file.name, url: uploaded.url }),
      onError: (error) => notify.error(error, 'Erro ao enviar arquivo'),
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    createQuickReply.mutate(
      {
        // Typed as in the composer (`/saudacao`) or bare: stored bare.
        shortcut: shortcut.trim().replace(/^\/+/, ''),
        title,
        body,
        ...(media ? { mediaUrl: media.url } : {}),
      },
      {
        onSuccess: () => {
          notify.success('Mensagem rápida criada')
          setShortcut('')
          setTitle('')
          setBody('')
          setMedia(null)
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
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>/</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id='shortcut'
                required
                placeholder='saudacao'
                value={shortcut}
                onChange={(event) => setShortcut(event.target.value)}
              />
            </InputGroup>
            <p className='text-muted-foreground text-xs'>
              Na conversa, digite /
              {shortcut.trim().replace(/^\/+/, '') || 'saudacao'} e tecle Enter
              para usar.
            </p>
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
          <div className='space-y-1.5'>
            <Label htmlFor='quick-reply-media'>Anexo (opcional)</Label>
            <input
              ref={fileInputRef}
              id='quick-reply-media'
              type='file'
              className='hidden'
              onChange={handleFile}
            />
            {media ? (
              <div className='flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm'>
                <SteelIcon icon={Attachment01Icon} size={16} />
                <span className='min-w-0 flex-1 truncate'>{media.name}</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  aria-label='Remover anexo'
                  onClick={() => setMedia(null)}
                >
                  <SteelIcon icon={Cancel01Icon} size={14} />
                </Button>
              </div>
            ) : (
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={uploadMedia.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <SteelIcon icon={Attachment01Icon} size={16} />
                {uploadMedia.isPending ? 'Enviando…' : 'Anexar arquivo'}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button
              type='submit'
              disabled={createQuickReply.isPending || uploadMedia.isPending}
            >
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
  const [deletingQuickReply, setDeletingQuickReply] =
    useState<WhatsAppQuickReplyDTO | null>(null)
  const quickReplies = useWhatsAppQuickReplies(workspaceId)
  const deleteQuickReply = useDeleteWhatsAppQuickReply(workspaceId)
  const canDelete = useCan('quick-replies', 'DELETE')

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

      <div className='max-h-[26rem] overflow-auto rounded-lg border border-border'>
        <Table containerClassName='overflow-x-visible'>
          <TableHeader className='sticky top-0 z-10 bg-card/85 backdrop-blur-md'>
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
                <TableCell>
                  /{quickReply.shortcut.replace(/^\/+/, '')}
                </TableCell>
                <TableCell>{quickReply.title}</TableCell>
                <TableCell className='max-w-64 truncate'>
                  {quickReply.mediaUrl ? (
                    <span className='mr-1.5 inline-flex items-center gap-1 align-middle text-muted-foreground text-xs'>
                      <SteelIcon icon={Attachment01Icon} size={14} />
                      {fileNameFromUrl(quickReply.mediaUrl)} ·
                    </span>
                  ) : null}
                  {quickReply.body}
                </TableCell>
                <TableCell>
                  {canDelete ? (
                    <Button
                      size='xs'
                      variant='destructive'
                      onClick={() => setDeletingQuickReply(quickReply)}
                    >
                      Remover
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {quickReplies.data?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground text-sm'
                >
                  Nenhuma mensagem rápida cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deletingQuickReply !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingQuickReply(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover mensagem rápida</AlertDialogTitle>
            <AlertDialogDescription>
              "/{deletingQuickReply?.shortcut.replace(/^\/+/, '')}" não vai mais
              aparecer no composer da conversa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteQuickReply.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={deleteQuickReply.isPending}
              onClick={() => {
                if (!deletingQuickReply) return
                deleteQuickReply.mutate(deletingQuickReply.id, {
                  onSuccess: () => {
                    notify.success('Mensagem removida')
                    setDeletingQuickReply(null)
                  },
                  onError: (error) =>
                    notify.error(error, 'Não foi possível remover'),
                })
              }}
            >
              {deleteQuickReply.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
