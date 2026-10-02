'use client'

import { ArrowLeft01Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  ContextHeader,
  ContextSidebar,
  NavGroup,
  NavGroupAccordion,
  NavItem,
} from '@/app/_components/navigation/sidebar-context'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SD_SETTINGS_TABS, type SdSettingsTabDefinition } from './settings-tabs'

/**
 * Navegação das configurações do ServiceDesk na barra de contexto do módulo.
 *
 * Antes as 24 seções moravam numa segunda barra **dentro** da tela: um trilho
 * de 240px colado no trilho do módulo (dois trilhos lado a lado no desktop) e,
 * abaixo de `md`, uma barra horizontal extra logo sob o breadcrumb. Nenhuma
 * outra tela do app faz isso — CRM e Comunicação põem a navegação de
 * configuração na `ContextSidebar` do módulo e deixam o conteúdo respirar.
 * Aqui o trilho do módulo passa a mostrar as seções enquanto se está em
 * `/servicedesk/settings`, agrupadas em acordeões (`NavGroupAccordion`, o
 * mesmo recurso que o CRM usa em Marketing e Social).
 *
 * A seção ativa continua em `?tab=`, e não em segmento de rota: há link de
 * e-mail já enviado, notificação no app e rota de OAuth apontando para
 * `settings?tab=reports`, `?tab=whatsapp` e `?tab=integrations`.
 */

/**
 * Agrupamento só de apresentação — o registro (`SD_SETTINGS_TABS`) segue
 * plano e na mesma ordem, que é o que os testes das abas afirmam. Uma aba
 * nova que ninguém listou aqui cai em "Outros" em vez de desaparecer.
 */
const GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Geral', ids: ['general', 'departments'] },
  {
    label: 'Chamados',
    ids: [
      'flows',
      'catalog',
      'classifications',
      'priorities',
      'custom-fields',
      'templates',
      'recurring',
      'canned-responses',
    ],
  },
  {
    label: 'Atendimento',
    ids: ['sla', 'escalation', 'oncall', 'automations', 'changes'],
  },
  { label: 'Recursos', ids: ['parts', 'contracts'] },
  { label: 'Operação', ids: ['reports', 'monitoring'] },
  { label: 'Canais e integrações', ids: ['mail', 'whatsapp', 'integrations'] },
  { label: 'Preferências', ids: ['notifications', 'ai'] },
]

/** Abas de cada grupo, na ordem do registro, + as não listadas em "Outros". */
export function sdSettingsNavGroups(
  tabs: SdSettingsTabDefinition[] = SD_SETTINGS_TABS,
): { label: string; tabs: SdSettingsTabDefinition[] }[] {
  const grouped = GROUPS.map((group) => ({
    label: group.label,
    tabs: tabs.filter((tab) => group.ids.includes(tab.id)),
  })).filter((group) => group.tabs.length > 0)

  const placed = new Set(GROUPS.flatMap((group) => group.ids))
  const rest = tabs.filter((tab) => !placed.has(tab.id))
  return rest.length > 0
    ? [...grouped, { label: 'Outros', tabs: rest }]
    : grouped
}

/** Item de seção: um `<Link>` de verdade, ativo por `?tab=`. */
function SdSettingsNavItem({
  tab,
  base,
  active,
}: {
  tab: SdSettingsTabDefinition
  base: string
  active: boolean
}) {
  return (
    <Link href={`${base}/settings?tab=${tab.id}`} className='block'>
      <Button
        variant={active ? 'secondary' : 'ghost'}
        size='sm'
        aria-current={active ? 'page' : undefined}
        className={cn('w-full justify-start')}
      >
        <SteelIcon icon={tab.icon} strokeWidth={2} />
        {tab.label}
      </Button>
    </Link>
  )
}

export function SdSettingsNav({ base }: { base: string }) {
  const searchParams = useSearchParams()
  const requested = searchParams.get('tab')
  const activeId = (
    SD_SETTINGS_TABS.find((tab) => tab.id === requested) ?? SD_SETTINGS_TABS[0]
  ).id

  return (
    <ContextSidebar>
      <ContextHeader title='Configurações' />
      <NavGroup>
        <NavItem href={base} icon={ArrowLeft01Icon}>
          Voltar ao ServiceDesk
        </NavItem>
      </NavGroup>
      {sdSettingsNavGroups().map((group) => (
        <NavGroupAccordion
          key={group.label}
          label={group.label}
          defaultOpen={group.tabs.some((tab) => tab.id === activeId)}
        >
          {group.tabs.map((tab) => (
            <SdSettingsNavItem
              key={tab.id}
              tab={tab}
              base={base}
              active={tab.id === activeId}
            />
          ))}
        </NavGroupAccordion>
      ))}
    </ContextSidebar>
  )
}

/**
 * Troca o trilho do módulo pelo das configurações quando a rota é
 * `/servicedesk/settings`. O layout é server component e não lê `pathname`,
 * então a decisão vem para o cliente e o menu do módulo entra como children.
 */
export function SdContextRail({
  base,
  children,
}: {
  base: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  if (pathname.startsWith(`${base}/settings`)) {
    return <SdSettingsNav base={base} />
  }
  return children
}
