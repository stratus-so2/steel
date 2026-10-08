'use client'

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  LockIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { STEEL_AI_MODULE_META } from '@/app/_components/steel-ai/steel-ai-starters'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type {
  AiSkillTemplateDTO,
  AiTemplateToolDTO,
  SteelAgentTemplateDTO,
} from '@/types/ai-template'
import {
  matchesModuleFilter,
  TEMPLATE_CATEGORIES,
  type TemplateModuleFilter,
} from './template-prefill'

const FILTERS: { value: TemplateModuleFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'SERVICE_DESK', label: STEEL_AI_MODULE_META.SERVICE_DESK.label },
  { value: 'CRM', label: STEEL_AI_MODULE_META.CRM.label },
  { value: 'COMMUNICATION', label: STEEL_AI_MODULE_META.COMMUNICATION.label },
  { value: 'PLATFORM', label: 'Plataforma' },
]

const MODE_LABEL: Record<NonNullable<AiSkillTemplateDTO['mode']>, string> = {
  EXPLORE: 'Ask',
  AGENT: 'Build',
  AUTOPILOT: 'Autopilot',
  TEST: 'Teste',
}

type GalleryProps =
  | {
      kind: 'agents'
      templates: SteelAgentTemplateDTO[]
      onPick: (template: SteelAgentTemplateDTO) => void
    }
  | {
      kind: 'skills'
      templates: AiSkillTemplateDTO[]
      onPick: (template: AiSkillTemplateDTO) => void
    }

function ToolLine({
  icon,
  title,
  tools,
}: {
  icon: typeof LockIcon
  title: string
  tools: AiTemplateToolDTO[]
}) {
  if (tools.length === 0) return null
  return (
    <p className='flex items-start gap-1.5 text-muted-foreground text-xs'>
      <SteelIcon
        icon={icon}
        strokeWidth={2}
        className='mt-px size-3.5 shrink-0'
      />
      <span className='min-w-0'>
        <span className='font-medium text-foreground'>{title}:</span>{' '}
        {tools.map((tool) => tool.label).join(', ')}
      </span>
    </p>
  )
}

function TemplateCard({
  template,
  kind,
  taken,
  agentModeEnabled,
  onPick,
}: {
  template: SteelAgentTemplateDTO | AiSkillTemplateDTO
  kind: 'agents' | 'skills'
  taken: boolean
  agentModeEnabled: boolean
  onPick: () => void
}) {
  const reads = template.tools.filter((t) => t.kind === 'READ')
  const writes = template.tools.filter((t) => t.kind !== 'READ')
  const automatic = [...reads, ...writes.filter((t) => t.mode === 'AUTO')]
  const approval = writes.filter((t) => t.mode === 'APPROVAL')
  const titleId = `template-${kind}-${template.id}`

  return (
    <li
      aria-labelledby={titleId}
      aria-disabled={!template.available || undefined}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xl border border-border/80 bg-card p-4',
        !template.available && 'bg-muted/30',
      )}
    >
      <div className='min-w-0 space-y-1'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          <h4 id={titleId} className='font-medium text-sm'>
            {template.name}
          </h4>
          {taken ? <Badge variant='secondary'>Já adicionada</Badge> : null}
        </div>
        <p className='text-muted-foreground text-sm'>{template.description}</p>
      </div>

      <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
        {template.modules.length === 0 ? (
          <Badge variant='outline'>Qualquer workspace</Badge>
        ) : (
          template.modules.map((module) => (
            <Badge key={module} variant='outline' className='gap-1'>
              <SteelIcon
                icon={STEEL_AI_MODULE_META[module].icon}
                strokeWidth={2}
                className='size-3'
              />
              {STEEL_AI_MODULE_META[module].label}
            </Badge>
          ))
        )}
        {'scheduleLabel' in template ? (
          <Badge variant='outline' className='gap-1'>
            <SteelIcon icon={Clock01Icon} strokeWidth={2} className='size-3' />
            {template.scheduleLabel}
          </Badge>
        ) : null}
        {'slug' in template ? (
          <>
            <Badge variant='outline' className='font-mono'>
              /{template.slug}
            </Badge>
            {template.mode ? (
              <Badge variant='outline'>{MODE_LABEL[template.mode]}</Badge>
            ) : null}
          </>
        ) : null}
      </div>

      {kind === 'agents' ? (
        <div className='space-y-1'>
          <ToolLine
            icon={CheckmarkCircle02Icon}
            title='Faz sozinho'
            tools={automatic}
          />
          <ToolLine icon={LockIcon} title='Pede aprovação' tools={approval} />
          {!agentModeEnabled && writes.length > 0 ? (
            <p className='text-muted-foreground text-xs'>
              Com o modo agente desligado, só as leituras rodam.
            </p>
          ) : null}
        </div>
      ) : (
        <ToolLine
          icon={CheckmarkCircle02Icon}
          title='Consulta'
          tools={template.tools}
        />
      )}

      <div className='mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        {template.available ? (
          <span className='hidden sm:block' />
        ) : (
          <p className='flex items-start gap-1.5 text-muted-foreground text-xs'>
            <SteelIcon
              icon={Alert02Icon}
              strokeWidth={2}
              className='mt-px size-3.5 shrink-0'
            />
            {template.unavailableReason}
          </p>
        )}
        <Button
          size='sm'
          variant={template.available ? 'default' : 'outline'}
          disabled={!template.available}
          onClick={onPick}
          aria-label={`Usar o modelo ${template.name}`}
          className='w-full shrink-0 sm:w-auto'
        >
          Usar modelo
        </Button>
      </div>
    </li>
  )
}

