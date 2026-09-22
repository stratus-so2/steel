'use client'

import {
  InformationCircleIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  Search01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useSdConfigList,
  useSdConfigMutations,
  useSdMe,
} from '@/src/hooks/use-sd-config'
import type {
  CreateSdCannedResponseDTO,
  UpdateSdCannedResponseDTO,
} from '@/src/schemas/sd-canned-response.schema'
import type { SdCannedResponseDTO } from '@/types/sd-config'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  SettingsSection,
  SimpleSelect,
  useSdSettingsContext,
} from './sd-settings-kit'

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; response: SdCannedResponseDTO }
  | null

export function SdCannedResponsesTab() {
  const { workspaceId, config } = useSdSettingsContext()
  const me = useSdMe(workspaceId)
  const isAgent = me.data?.isAgent ?? false
  const isAdmin = me.data?.isAdmin ?? false
  const [q, setQ] = useState('')
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const { data, isLoading, error } = useSdConfigList<SdCannedResponseDTO>(
    workspaceId,
    'canned-responses',
    { q: q.trim() || undefined, departmentId: departmentId ?? undefined },
    { enabled: isAgent },
  )
  const mutations = useSdConfigMutations<
    SdCannedResponseDTO,
    CreateSdCannedResponseDTO,
    UpdateSdCannedResponseDTO
  >(workspaceId, 'canned-responses')
  const [dialog, setDialog] = useState<DialogState>(null)

  const departmentOptions = (config?.departments ?? []).flatMap((root) => [
    { value: root.id, label: root.name },
    ...root.children.map((child) => ({
      value: child.id,
      label: `${root.name} › ${child.name}`,
    })),
  ])
  const departmentName = new Map(
    departmentOptions.map((d) => [d.value, d.label]),
  )

  if (me.data && !isAgent) {
    return (
      <SettingsSection title='Respostas prontas'>
        <div className='flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground'>
          <SteelIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className='mt-0.5 shrink-0'
          />
          <p>
            Respostas prontas são usadas pelos agentes (membros de um
            departamento) no atendimento dos chamados.
          </p>
        </div>
      </SettingsSection>
    )
  }

  const responses = data ?? []
  const canManage = (r: SdCannedResponseDTO) =>
    isAdmin || r.createdById === me.data?.userId

  return (
    <SettingsSection
      title='Respostas prontas'
      description='Qualquer agente cria as suas; administradores gerenciam todas. Use o atalho para inserir rápido no histórico ou no WhatsApp.'
      actions={
        <Button size='sm' onClick={() => setDialog({ mode: 'create' })}>
          <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
          Nova resposta
        </Button>
      }
    >
      <div className='flex flex-col gap-2 sm:flex-row'>
        <div className='relative flex-1'>
          <SteelIcon
            icon={Search01Icon}
            strokeWidth={2}
            className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground'
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Buscar por título, atalho ou texto'
            className='pl-9'
          />
        </div>
        <SimpleSelect
          value={departmentId}
          onChange={setDepartmentId}
          options={departmentOptions}
          allowEmpty
          emptyLabel='Todos os departamentos'
          className='sm:w-60'
        />
      </div>

      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : !isLoading && responses.length === 0 ? (
        <EmptyState>
          {q || departmentId
            ? 'Nenhuma resposta encontrada.'
            : 'Nenhuma resposta pronta cadastrada.'}
        </EmptyState>
      ) : (
        <ul className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {responses.map((response) => (
            <li
              key={response.id}
              className='flex flex-col gap-2 rounded-lg border border-border bg-background p-3'
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='flex min-w-0 flex-col gap-1'>
                  <span className='truncate text-sm font-medium'>
                    {response.title}
                  </span>
                  <div className='flex flex-wrap items-center gap-1'>
                    {response.shortcut ? (
                      <Badge variant='secondary' className='font-mono'>
                        /{response.shortcut}
                      </Badge>
                    ) : null}
                    <Badge variant='outline'>
                      {response.departmentId
                        ? (departmentName.get(response.departmentId) ??
                          'Departamento')
                        : 'Geral'}
                    </Badge>
                  </div>
                </div>
                {canManage(response) ? (
                  <div className='flex shrink-0 gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-xs'
                      aria-label={`Editar ${response.title}`}
                      onClick={() => setDialog({ mode: 'edit', response })}
                    >
                      <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                    </Button>
                    <ConfirmDeleteButton
                      title='Excluir resposta pronta'
                      description={`"${response.title}" será removida.`}
                      pending={mutations.remove.isPending}
                      onConfirm={() =>
                        mutations.remove.mutate(response.id, {
                          onError: (err) => notify.error(err),
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
              <p className='line-clamp-3 text-xs whitespace-pre-line text-muted-foreground'>
                {response.body}
              </p>
              {response.createdByName ? (
                <span className='text-[11px] text-muted-foreground'>
                  Por {response.createdByName}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {dialog ? (
        <CannedResponseDialog
          response={dialog.mode === 'edit' ? dialog.response : null}
          departmentOptions={departmentOptions}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            try {
              if (dialog.mode === 'edit') {
                await mutations.update.mutateAsync({
                  id: dialog.response.id,
                  data: values,
                })
                notify.success('Resposta salva')
              } else {
                await mutations.create.mutateAsync(values)
                notify.success('Resposta criada')
              }
              setDialog(null)
            } catch (err) {
              notify.error(err)
            }
          }}
        />
      ) : null}
    </SettingsSection>
  )
}

interface CannedValues {
  title: string
  shortcut: string | null
  body: string
  departmentId: string | null
}

function CannedResponseDialog({
  response,
  departmentOptions,
  saving,
  onClose,
  onSave,
}: {
  response: SdCannedResponseDTO | null
  departmentOptions: { value: string; label: string }[]
  saving: boolean
  onClose: () => void
  onSave: (values: CannedValues) => void
}) {
  const [title, setTitle] = useState(response?.title ?? '')
  const [shortcut, setShortcut] = useState(response?.shortcut ?? '')
  const [body, setBody] = useState(response?.body ?? '')
  const [departmentId, setDepartmentId] = useState<string | null>(
    response?.departmentId ?? null,
  )
  const shortcutValid =
    shortcut === '' || /^[a-zA-Z0-9_-]{1,30}$/.test(shortcut)

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {response ? 'Editar resposta pronta' : 'Nova resposta pronta'}
          </DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]'>
            <FieldBlock label='Título'>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                autoFocus
              />
            </FieldBlock>
            <FieldBlock label='Atalho' hint='Letras, números, - ou _'>
              <div className='relative flex items-center'>
                <span className='pointer-events-none absolute left-3 text-sm text-muted-foreground'>
                  /
                </span>
                <Input
                  value={shortcut}
                  onChange={(e) =>
                    setShortcut(e.target.value.replace(/^\//, ''))
                  }
                  maxLength={30}
                  className='pl-6 font-mono'
                  aria-invalid={!shortcutValid}
                />
              </div>
            </FieldBlock>
          </div>
          <FieldBlock
            label='Departamento'
            hint='Vazio = disponível para todos os agentes.'
          >
            <SimpleSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={departmentOptions}
              allowEmpty
              emptyLabel='Geral (todos)'
            />
          </FieldBlock>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <FieldBlock label='Texto'>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                maxLength={10000}
              />
            </FieldBlock>
            <FieldBlock label='Pré-visualização'>
              <div className='min-h-40 rounded-lg border border-border bg-muted/40 p-3'>
                {body.trim() ? (
                  <div className='max-w-[90%] rounded-lg rounded-tl-none bg-background px-3 py-2 text-sm whitespace-pre-line shadow-xs'>
                    {body}
                  </div>
                ) : (
                  <span className='text-xs text-muted-foreground'>
                    O texto aparece aqui como uma mensagem do chamado.
                  </span>
                )}
              </div>
            </FieldBlock>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!title.trim() || !body.trim() || !shortcutValid || saving}
            onClick={() =>
              onSave({
                title: title.trim(),
                shortcut: shortcut.trim() || null,
                body: body.trim(),
                departmentId,
              })
            }
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
