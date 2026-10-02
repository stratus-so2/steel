'use client'

import {
  Calendar03Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  SnowIcon,
  UserGroupIcon,
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useSdAgents,
  useSdConfigList,
  useSdConfigMutations,
} from '@/src/hooks/use-sd-config'
import type { SdCondition } from '@/src/schemas/sd-rule.schema'
import type { SdCabBoardDTO } from '@/types/sd-cab'
import type {
  SdChangeRecurrenceDTO,
  SdChangeWindowDTO,
} from '@/types/sd-change'
import {
  SD_WEEK_DAY_LABEL,
  sdWindowKindLabel,
} from '../changes/sd-change-labels'
import { SdConditionBuilder, summarizeSdConditions } from './rule-builders'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  NumberInput,
  SettingsSection,
  SimpleSelect,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "Mudanças" das configurações: as janelas do calendário (manutenção e
 * congelamento) e os comitês de mudança (CAB) com membros e quórum.
 */

const WHEN = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

/** ISO → valor de um `<input type="datetime-local">` no fuso do navegador. */
function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function describeRecurrence(recurrence: SdChangeRecurrenceDTO | null): string {
  if (!recurrence) return 'Não repete'
  const every =
    recurrence.interval === 1
      ? { DAILY: 'Todo dia', WEEKLY: 'Toda semana', MONTHLY: 'Todo mês' }[
          recurrence.freq
        ]
      : {
          DAILY: `A cada ${recurrence.interval} dias`,
          WEEKLY: `A cada ${recurrence.interval} semanas`,
          MONTHLY: `A cada ${recurrence.interval} meses`,
        }[recurrence.freq]
  const days =
    recurrence.byDay.length > 0
      ? ` (${recurrence.byDay.map((d) => SD_WEEK_DAY_LABEL[d] ?? d).join(', ')})`
      : ''
  const limit = recurrence.until
    ? ` até ${recurrence.until.split('-').reverse().join('/')}`
    : recurrence.count
      ? ` · ${recurrence.count}×`
      : ''
  return `${every}${days}${limit}`
}

export function SdChangesTab() {
  return (
    <div className='flex flex-col gap-8'>
      <ChangeWindowsSection />
      <CabBoardsSection />
    </div>
  )
}

/* ------------------------------- janelas --------------------------------- */

type WindowDialog =
  | { mode: 'create' }
  | { mode: 'edit'; window: SdChangeWindowDTO }
  | null

