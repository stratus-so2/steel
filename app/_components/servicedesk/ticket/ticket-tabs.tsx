'use client'

import type { IconSvgElement } from '@hugeicons/react'
import {
  ArrowDataTransferHorizontalIcon,
  ArrowUpDoubleIcon,
  BookOpen01Icon,
  CheckListIcon,
  HierarchyIcon,
  HistoryIcon,
  Money03Icon,
  PackageIcon,
  Route01Icon,
  SignatureIcon,
  Task01Icon,
  WhatsappIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ComponentType } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import { SdTicketApprovalsTab } from './tabs/approvals-tab'
import { SdTicketChangeTab } from './tabs/change-tab'
import { SdTicketChildrenTab } from './tabs/children-tab'
import { SdTicketCostsTab } from './tabs/costs-tab'
import { SdTicketEscalationTab } from './tabs/escalation-tab'
import { SdTicketHistoryTab } from './tabs/history-tab'
import { SdTicketKnowledgeTab } from './tabs/knowledge-tab'
import { SdTicketPartsTab } from './tabs/parts-tab'
import { SdTicketSignatureTab } from './tabs/signature-tab'
import { SdTicketTasksTab } from './tabs/tasks-tab'
import { SdTicketTraceabilityTab } from './tabs/traceability-tab'
import type { SdTicketTabProps } from './tabs/types'
import { SdTicketWhatsappTab } from './tabs/whatsapp-tab'

export interface SdTicketTabDef {
  id: string
  label: string
  icon: IconSvgElement
  component: ComponentType<SdTicketTabProps>
  /** Só na tela do agente (o portal usa `mode: 'requester'`). */
  agentOnly?: boolean
  /** Só nestes tipos de chamado (ausente = todos). */
  types?: readonly SdTicketTypeDTO[]
}

/**
 * Registro das abas da tela do chamado (ordem = ordem na tela). O id vai
 * na URL (`?tab=`). As abas vêm de fatias diferentes; todas seguem o
 * contrato `SdTicketTabProps`.
 */
export const SD_TICKET_TABS: SdTicketTabDef[] = [
  {
    id: 'history',
    label: 'Histórico',
    icon: HistoryIcon,
    component: SdTicketHistoryTab,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: WhatsappIcon,
    component: SdTicketWhatsappTab,
    agentOnly: true,
  },
  {
    id: 'tasks',
    label: 'Tarefas',
    icon: Task01Icon,
    component: SdTicketTasksTab,
    agentOnly: true,
  },
  {
    id: 'costs',
    label: 'Custos',
    icon: Money03Icon,
    component: SdTicketCostsTab,
    agentOnly: true,
  },
  {
    id: 'approvals',
    label: 'Aprovação',
    icon: CheckListIcon,
    component: SdTicketApprovalsTab,
  },
  {
    id: 'change',
    label: 'Mudança',
    icon: ArrowDataTransferHorizontalIcon,
    component: SdTicketChangeTab,
    agentOnly: true,
    types: ['CHANGE'],
  },
  {
    id: 'parts',
    label: 'Peças',
    icon: PackageIcon,
    component: SdTicketPartsTab,
    agentOnly: true,
  },
  {
    id: 'children',
    label: 'Itens filhos',
    icon: HierarchyIcon,
    component: SdTicketChildrenTab,
    agentOnly: true,
  },
  {
    id: 'escalation',
    label: 'Escalonamento',
    icon: ArrowUpDoubleIcon,
    component: SdTicketEscalationTab,
    agentOnly: true,
  },
  {
    id: 'traceability',
    label: 'Rastreabilidade',
    icon: Route01Icon,
    component: SdTicketTraceabilityTab,
    agentOnly: true,
  },
  {
    id: 'signature',
    label: 'Assinatura',
    icon: SignatureIcon,
    component: SdTicketSignatureTab,
  },
  {
    id: 'knowledge',
    label: 'Conhecimento',
    icon: BookOpen01Icon,
    component: SdTicketKnowledgeTab,
  },
]

/** Abas visíveis para o modo (agente vê todas). */
export function sdTicketTabsFor(
  mode: SdTicketTabProps['mode'],
  type?: SdTicketTypeDTO,
): SdTicketTabDef[] {
  return SD_TICKET_TABS.filter(
    (t) =>
      (mode === 'agent' || !t.agentOnly) &&
      (!t.types || !type || t.types.includes(type)),
  )
}

/** Aba ativa a partir do `?tab=` (inválida → a primeira). */
export function sdResolveTab(
  tab: string | null | undefined,
  mode: SdTicketTabProps['mode'],
  type?: SdTicketTypeDTO,
): string {
  const tabs = sdTicketTabsFor(mode, type)
  return tabs.find((t) => t.id === tab)?.id ?? tabs[0]?.id ?? 'history'
}

/**
 * Barra de abas + conteúdo da aba ativa (só a ativa é montada — cada aba
 * busca os próprios dados).
 */
export function SdTicketTabs({
  props,
  active,
  onChange,
  counts = {},
}: {
  props: SdTicketTabProps
  active: string
  onChange: (tab: string) => void
  /** Contadores por id de aba (ex.: `children: 3`). */
  counts?: Record<string, number | undefined>
}) {
  const tabs = sdTicketTabsFor(props.mode, props.ticket.type)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current?.component
  return (
    <div className='flex min-h-0 flex-col'>
      <div
        role='tablist'
        aria-label='Abas do chamado'
        className='no-scrollbar sticky top-0 z-20 flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-background px-2'
      >
        {tabs.map((tab) => {
          const selected = tab.id === current?.id
          const count = counts[tab.id]
          return (
            <button
              key={tab.id}
              type='button'
              role='tab'
              id={`sd-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`sd-tabpanel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 font-medium text-sm transition-colors',
                selected
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <SteelIcon icon={tab.icon} strokeWidth={2} className='size-4' />
              {tab.label}
              {count ? (
                <span className='rounded-full bg-muted px-1.5 text-[11px] tabular-nums'>
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {current && Active ? (
        <div
          role='tabpanel'
          id={`sd-tabpanel-${current.id}`}
          aria-labelledby={`sd-tab-${current.id}`}
          className='min-h-0 flex-1'
        >
          <Active {...props} />
        </div>
      ) : null}
    </div>
  )
}