/**
 * Gallery of ready-made templates (agents or skills), grouped by category
 * with a module filter. Picking one only pre-fills the editor.
 */
export function SteelAiTemplateGallery({
  open,
  onOpenChange,
  agentModeEnabled = true,
  takenSlugs,
  ...props
}: GalleryProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentModeEnabled?: boolean
  /** Skills: commands that already exist in the workspace. */
  takenSlugs?: ReadonlySet<string>
}) {
  const [filter, setFilter] = useState<TemplateModuleFilter>('ALL')
  const visible = (
    props.templates as (SteelAgentTemplateDTO | AiSkillTemplateDTO)[]
  ).filter((template) => matchesModuleFilter(template, filter))

  function pick(template: SteelAgentTemplateDTO | AiSkillTemplateDTO) {
    if (props.kind === 'agents') {
      props.onPick(template as SteelAgentTemplateDTO)
    } else {
      props.onPick(template as AiSkillTemplateDTO)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {props.kind === 'agents'
              ? 'Modelos de agentes'
              : 'Modelos de skills'}
          </DialogTitle>
          <DialogDescription>
            {props.kind === 'agents'
              ? 'Agentes prontos para administradores. Escolha um para abrir o editor já preenchido — nada é salvo até você criar o agente.'
              : 'Skills prontas para administradores. Escolha uma para abrir o formulário já preenchido — nada é salvo até você criar a skill.'}
          </DialogDescription>
        </DialogHeader>

        <fieldset className='flex min-w-0 flex-wrap gap-1.5'>
          <legend className='sr-only'>Filtrar por módulo</legend>
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              size='sm'
              variant={filter === option.value ? 'secondary' : 'ghost'}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </fieldset>

        {visible.length === 0 ? (
          <p className='rounded-xl border border-dashed px-4 py-8 text-center text-muted-foreground text-sm'>
            Nenhum modelo para este filtro.
          </p>
        ) : (
          <div className='space-y-5'>
            {TEMPLATE_CATEGORIES.map((category) => {
              const items = visible.filter(
                (template) => template.category === category.value,
              )
              if (items.length === 0) return null
              return (
                <section
                  key={category.value}
                  aria-labelledby={`templates-${props.kind}-${category.value}`}
                  className='space-y-2'
                >
                  <h3
                    id={`templates-${props.kind}-${category.value}`}
                    className='font-medium text-muted-foreground text-xs uppercase tracking-wide'
                  >
                    {category.label}
                  </h3>
                  <ul className='grid gap-3 sm:grid-cols-2'>
                    {items.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        kind={props.kind}
                        agentModeEnabled={agentModeEnabled}
                        taken={
                          'slug' in template &&
                          Boolean(takenSlugs?.has(template.slug))
                        }
                        onPick={() => pick(template)}
                      />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
