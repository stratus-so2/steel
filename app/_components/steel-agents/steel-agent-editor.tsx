'use client'

import { Alert02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  type SteelAgentInput,
  useCreateSteelAgent,
  useSteelAgentCatalog,
  useSteelAgentMembers,
  useUpdateSteelAgent,
} from '@/src/hooks/use-steel-agents'
import type {
  SteelAgentDTO,
  SteelAgentTriggerTypeDTO,
} from '@/types/steel-agent'
import { CRON_PRESETS, TIMEZONES, TRIGGER_LABEL } from './steel-agent-labels'
import { SteelAgentToolPicker } from './steel-agent-tool-picker'

const CUSTOM = '__custom__'

function initialState(
  agent: SteelAgentDTO | undefined,
  defaultOwnerId: string,
): SteelAgentInput {
  return {
    name: agent?.name ?? '',
    description: agent?.description ?? null,
    instructions: agent?.instructions ?? '',
    triggerType: agent?.triggerType ?? 'MANUAL',
    cron: agent?.cron ?? '0 8 * * 1-5',
    timezone: agent?.timezone ?? 'America/Sao_Paulo',
    eventKey: agent?.eventKey ?? null,
    enabled: agent?.enabled ?? true,
    ownerId: agent?.owner?.id ?? defaultOwnerId,
    maxToolRounds: agent?.maxToolRounds ?? 8,
    monthlyRunCap: agent?.monthlyRunCap ?? null,
    tools: agent?.tools ?? [],
  }
}

