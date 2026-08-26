'use client'

import { type FormEvent, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  useCreateWhatsAppBroadcast,
  useImportWhatsAppBroadcast,
  useStartWhatsAppBroadcast,
  useWhatsAppBroadcasts,
} from '@/src/hooks/use-whatsapp-broadcasts'
import { useWhatsAppConnections } from '@/src/hooks/use-whatsapp-connections'
import { useWhatsAppContacts } from '@/src/hooks/use-whatsapp-contacts'
import { useWhatsAppTemplates } from '@/src/hooks/use-whatsapp-templates'
import type { WhatsAppBroadcastImportResultDTO } from '@/types/whatsapp-broadcast-import'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  QUEUED: 'Na fila',
  RUNNING: 'Enviando',
  DONE: 'Concluída',
  FAILED: 'Falhou',
}

function CreateBroadcastDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [connectionId, setConnectionId] = useState<string>()
  const [messageBody, setMessageBody] = useState('')
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
    new Set(),
  )

  const connections = useWhatsAppConnections(workspaceId)
  const contacts = useWhatsAppContacts(workspaceId)
  const createBroadcast = useCreateWhatsAppBroadcast(workspaceId)

  function toggleContact(contactId: string) {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!connectionId || selectedContactIds.size === 0) {
      notify.error('Selecione a conexão e ao menos um contato')
      return
    }

    createBroadcast.mutate(
      {
        name,
        connectionId,
        messageBody,
        contactIds: Array.from(selectedContactIds),
      },
      {
        onSuccess: () => {
          notify.success('Lista de transmissão criada')
          setName('')
          setMessageBody('')
          setSelectedContactIds(new Set())
          setOpen(false)
        },
        onError: (error) => notify.error(error, 'Não foi possível criar'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='sm'>Nova lista</Button>} />
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Nova lista de transmissão</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='broadcastName'>Nome</Label>
            <Input
              id='broadcastName'
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='broadcastConnection'>Conexão</Label>
            <Select
              value={connectionId}
              onValueChange={(value) => setConnectionId(value ?? undefined)}
            >
              <SelectTrigger id='broadcastConnection' className='w-full'>
                <SelectValue placeholder='Selecione a conexão' />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {(connections.data ?? []).map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='broadcastMessage'>Mensagem</Label>
            <Textarea
              id='broadcastMessage'
              required
              rows={4}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Contatos ({selectedContactIds.size} selecionados)</Label>
            <div className='max-h-48 space-y-1 overflow-y-auto rounded-md border p-2'>
              {(contacts.data ?? []).map((contact) => (
                <label
                  key={contact.id}
                  htmlFor={`broadcast-contact-${contact.id}`}
                  className='flex items-center gap-2 py-1 text-sm'
                >
                  <Checkbox
                    id={`broadcast-contact-${contact.id}`}
                    checked={selectedContactIds.has(contact.id)}
                    onCheckedChange={() => toggleContact(contact.id)}
                  />
                  {contact.name ?? contact.waId}
                </label>
              ))}
              {contacts.data?.length === 0 && (
                <p className='text-muted-foreground text-xs'>
                  Cadastre contatos antes de criar uma lista
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type='submit' disabled={createBroadcast.isPending}>
              {createBroadcast.isPending ? 'Criando...' : 'Criar lista'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ImportBroadcastDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [connectionId, setConnectionId] = useState<string>()
  const [templateId, setTemplateId] = useState<string>()
  const [sendOffsetHours, setSendOffsetHours] = useState(24)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<WhatsAppBroadcastImportResultDTO | null>(
    null,
  )

  const connections = useWhatsAppConnections(workspaceId)
  const templates = useWhatsAppTemplates(workspaceId)
  const approvedTemplates = (templates.data ?? []).filter(
    (t) => t.status === 'APPROVED',
  )
  const importBroadcast = useImportWhatsAppBroadcast(workspaceId)

  function resetAndClose() {
    setName('')
    setConnectionId(undefined)
    setTemplateId(undefined)
    setSendOffsetHours(24)
    setFile(null)
    setResult(null)
    setOpen(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!connectionId || !templateId || !file) {
      notify.error('Selecione a conexão, o template e o arquivo CSV')
      return
    }

    const csv = await file.text()
    importBroadcast.mutate(
      { name, connectionId, templateId, sendOffsetHours, csv },
      {
        onSuccess: (data) => setResult(data),
        onError: (error) => notify.error(error, 'Não foi possível importar'),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}
    >
      <DialogTrigger
        render={
          <Button size='sm' variant='outline'>
            Importar planilha
          </Button>
        }
      />
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Importar planilha (CSV)</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className='space-y-3'>
            <p className='text-sm'>
              {result.createdCount} destinatário(s) agendado(s) com sucesso.
            </p>
            {result.rejectedRows.length > 0 && (
              <div className='max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-xs'>
                {result.rejectedRows.map((row) => (
                  <p key={row.rowNumber} className='text-destructive'>
                    Linha {row.rowNumber}: {row.reason}
                  </p>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={resetAndClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-3'>
            <p className='text-muted-foreground text-xs'>
              Colunas obrigatórias: <code>telefone</code>,{' '}
              <code>data_referencia</code> e uma coluna <code>var_1</code>,{' '}
              <code>var_2</code>... para cada variável do BODY do template.
              Coluna <code>nome</code> é opcional.
            </p>

            <div className='space-y-1.5'>
              <Label htmlFor='importName'>Nome</Label>
              <Input
                id='importName'
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='importConnection'>Conexão</Label>
              <Select
                value={connectionId}
                onValueChange={(value) => setConnectionId(value ?? undefined)}
              >
                <SelectTrigger id='importConnection' className='w-full'>
                  <SelectValue placeholder='Selecione a conexão' />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {(connections.data ?? []).map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='importTemplate'>Template (aprovado)</Label>
              <Select
                value={templateId}
                onValueChange={(value) => setTemplateId(value ?? undefined)}
              >
                <SelectTrigger id='importTemplate' className='w-full'>
                  <SelectValue placeholder='Selecione o template' />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {approvedTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {approvedTemplates.length === 0 && (
                <p className='text-muted-foreground text-xs'>
                  Nenhum template aprovado neste workspace ainda.
                </p>
              )}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='importOffset'>
                Enviar quantas horas antes da data de referência
              </Label>
              <Input
                id='importOffset'
                type='number'
                min={0}
                required
                value={sendOffsetHours}
                onChange={(event) =>
                  setSendOffsetHours(Number(event.target.value))
                }
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='importFile'>Arquivo CSV</Label>
              <Input
                id='importFile'
                type='file'
                accept='.csv,text/csv'
                required
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <DialogFooter>
              <Button type='submit' disabled={importBroadcast.isPending}>
                {importBroadcast.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function WhatsappSettingsBroadcasts({
  workspaceId,
}: {
  workspaceId: string
}) {
  const broadcasts = useWhatsAppBroadcasts(workspaceId)
  const startBroadcast = useStartWhatsAppBroadcast(workspaceId)

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='font-medium text-sm'>Listas de transmissão</h3>
          <p className='text-muted-foreground text-xs'>
            Envie a mesma mensagem para vários contatos, com espaçamento
            automático entre os envios
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <ImportBroadcastDialog workspaceId={workspaceId} />
          <CreateBroadcastDialog workspaceId={workspaceId} />
        </div>
      </div>

      <div className='max-h-[26rem] overflow-auto rounded-lg border border-border'>
        <Table>
          <TableHeader className='sticky top-0 z-10 bg-card/85 backdrop-blur-md'>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead className='w-28' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(broadcasts.data ?? []).map((broadcast) => (
              <TableRow key={broadcast.id}>
                <TableCell>{broadcast.name}</TableCell>
                <TableCell>
                  <Badge variant='outline'>
                    {STATUS_LABEL[broadcast.status] ?? broadcast.status}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground text-xs'>
                  {broadcast.sentCount}/{broadcast.recipientCount} enviados
                  {broadcast.failedCount > 0
                    ? ` · ${broadcast.failedCount} falhas`
                    : ''}
                </TableCell>
                <TableCell>
                  {broadcast.status === 'DRAFT' && (
                    <Button
                      size='xs'
                      disabled={startBroadcast.isPending}
                      onClick={() =>
                        startBroadcast.mutate(broadcast.id, {
                          onSuccess: () => notify.success('Envio iniciado'),
                          onError: (error) =>
                            notify.error(error, 'Não foi possível iniciar'),
                        })
                      }
                    >
                      Iniciar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {broadcasts.data?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground text-sm'
                >
                  Nenhuma lista de transmissão criada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
