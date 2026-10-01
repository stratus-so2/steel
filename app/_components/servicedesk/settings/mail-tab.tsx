'use client'

import {
  MailOpen01Icon,
  PlugSocketIcon,
  RefreshIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type FormEvent, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useCreateSdMailbox,
  useDeleteSdMailbox,
  useSdMailboxes,
  useSyncSdMailbox,
  useTestSdMailbox,
  useUpdateSdMailbox,
} from '@/src/hooks/use-sd-mailboxes'
import type { CreateSdMailboxDTO } from '@/src/schemas/sd-mailbox.schema'
import type { SdTicketTypeDTO } from '@/types/sd-config'
import type { SdMailboxDTO, SdMailboxStatusDTO } from '@/types/sd-mailbox'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  ReadOnlyNotice,
  SD_TICKET_TYPE_OPTIONS,
  SettingsSection,
  SimpleSelect,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "E-mail" das configurações do ServiceDesk: as caixas monitoradas por
 * IMAP, o teste das credenciais, a leitura sob demanda, os padrões do
 * chamado aberto por e-mail, as listas de remetentes e a confirmação
 * automática de abertura.
 */

const EMPTY_FORM = {
  name: '',
  address: '',
  imapHost: '',
  imapPort: '993',
  imapUser: '',
  imapPassword: '',
  folder: 'INBOX',
  processedFolder: '',
  smtpHost: '',
  smtpPort: '465',
  smtpUser: '',
  smtpPassword: '',
}

const STATUS: Record<SdMailboxStatusDTO, { label: string; className: string }> =
  {
    ACTIVE: {
      label: 'Lendo',
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
    PAUSED: {
      label: 'Pausada',
      className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
    },
    ERROR: {
      label: 'Com erro',
      className: 'bg-red-500/10 text-red-700 dark:text-red-300',
    },
  }

export function formatSdMailboxSync(value: string | null): string {
  if (!value) return 'nunca'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Textarea (uma entrada por linha) → lista de remetentes. */
export function parseSdSenderList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,;]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}

function toPayload(form: typeof EMPTY_FORM): CreateSdMailboxDTO {
  return {
    name: form.name,
    address: form.address.trim().toLowerCase(),
    imapHost: form.imapHost,
    imapPort: Number(form.imapPort) || 993,
    imapSecure: true,
    imapUser: form.imapUser || form.address,
    imapPassword: form.imapPassword,
    folder: form.folder || 'INBOX',
    processedFolder: form.processedFolder.trim() || null,
    smtpHost: form.smtpHost.trim() || null,
    smtpPort: form.smtpHost.trim() ? Number(form.smtpPort) || 465 : null,
    smtpSecure: true,
    smtpUser: form.smtpHost.trim()
      ? form.smtpUser || form.imapUser || form.address
      : null,
    smtpPassword: form.smtpHost.trim() ? form.smtpPassword || null : null,
    defaultType: 'INCIDENT',
    defaultDepartmentId: null,
    defaultCategoryId: null,
    defaultPriorityId: null,
    allowedSenders: [],
    blockedSenders: [],
    createUnknownContacts: true,
    sendAcknowledgement: true,
  }
}

function CreateMailboxDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const create = useCreateSdMailbox(workspaceId)

  function set<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate(toPayload(form), {
      onSuccess: () => {
        notify.success('Caixa cadastrada')
        setForm(EMPTY_FORM)
        setOpen(false)
      },
      onError: (error) => notify.error(error),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size='sm'>Adicionar caixa</Button>} />
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Nova caixa de e-mail</DialogTitle>
          <DialogDescription>
            O ServiceDesk lê esta caixa por IMAP a cada minuto e abre um chamado
            para cada mensagem nova. Os padrões e as listas de remetentes você
            ajusta depois, no cartão da caixa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sd-mail-name'>Nome</Label>
            <Input
              id='sd-mail-name'
              required
              placeholder='Ex.: Suporte, Central de serviços...'
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sd-mail-address'>Endereço</Label>
            <Input
              id='sd-mail-address'
              required
              type='email'
              placeholder='suporte@suaempresa.com.br'
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
            />
          </div>

          <div className='grid grid-cols-[1fr_7rem] gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-imap-host'>Servidor IMAP</Label>
              <Input
                id='sd-mail-imap-host'
                required
                placeholder='imap.suaempresa.com.br'
                value={form.imapHost}
                onChange={(event) => set('imapHost', event.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-imap-port'>Porta</Label>
              <Input
                id='sd-mail-imap-port'
                required
                inputMode='numeric'
                value={form.imapPort}
                onChange={(event) => set('imapPort', event.target.value)}
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-imap-user'>Usuário</Label>
              <Input
                id='sd-mail-imap-user'
                placeholder='o endereço acima'
                value={form.imapUser}
                onChange={(event) => set('imapUser', event.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-imap-password'>Senha</Label>
              <Input
                id='sd-mail-imap-password'
                required
                type='password'
                value={form.imapPassword}
                onChange={(event) => set('imapPassword', event.target.value)}
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-folder'>Pasta monitorada</Label>
              <Input
                id='sd-mail-folder'
                value={form.folder}
                onChange={(event) => set('folder', event.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-processed'>
                Pasta de processados (opcional)
              </Label>
              <Input
                id='sd-mail-processed'
                placeholder='Processados'
                value={form.processedFolder}
                onChange={(event) => set('processedFolder', event.target.value)}
              />
            </div>
          </div>

          <p className='text-muted-foreground text-xs'>
            O SMTP é opcional: sem ele, a resposta do agente sai pela camada de
            e-mail do Steel com o endereço da caixa no "responder para".
          </p>

          <div className='grid grid-cols-[1fr_7rem] gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-smtp-host'>Servidor SMTP</Label>
              <Input
                id='sd-mail-smtp-host'
                placeholder='smtp.suaempresa.com.br'
                value={form.smtpHost}
                onChange={(event) => set('smtpHost', event.target.value)}
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-mail-smtp-port'>Porta</Label>
              <Input
                id='sd-mail-smtp-port'
                inputMode='numeric'
                value={form.smtpPort}
                onChange={(event) => set('smtpPort', event.target.value)}
              />
            </div>
          </div>

          {form.smtpHost.trim() ? (
            <div className='grid grid-cols-2 gap-3'>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='sd-mail-smtp-user'>Usuário SMTP</Label>
                <Input
                  id='sd-mail-smtp-user'
                  value={form.smtpUser}
                  onChange={(event) => set('smtpUser', event.target.value)}
                />
              </div>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='sd-mail-smtp-password'>Senha SMTP</Label>
                <Input
                  id='sd-mail-smtp-password'
                  type='password'
                  value={form.smtpPassword}
                  onChange={(event) => set('smtpPassword', event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type='submit' disabled={create.isPending}>
              {create.isPending ? 'Cadastrando...' : 'Cadastrar caixa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SenderLists({
  mailbox,
  workspaceId,
  canEdit,
}: {
  mailbox: SdMailboxDTO
  workspaceId: string
  canEdit: boolean
}) {
  const update = useUpdateSdMailbox(workspaceId)
  const [allowed, setAllowed] = useState(mailbox.allowedSenders.join('\n'))
  const [blocked, setBlocked] = useState(mailbox.blockedSenders.join('\n'))

  function save() {
    update.mutate(
      {
        id: mailbox.id,
        data: {
          allowedSenders: parseSdSenderList(allowed),
          blockedSenders: parseSdSenderList(blocked),
        },
      },
      {
        onSuccess: () => notify.success('Listas salvas'),
        onError: (error) => notify.error(error),
      },
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <FieldBlock
          label='Remetentes aceitos'
          hint='Um por linha; vazio aceita qualquer um. Use @dominio.com para o domínio inteiro.'
        >
          <Textarea
            rows={3}
            disabled={!canEdit}
            aria-label={`Remetentes aceitos de ${mailbox.name}`}
            value={allowed}
            onChange={(event) => setAllowed(event.target.value)}
          />
        </FieldBlock>
        <FieldBlock
          label='Remetentes bloqueados'
          hint='Tem precedência sobre a lista de aceitos.'
        >
          <Textarea
            rows={3}
            disabled={!canEdit}
            aria-label={`Remetentes bloqueados de ${mailbox.name}`}
            value={blocked}
            onChange={(event) => setBlocked(event.target.value)}
          />
        </FieldBlock>
      </div>
      {canEdit ? (
        <div className='flex justify-end'>
          <Button
            size='xs'
            variant='outline'
            disabled={update.isPending}
            onClick={save}
          >
            Salvar listas
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function MailboxCard({
  workspaceId,
  mailbox,
  canEdit,
}: {
  workspaceId: string
  mailbox: SdMailboxDTO
  canEdit: boolean
}) {
  const { config } = useSdSettingsContext()
  const test = useTestSdMailbox(workspaceId)
  const sync = useSyncSdMailbox(workspaceId)
  const remove = useDeleteSdMailbox(workspaceId)
  const update = useUpdateSdMailbox(workspaceId)
  const status = STATUS[mailbox.status]

  const departments = (config?.departments ?? []).flatMap((d) => [
    { value: d.id, label: d.name },
    ...d.children.map((c) => ({ value: c.id, label: `${d.name} › ${c.name}` })),
  ])
  const categories = (config?.categories ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))
  const priorities = (config?.priorities ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }))

  function patch(data: Parameters<typeof update.mutate>[0]['data']) {
    update.mutate(
      { id: mailbox.id, data },
      {
        onSuccess: () => notify.success('Caixa atualizada'),
        onError: (error) => notify.error(error),
      },
    )
  }

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
        mailbox.status === 'ACTIVE' && 'border-primary/50',
      )}
      data-testid='sd-mailbox'
    >
      <header className='flex flex-wrap items-center gap-2'>
        <SteelIcon
          icon={MailOpen01Icon}
          strokeWidth={2}
          className='text-sky-600 dark:text-sky-400'
        />
        <span className='font-medium text-sm'>{mailbox.name}</span>
        <Badge variant='outline'>{mailbox.address}</Badge>
        <Badge variant='outline' className={status.className}>
          {status.label}
        </Badge>
        {mailbox.smtpConfigured ? (
          <Badge variant='outline'>SMTP próprio</Badge>
        ) : null}
      </header>

      <p className='text-muted-foreground text-xs'>
        {mailbox.imapHost}:{mailbox.imapPort} · pasta {mailbox.folder} · última
        leitura {formatSdMailboxSync(mailbox.lastSyncAt)}
      </p>

      {mailbox.statusError ? (
        <p className='rounded-lg bg-red-500/10 px-3 py-2 text-red-700 text-xs dark:text-red-300'>
          {mailbox.statusError}
        </p>
      ) : null}

      <div className='grid gap-3 sm:grid-cols-3'>
        <FieldBlock label='Tipo do chamado'>
          <SimpleSelect
            value={mailbox.defaultType}
            disabled={!canEdit}
            options={SD_TICKET_TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            onChange={(value) =>
              value && patch({ defaultType: value as SdTicketTypeDTO })
            }
          />
        </FieldBlock>
        <FieldBlock label='Departamento'>
          <SimpleSelect
            value={mailbox.defaultDepartmentId}
            disabled={!canEdit}
            allowEmpty
            emptyLabel='Pelo roteamento'
            options={departments}
            onChange={(value) => patch({ defaultDepartmentId: value })}
          />
        </FieldBlock>
        <FieldBlock label='Categoria'>
          <SimpleSelect
            value={mailbox.defaultCategoryId}
            disabled={!canEdit}
            allowEmpty
            options={categories}
            onChange={(value) => patch({ defaultCategoryId: value })}
          />
        </FieldBlock>
        <FieldBlock label='Prioridade'>
          <SimpleSelect
            value={mailbox.defaultPriorityId}
            disabled={!canEdit}
            allowEmpty
            emptyLabel='Pela matriz'
            options={priorities}
            onChange={(value) => patch({ defaultPriorityId: value })}
          />
        </FieldBlock>
      </div>

      <SenderLists
        mailbox={mailbox}
        workspaceId={workspaceId}
        canEdit={canEdit}
      />

      <ToggleRow
        label='Criar contato para remetente desconhecido'
        description='Sem isto, o chamado abre sem contato vinculado.'
        checked={mailbox.createUnknownContacts}
        disabled={!canEdit || update.isPending}
        onCheckedChange={(value) => patch({ createUnknownContacts: value })}
      />
      <ToggleRow
        label='Confirmar a abertura por e-mail'
        description='Responde com o código do chamado assim que ele é aberto.'
        checked={mailbox.sendAcknowledgement}
        disabled={!canEdit || update.isPending}
        onCheckedChange={(value) => patch({ sendAcknowledgement: value })}
      />

      {canEdit ? (
        <footer className='flex flex-wrap items-center gap-2'>
          <Button
            size='xs'
            variant='outline'
            disabled={test.isPending}
            onClick={() =>
              test.mutate(mailbox.id, {
                onSuccess: (result) =>
                  result.connected
                    ? notify.success(
                        result.messages === null
                          ? 'Caixa acessível'
                          : `Caixa acessível (${result.messages} mensagens na pasta)`,
                      )
                    : notify.warning(
                        result.error ?? 'Não foi possível conectar',
                      ),
                onError: (error) => notify.error(error),
              })
            }
          >
            <SteelIcon icon={PlugSocketIcon} size={14} strokeWidth={2} />
            {test.isPending ? 'Testando...' : 'Testar conexão'}
          </Button>
          <Button
            size='xs'
            variant='outline'
            disabled={sync.isPending}
            onClick={() =>
              sync.mutate(mailbox.id, {
                onSuccess: (result) =>
                  notify.success(
                    `${result.fetched} mensagem(ns) lida(s) · ${result.opened} chamado(s) aberto(s) · ${result.appended} resposta(s)`,
                  ),
                onError: (error) => notify.error(error),
              })
            }
          >
            <SteelIcon icon={RefreshIcon} size={14} strokeWidth={2} />
            {sync.isPending ? 'Lendo...' : 'Ler agora'}
          </Button>
          <Button
            size='xs'
            variant='outline'
            disabled={update.isPending}
            onClick={() =>
              patch({
                status: mailbox.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
              })
            }
          >
            {mailbox.status === 'PAUSED' ? 'Retomar leitura' : 'Pausar leitura'}
          </Button>
          <ConfirmDeleteButton
            iconOnly={false}
            label='Remover'
            title='Remover a caixa?'
            description={`"${mailbox.name}" deixa de abrir e responder chamados. Os chamados já abertos continuam no histórico.`}
            pending={remove.isPending}
            onConfirm={() =>
              remove.mutate(mailbox.id, {
                onSuccess: () => notify.success('Caixa removida'),
                onError: (error) => notify.error(error),
              })
            }
          />
        </footer>
      ) : null}
    </article>
  )
}

export function SdMailSettingsTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const mailboxes = useSdMailboxes(workspaceId)
  const items = mailboxes.data ?? []

  return (
    <div className='flex flex-col gap-5'>
      {canEdit ? null : <ReadOnlyNotice />}

      <SettingsSection
        title='Caixas de e-mail'
        description='Endereços monitorados por IMAP. Cada mensagem nova abre um chamado; a resposta do contato entra no histórico do chamado dele.'
        actions={
          canEdit ? <CreateMailboxDialog workspaceId={workspaceId} /> : null
        }
      >
        {mailboxes.isLoading ? (
          <Skeleton className='h-40 w-full' />
        ) : mailboxes.error ? (
          <EmptyState>{mailboxes.error.message}</EmptyState>
        ) : items.length === 0 ? (
          <EmptyState>
            Nenhuma caixa cadastrada. Adicione o e-mail do suporte para abrir
            chamados automaticamente a partir das mensagens recebidas.
          </EmptyState>
        ) : (
          <div className='flex flex-col gap-3'>
            {items.map((mailbox) => (
              <MailboxCard
                key={mailbox.id}
                workspaceId={workspaceId}
                mailbox={mailbox}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title='Como funciona'
        description='O caminho de um e-mail que chega na caixa do ServiceDesk.'
      >
        <ol className='flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground text-sm'>
          <li>
            A cada minuto o Steel lê as mensagens novas da pasta monitorada.
          </li>
          <li>
            Respostas automáticas (férias, devolução, listas) ficam registradas
            mas não abrem nem reabrem chamado.
          </li>
          <li>
            Se a mensagem responde uma conversa já existente — ou traz o código
            do chamado no assunto — ela entra no histórico daquele chamado.
          </li>
          <li>
            Senão, abre um chamado com os padrões acima, resolvendo o contato
            pelo e-mail do remetente.
          </li>
          <li>
            A resposta pública do agente no histórico volta por e-mail para o
            contato, já encadeada e com o código no assunto.
          </li>
        </ol>
      </SettingsSection>
    </div>
  )
}