/** Create/edit form of a Steel Agent (pt-BR). */
export function SteelAgentEditor({
  workspaceId,
  agent,
  currentUserId,
  onSaved,
}: {
  workspaceId: string
  agent?: SteelAgentDTO
  currentUserId: string
  onSaved: (agent: SteelAgentDTO) => void
}) {
  const catalog = useSteelAgentCatalog(workspaceId)
  const canManage = catalog.data?.canManage ?? false
  const members = useSteelAgentMembers(workspaceId, canManage)
  const create = useCreateSteelAgent(workspaceId)
  const update = useUpdateSteelAgent(workspaceId, agent?.id ?? '')
  const [form, setForm] = useState<SteelAgentInput>(() =>
    initialState(agent, currentUserId),
  )
  const saving = create.isPending || update.isPending
  const set = <K extends keyof SteelAgentInput>(
    key: K,
    value: SteelAgentInput[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }))

  if (catalog.isLoading) {
    return (
      <div className='space-y-3' aria-hidden>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className='h-16 rounded-lg' />
        ))}
      </div>
    )
  }
  if (!catalog.data) {
    return (
      <p className='text-destructive text-sm'>
        Não foi possível carregar o editor do agente.
      </p>
    )
  }
  const { tools, events, agentModeEnabled } = catalog.data
  const disabled = !canManage || saving
  const preset = CRON_PRESETS.some((p) => p.cron === form.cron)
    ? (form.cron as string)
    : CUSTOM
  const hasWrites = form.tools.some(
    (t) => tools.find((tool) => tool.name === t.toolName)?.kind !== 'READ',
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const body: SteelAgentInput = {
      ...form,
      description: form.description?.trim() || null,
      cron: form.triggerType === 'SCHEDULE' ? form.cron : null,
      eventKey: form.triggerType === 'EVENT' ? form.eventKey : null,
    }
    try {
      const saved = agent
        ? await update.mutateAsync(body)
        : await create.mutateAsync(body)
      notify.success(agent ? 'Agente salvo.' : 'Agente criado.')
      onSaved(saved)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <form onSubmit={submit} className='space-y-6' aria-label='Editor do agente'>
      {!canManage ? (
        <p className='rounded-lg border bg-muted/40 p-3 text-muted-foreground text-sm'>
          Você pode ver este agente, mas só administradores editam.
        </p>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor='agent-name'>Nome</FieldLabel>
          <Input
            id='agent-name'
            value={form.name}
            maxLength={120}
            required
            disabled={disabled}
            onChange={(e) => set('name', e.target.value)}
            placeholder='Ex.: Triagem de chamados'
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='agent-description'>Descrição</FieldLabel>
          <Input
            id='agent-description'
            value={form.description ?? ''}
            maxLength={2000}
            disabled={disabled}
            onChange={(e) => set('description', e.target.value)}
            placeholder='Para que serve este agente'
          />
        </Field>
        <Field>
          <FieldLabel htmlFor='agent-instructions'>Instruções</FieldLabel>
          <Textarea
            id='agent-instructions'
            value={form.instructions}
            rows={8}
            maxLength={20_000}
            required
            disabled={disabled}
            onChange={(e) => set('instructions', e.target.value)}
            placeholder='Descreva o que o agente deve fazer, com quais critérios e o que nunca deve fazer.'
          />
          <FieldDescription>
            É o prompt do agente. Ele roda sozinho: seja específico sobre o que
            consultar, quando agir e quando parar.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field>
          <FieldLabel>Gatilho</FieldLabel>
          <Select
            items={Object.entries(TRIGGER_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
            value={form.triggerType}
            disabled={disabled}
            onValueChange={(next) =>
              next && set('triggerType', next as SteelAgentTriggerTypeDTO)
            }
          >
            <SelectTrigger aria-label='Gatilho' className='w-full sm:w-64'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='MANUAL'>Manual (Executar agora)</SelectItem>
              <SelectItem value='SCHEDULE'>Agenda</SelectItem>
              <SelectItem value='EVENT'>Evento</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {form.triggerType === 'SCHEDULE' ? (
          <div className='grid gap-4 sm:grid-cols-3'>
            <Field>
              <FieldLabel>Frequência</FieldLabel>
              <Select
                items={[
                  ...CRON_PRESETS.map((p) => ({
                    value: p.cron,
                    label: p.label,
                  })),
                  { value: CUSTOM, label: 'Personalizada (cron)' },
                ]}
                value={preset}
                disabled={disabled}
                onValueChange={(next) => {
                  if (next && next !== CUSTOM) set('cron', next as string)
                  if (next === CUSTOM) set('cron', '')
                }}
              >
                <SelectTrigger aria-label='Frequência' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.cron} value={p.cron}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>Personalizada (cron)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor='agent-cron'>Expressão cron</FieldLabel>
              <Input
                id='agent-cron'
                value={form.cron ?? ''}
                disabled={disabled}
                onChange={(e) => set('cron', e.target.value)}
                placeholder='minuto hora dia mês dia-da-semana'
                className='font-mono'
              />
            </Field>
            <Field>
              <FieldLabel>Fuso horário</FieldLabel>
              <Select
                items={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
                value={form.timezone}
                disabled={disabled}
                onValueChange={(next) =>
                  next && set('timezone', next as string)
                }
              >
                <SelectTrigger aria-label='Fuso horário' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}

        {form.triggerType === 'EVENT' ? (
          <Field>
            <FieldLabel>Evento</FieldLabel>
            <Select
              items={events.map((e) => ({ value: e.key, label: e.label }))}
              value={form.eventKey ?? ''}
              disabled={disabled}
              onValueChange={(next) => next && set('eventKey', next as string)}
            >
              <SelectTrigger aria-label='Evento' className='w-full sm:w-96'>
                <SelectValue placeholder='Escolha o evento' />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.key} value={e.key}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              {events.find((e) => e.key === form.eventKey)?.description ??
                'O agente roda a cada vez que o evento acontecer.'}
            </FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>

      <FieldGroup>
        <Field>
          <FieldLabel>Responsável</FieldLabel>
          <Select
            items={(members.data ?? []).map((m) => ({
              value: m.userId,
              label: m.name,
            }))}
            value={form.ownerId}
            disabled={disabled || !members.data}
            onValueChange={(next) => next && set('ownerId', next as string)}
          >
            <SelectTrigger aria-label='Responsável' className='w-full sm:w-80'>
              <SelectValue placeholder={agent?.owner?.name ?? 'Escolha'} />
            </SelectTrigger>
            <SelectContent>
              {(members.data ?? []).map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name} · {m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            O agente roda com as permissões desta pessoa e ela recebe os pedidos
            de aprovação na caixa de entrada.
          </FieldDescription>
        </Field>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field>
            <FieldLabel htmlFor='agent-rounds'>Máximo de etapas</FieldLabel>
            <Input
              id='agent-rounds'
              type='number'
              min={1}
              max={20}
              value={form.maxToolRounds}
              disabled={disabled}
              onChange={(e) =>
                set('maxToolRounds', Number(e.target.value) || 1)
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor='agent-cap'>
              Limite de execuções por mês
            </FieldLabel>
            <Input
              id='agent-cap'
              type='number'
              min={1}
              value={form.monthlyRunCap ?? ''}
              disabled={disabled}
              placeholder='Sem limite'
              onChange={(e) =>
                set(
                  'monthlyRunCap',
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            />
          </Field>
        </div>
        <Field orientation='horizontal'>
          <Switch
            id='agent-enabled'
            checked={form.enabled}
            disabled={disabled}
            onCheckedChange={(next) => set('enabled', next)}
          />
          <FieldLabel htmlFor='agent-enabled'>
            {form.enabled ? 'Ativo' : 'Pausado'}
          </FieldLabel>
        </Field>
      </FieldGroup>

      <section className='space-y-2'>
        <div>
          <h3 className='font-semibold text-sm'>Ferramentas permitidas</h3>
          <p className='text-muted-foreground text-sm'>
            Leituras rodam sempre. Escritas são “Automática” ou “Requer
            aprovação” (padrão); exclusões sempre pedem aprovação.
          </p>
        </div>
        {!agentModeEnabled && hasWrites ? (
          <p className='flex items-start gap-1.5 rounded-lg border border-destructive/40 p-3 text-destructive text-sm'>
            <SteelIcon
              icon={Alert02Icon}
              strokeWidth={2}
              className='mt-0.5 size-4 shrink-0'
            />
            O modo agente está desligado em Ajustes &gt; Steel IA. Agentes com
            ferramentas de escrita não rodam enquanto ele estiver desligado.
          </p>
        ) : null}
        <SteelAgentToolPicker
          tools={tools}
          value={form.tools}
          onChange={(next) => set('tools', next)}
          disabled={disabled}
        />
      </section>

      {canManage ? (
        <div className='flex justify-end gap-2'>
          <Button type='submit' disabled={saving}>
            {saving ? 'Salvando…' : agent ? 'Salvar' : 'Criar agente'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