function ChangeWindowsSection() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data, isLoading, error } = useSdConfigList<SdChangeWindowDTO>(
    workspaceId,
    'change-windows',
  )
  const mutations = useSdConfigMutations<SdChangeWindowDTO>(
    workspaceId,
    'change-windows',
  )
  const [dialog, setDialog] = useState<WindowDialog>(null)
  const windows = data ?? []

  return (
    <SettingsSection
      title='Janelas de mudança'
      description='Manutenção é quando pode mexer; congelamento é quando não pode. Ao agendar uma mudança dentro de um congelamento o sistema avisa, e só um administrador pode seguir mesmo assim.'
      actions={
        canEdit ? (
          <Button size='sm' onClick={() => setDialog({ mode: 'create' })}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova janela
          </Button>
        ) : null
      }
    >
      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : !isLoading && windows.length === 0 ? (
        <EmptyState>
          Nenhuma janela cadastrada. Sem janelas, o calendário de mudanças
          continua funcionando — só não tem faixas de fundo nem congelamento.
        </EmptyState>
      ) : (
        <div className='flex flex-col gap-2'>
          {windows.map((window) => (
            <div
              key={window.id}
              className='flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3'
            >
              <div className='flex min-w-0 items-start gap-3'>
                <SteelIcon
                  icon={window.kind === 'FREEZE' ? SnowIcon : Calendar03Icon}
                  strokeWidth={2}
                  className={cn(
                    'mt-0.5 size-5 shrink-0',
                    window.kind === 'FREEZE'
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                />
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='truncate font-medium text-sm'>
                      {window.name}
                    </span>
                    <Badge
                      variant={
                        window.kind === 'FREEZE' ? 'destructive' : 'secondary'
                      }
                    >
                      {sdWindowKindLabel(window.kind)}
                    </Badge>
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    {WHEN.format(new Date(window.startsAt))} –{' '}
                    {WHEN.format(new Date(window.endsAt))} ·{' '}
                    {describeRecurrence(window.recurrence)}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    {window.configItemIds.length === 0
                      ? 'Todos os itens de configuração'
                      : `${window.configItemIds.length} item(ns) de configuração`}
                    {' · '}
                    {window.departmentIds.length === 0
                      ? 'todos os departamentos'
                      : `${window.departmentIds.length} departamento(s)`}
                  </p>
                  {window.description ? (
                    <p className='mt-1 text-muted-foreground text-xs'>
                      {window.description}
                    </p>
                  ) : null}
                </div>
              </div>
              {canEdit ? (
                <div className='flex gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    aria-label={`Editar ${window.name}`}
                    onClick={() => setDialog({ mode: 'edit', window })}
                  >
                    <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                  </Button>
                  <ConfirmDeleteButton
                    title='Excluir janela'
                    description={`"${window.name}" sai do calendário e deixa de gerar avisos.`}
                    pending={mutations.remove.isPending}
                    onConfirm={() =>
                      mutations.remove.mutate(window.id, {
                        onError: (err) => notify.error(err),
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {dialog ? (
        <WindowDialogForm
          window={dialog.mode === 'edit' ? dialog.window : null}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            try {
              if (dialog.mode === 'edit') {
                await mutations.update.mutateAsync({
                  id: dialog.window.id,
                  data: values,
                })
                notify.success('Janela salva')
              } else {
                await mutations.create.mutateAsync(values)
                notify.success('Janela criada')
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

interface WindowValues {
  name: string
  kind: 'MAINTENANCE' | 'FREEZE'
  startsAt: string
  endsAt: string
  description: string | null
  recurrence: {
    freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
    interval: number
    byDay: string[]
    count: number | null
  } | null
}

const FREQ_OPTIONS = [
  { value: 'DAILY' as const, label: 'Todo dia' },
  { value: 'WEEKLY' as const, label: 'Toda semana' },
  { value: 'MONTHLY' as const, label: 'Todo mês' },
]

const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function WindowDialogForm({
  window: existing,
  saving,
  onClose,
  onSave,
}: {
  window: SdChangeWindowDTO | null
  saving: boolean
  onClose: () => void
  onSave: (values: WindowValues) => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<'MAINTENANCE' | 'FREEZE'>(
    existing?.kind ?? 'MAINTENANCE',
  )
  const [startsAt, setStartsAt] = useState(
    existing ? toLocalInput(existing.startsAt) : '',
  )
  const [endsAt, setEndsAt] = useState(
    existing ? toLocalInput(existing.endsAt) : '',
  )
  const [description, setDescription] = useState(existing?.description ?? '')
  const [repeats, setRepeats] = useState(Boolean(existing?.recurrence))
  const [freq, setFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>(
    existing?.recurrence?.freq ?? 'WEEKLY',
  )
  const [interval, setInterval] = useState(existing?.recurrence?.interval ?? 1)
  const [byDay, setByDay] = useState<string[]>(
    existing?.recurrence?.byDay ?? [],
  )
  const [count, setCount] = useState<number | null>(
    existing?.recurrence?.count ?? null,
  )

  const startIso = fromLocalInput(startsAt)
  const endIso = fromLocalInput(endsAt)
  const periodValid =
    !!startIso && !!endIso && new Date(endIso) > new Date(startIso)
  const valid = name.trim().length > 0 && periodValid

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Editar janela' : 'Nova janela de mudança'}
          </DialogTitle>
        </DialogHeader>
        <div className='flex max-h-[65vh] flex-col gap-4 overflow-y-auto'>
          <FieldBlock label='Nome'>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder='Janela de manutenção · sábados'
              autoFocus
            />
          </FieldBlock>
          <FieldBlock
            label='Tipo'
            hint='Congelamento vira aviso ao agendar uma mudança no período.'
          >
            <SimpleSelect
              value={kind}
              onChange={(value) => setKind(value ?? 'MAINTENANCE')}
              options={[
                { value: 'MAINTENANCE' as const, label: 'Manutenção' },
                { value: 'FREEZE' as const, label: 'Congelamento' },
              ]}
            />
          </FieldBlock>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Início'>
              <Input
                type='datetime-local'
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock
              label='Fim'
              hint={periodValid ? undefined : 'Precisa ser depois do início.'}
            >
              <Input
                type='datetime-local'
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                aria-invalid={!periodValid}
              />
            </FieldBlock>
          </div>
          <ToggleRow
            label='Repetir'
            description='A janela volta a valer a cada período, mantendo a mesma duração.'
            checked={repeats}
            onCheckedChange={setRepeats}
          />
          {repeats ? (
            <div className='flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4'>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FieldBlock label='Frequência'>
                  <SimpleSelect
                    value={freq}
                    onChange={(value) => {
                      const next = value ?? 'WEEKLY'
                      setFreq(next)
                      if (next !== 'WEEKLY') setByDay([])
                    }}
                    options={FREQ_OPTIONS}
                  />
                </FieldBlock>
                <FieldBlock label='A cada' hint='1 = todo período.'>
                  <NumberInput
                    value={interval}
                    onCommit={(value) => setInterval(value ?? 1)}
                    min={1}
                    max={52}
                  />
                </FieldBlock>
              </div>
              {freq === 'WEEKLY' ? (
                <FieldBlock
                  label='Dias da semana'
                  hint='Vazio = o dia da semana do início.'
                >
                  <div className='flex flex-wrap gap-1.5'>
                    {WEEK_DAYS.map((day) => {
                      const on = byDay.includes(day)
                      return (
                        <Button
                          key={day}
                          type='button'
                          size='sm'
                          variant={on ? 'default' : 'outline'}
                          onClick={() =>
                            setByDay(
                              on
                                ? byDay.filter((d) => d !== day)
                                : [...byDay, day],
                            )
                          }
                        >
                          {SD_WEEK_DAY_LABEL[day]}
                        </Button>
                      )
                    })}
                  </div>
                </FieldBlock>
              ) : null}
              <FieldBlock
                label='Número de ocorrências'
                hint='Vazio = sem fim definido.'
              >
                <NumberInput
                  value={count}
                  onCommit={setCount}
                  min={1}
                  max={365}
                />
              </FieldBlock>
            </div>
          ) : null}
          <FieldBlock label='Descrição'>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </FieldBlock>
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!valid || saving}
            onClick={() =>
              onSave({
                name: name.trim(),
                kind,
                startsAt: startIso as string,
                endsAt: endIso as string,
                description: description.trim() || null,
                recurrence: repeats ? { freq, interval, byDay, count } : null,
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

/* -------------------------------- comitês -------------------------------- */

type BoardDialog =
  | { mode: 'create' }
  | { mode: 'edit'; board: SdCabBoardDTO }
  | null

function CabBoardsSection() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data, isLoading, error } = useSdConfigList<SdCabBoardDTO>(
    workspaceId,
    'cab-boards',
    { includeInactive: true },
  )
  const mutations = useSdConfigMutations<SdCabBoardDTO>(
    workspaceId,
    'cab-boards',
  )
  const [dialog, setDialog] = useState<BoardDialog>(null)
  const boards = data ?? []

  async function toggleActive(board: SdCabBoardDTO, active: boolean) {
    try {
      await mutations.update.mutateAsync({ id: board.id, data: { active } })
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <SettingsSection
      title='Comitês de mudança (CAB)'
      description='Quem aprova a mudança e quantos votos bastam. Vale o primeiro comitê ativo, na ordem da lista, cujas condições casam com o chamado — deixe o comitê sem condições por último, como padrão.'
      actions={
        canEdit ? (
          <Button size='sm' onClick={() => setDialog({ mode: 'create' })}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo comitê
          </Button>
        ) : null
      }
    >
      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : !isLoading && boards.length === 0 ? (
        <EmptyState>
          Nenhum comitê cadastrado. Sem comitê, a mudança continua usando o
          pedido de aprovação avulso da aba "Aprovação".
        </EmptyState>
      ) : (
        <div className='flex flex-col gap-2'>
          {boards.map((board) => (
            <div
              key={board.id}
              className={cn(
                'flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3',
                !board.active && 'opacity-60',
              )}
            >
              <div className='flex min-w-0 items-start gap-3'>
                <SteelIcon
                  icon={UserGroupIcon}
                  strokeWidth={2}
                  className='mt-0.5 size-5 shrink-0 text-muted-foreground'
                />
                <div className='min-w-0'>
                  <div className='truncate font-medium text-sm'>
                    {board.name}
                  </div>
                  <p className='text-muted-foreground text-xs'>
                    {board.members.length} membro(s) · quórum de{' '}
                    {board.effectiveQuorum}
                    {board.quorum === 0 ? ' (todos)' : ''}
                    {board.rejectEnds
                      ? ' · uma reprovação encerra'
                      : ' · segue até o fim'}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Quando: {summarizeSdConditions(board.conditions)}
                  </p>
                  {board.members.length > 0 ? (
                    <div className='mt-1.5 flex flex-wrap gap-1'>
                      {board.members.map((member) => (
                        <Badge
                          key={member.id}
                          variant={member.required ? 'default' : 'outline'}
                        >
                          {member.user?.name ?? member.userId}
                          {member.required ? ' · obrigatório' : ''}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {canEdit ? (
                <div className='flex items-center gap-1'>
                  <Switch
                    checked={board.active}
                    onCheckedChange={(value) => toggleActive(board, value)}
                    aria-label={board.active ? 'Desativar' : 'Ativar'}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    aria-label={`Editar ${board.name}`}
                    onClick={() => setDialog({ mode: 'edit', board })}
                  >
                    <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                  </Button>
                  <ConfirmDeleteButton
                    title='Excluir comitê'
                    description={`"${board.name}" sai da lista. As rodadas já abertas continuam valendo.`}
                    pending={mutations.remove.isPending}
                    onConfirm={() =>
                      mutations.remove.mutate(board.id, {
                        onError: (err) => notify.error(err),
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {dialog ? (
        <BoardDialogForm
          board={dialog.mode === 'edit' ? dialog.board : null}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            try {
              if (dialog.mode === 'edit') {
                await mutations.update.mutateAsync({
                  id: dialog.board.id,
                  data: values,
                })
                notify.success('Comitê salvo')
              } else {
                await mutations.create.mutateAsync(values)
                notify.success('Comitê criado')
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

interface BoardValues {
  name: string
  description: string | null
  quorum: number
  rejectEnds: boolean
  conditions: SdCondition[]
  members: { userId: string; required: boolean }[]
}

function BoardDialogForm({
  board,
  saving,
  onClose,
  onSave,
}: {
  board: SdCabBoardDTO | null
  saving: boolean
  onClose: () => void
  onSave: (values: BoardValues) => void
}) {
  const { workspaceId } = useSdSettingsContext()
  const { data: agents } = useSdAgents(workspaceId, {
    includeRequesters: true,
  })
  const [name, setName] = useState(board?.name ?? '')
  const [description, setDescription] = useState(board?.description ?? '')
  const [quorum, setQuorum] = useState(board?.quorum ?? 0)
  const [rejectEnds, setRejectEnds] = useState(board?.rejectEnds ?? true)
  const [conditions, setConditions] = useState<SdCondition[]>(
    board?.conditions ?? [],
  )
  const [members, setMembers] = useState<
    { userId: string; required: boolean }[]
  >(
    board?.members.map((m) => ({ userId: m.userId, required: m.required })) ??
      [],
  )

  const quorumFits = quorum === 0 || quorum <= members.length
  const valid = name.trim().length > 0 && members.length > 0 && quorumFits

  function toggleMember(userId: string) {
    setMembers((current) =>
      current.some((m) => m.userId === userId)
        ? current.filter((m) => m.userId !== userId)
        : [...current, { userId, required: false }],
    )
  }

  function toggleRequired(userId: string) {
    setMembers((current) =>
      current.map((m) =>
        m.userId === userId ? { ...m, required: !m.required } : m,
      ),
    )
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{board ? 'Editar comitê' : 'Novo comitê'}</DialogTitle>
        </DialogHeader>
        <div className='flex max-h-[65vh] flex-col gap-4 overflow-y-auto'>
          <FieldBlock label='Nome'>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder='CAB de infraestrutura'
              autoFocus
            />
          </FieldBlock>
          <FieldBlock label='Descrição'>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </FieldBlock>
          <FieldBlock
            label='Membros'
            hint='Cada membro recebe um link próprio por e-mail. Marque "obrigatório" para exigir o voto mesmo com o quórum atingido.'
          >
            <div className='flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2'>
              {(agents ?? []).map((agent) => {
                const member = members.find((m) => m.userId === agent.id)
                return (
                  <div
                    key={agent.id}
                    className='flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50'
                  >
                    <label className='flex min-w-0 flex-1 items-center gap-2 text-sm'>
                      <input
                        type='checkbox'
                        checked={!!member}
                        onChange={() => toggleMember(agent.id)}
                        className='size-4 accent-primary'
                      />
                      <span className='truncate'>{agent.name}</span>
                      <span className='truncate text-muted-foreground text-xs'>
                        {agent.email}
                      </span>
                    </label>
                    {member ? (
                      <Button
                        type='button'
                        size='sm'
                        variant={member.required ? 'default' : 'outline'}
                        onClick={() => toggleRequired(agent.id)}
                      >
                        {member.required ? 'Obrigatório' : 'Opcional'}
                      </Button>
                    ) : null}
                  </div>
                )
              })}
              {(agents ?? []).length === 0 ? (
                <p className='px-2 py-3 text-muted-foreground text-sm'>
                  Nenhum membro disponível.
                </p>
              ) : null}
            </div>
          </FieldBlock>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock
              label='Quórum'
              hint={
                quorumFits
                  ? '0 = todos os membros.'
                  : `Não cabe em ${members.length} membro(s).`
              }
            >
              <NumberInput
                value={quorum}
                onCommit={(value) => setQuorum(value ?? 0)}
                min={0}
                max={30}
              />
            </FieldBlock>
            <ToggleRow
              label='Uma reprovação encerra'
              description='Sem isso, a rodada segue colhendo votos até o fim.'
              checked={rejectEnds}
              onCheckedChange={setRejectEnds}
            />
          </div>
          <FieldBlock
            label='Quando este comitê atende'
            hint='Sem condições, o comitê serve a qualquer mudança (deixe-o por último).'
          >
            <SdConditionBuilder value={conditions} onChange={setConditions} />
          </FieldBlock>
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!valid || saving}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim() || null,
                quorum,
                rejectEnds,
                conditions,
                members,
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
