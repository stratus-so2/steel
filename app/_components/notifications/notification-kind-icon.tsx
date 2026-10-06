import {
  AlarmClockIcon,
  Alert02Icon,
  AnalyticsUpIcon,
  ArrowUpRight01Icon,
  AtIcon,
  BookOpen01Icon,
  BubbleChatIcon,
  ChartLineData01Icon,
  CheckmarkBadge01Icon,
  CreditCardIcon,
  Download01Icon,
  FileEditIcon,
  HandshakeIcon,
  HourglassIcon,
  Invoice01Icon,
  Mail01Icon,
  Message01Icon,
  News01Icon,
  Notification01Icon,
  Share08Icon,
  SparklesIcon,
  StarIcon,
  Target02Icon,
  Task01Icon,
  Ticket01Icon,
  TicketStarIcon,
  UserAdd01Icon,
  UserSwitchIcon,
  WorkflowSquare01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ComponentProps } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

type IconSvg = ComponentProps<typeof SteelIcon>['icon']

/**
 * Único lugar que traduz a chave de ícone da tabela pura
 * (`src/lib/notification-kind.ts`) num componente. A interface nunca faz
 * `switch` em `kind`.
 */
const ICONS: Record<string, IconSvg> = {
  ticket: Ticket01Icon,
  'ticket-check': CheckmarkBadge01Icon,
  'ticket-alert': TicketStarIcon,
  message: Message01Icon,
  mention: AtIcon,
  alarm: AlarmClockIcon,
  escalate: ArrowUpRight01Icon,
  approval: CheckmarkBadge01Icon,
  task: Task01Icon,
  digest: News01Icon,
  forecast: AnalyticsUpIcon,
  problem: Alert02Icon,
  article: BookOpen01Icon,
  report: ChartLineData01Icon,
  star: StarIcon,
  chat: BubbleChatIcon,
  deal: HandshakeIcon,
  bell: Notification01Icon,
  assign: UserSwitchIcon,
  proposal: Invoice01Icon,
  form: FileEditIcon,
  mail: Mail01Icon,
  workflow: WorkflowSquare01Icon,
  hourglass: HourglassIcon,
  social: Share08Icon,
  competitor: Target02Icon,
  member: UserAdd01Icon,
  download: Download01Icon,
  billing: CreditCardIcon,
  sparkles: SparklesIcon,
}

/**
 * Marcador de origem da notificação: ícone do evento sobre o tom do módulo.
 * A cor usa o padrão do repositório (`bg-<c>-500/10 text-<c>-700
 * dark:text-<c>-300`), que tem contraste nos dois temas. As classes vêm de um
 * mapa fechado para o Tailwind conseguir enxergá-las.
 */
const TONES: Record<string, string> = {
  sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  yellow: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
}

export function notificationTone(color: string): string {
  return TONES[color] ?? TONES.slate
}

export function NotificationKindIcon({
  icon,
  color,
  size = 16,
  className,
}: {
  icon: string
  color: string
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        notificationTone(color),
        className,
      )}
    >
      <SteelIcon
        icon={ICONS[icon] ?? Notification01Icon}
        strokeWidth={2}
        size={size}
      />
    </span>
  )
}
