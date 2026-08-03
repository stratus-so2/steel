import {
  BookOpen01Icon,
  Home09Icon,
  SparklesIcon,
  Ticket01Icon,
  UserGroupIcon,
  WhatsappBusinessIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
import { H4 } from '@/components/typography/heading/h4'
import { Muted } from '@/components/typography/text/muted'
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getAuthSession } from '@/src/lib/auth-session'
import { PREFERENCE_COOKIES } from '@/src/lib/preference-cookies'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Página inicial | Steel',
  description: 'Seu painel inicial com links rápidos e anotações.',
}

// A maioria dos usuários nunca configurou um fuso em Preferências (a
// coluna nasce com "UTC" por padrão) — cair pra "UTC" faz o servidor
// (que roda em UTC) achar que é noite às 15h de Brasília. São Paulo é
// uma aposta muito melhor que UTC pro público do produto.
const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

/** Fuso pra formatação SSR: cookie espelhado da preferência, com fallback seguro. */
async function resolveTimezone() {
  const cookieStore = await cookies()
  const tz = cookieStore.get(PREFERENCE_COOKIES.timezone)?.value

  if (!tz) return DEFAULT_TIMEZONE

  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_TIMEZONE
  }
}

async function getGreeting(timezone: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('greeting')

  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date()),
  )

  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'

  return 'Boa noite'
}

function nameInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const WORKSPACE_QUICK_LINKS = [
  { label: 'Servicedesk', href: 'servicedesk', icon: Ticket01Icon },
  { label: 'CRM', href: 'crm', icon: UserGroupIcon },
  { label: 'Comunicação', href: 'zap', icon: WhatsappBusinessIcon },
  { label: 'Wiki', href: 'wiki', icon: BookOpen01Icon },
  { label: 'IA', href: 'ai', icon: SparklesIcon },
] as const

async function getFullDate(timezone: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('full-date')

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })
    .formatToParts(new Date())
    .map((part) =>
      part.type === 'weekday' || part.type === 'month'
        ? part.value.charAt(0).toUpperCase() + part.value.slice(1)
        : part.value,
    )
    .join('')
}

export default async function Page({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const userName = session.value.user.name

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) redirect('/create-workspace')

  const timezone = await resolveTimezone()
  const [greeting, fullDate, members] = await Promise.all([
    getGreeting(timezone),
    getFullDate(timezone),
    MembershipService.listWithUserByWorkspace(membership.value.workspaceId),
  ])
  const workspaceMembers = members.ok ? members.value : []

  return (
    <div className='w-full h-full overflow-y-scroll'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title={'Página inicial'}>
            <SteelIcon
              icon={Home09Icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='max-w-200 w-full h-full mx-auto p-6 space-y-8'>
        <div>
          <div className='text-center'>
            <H4>
              {greeting}, {userName}
            </H4>
            <Muted>{fullDate}</Muted>
          </div>
        </div>
        <div className='space-y-4'>
          <div>
            <H4 className='text-base'>Chame toda sua equipe</H4>
            <Muted className='text-sx text-muted-foreground'>
              Convide seus colegas para colaborar e construir juntos.
            </Muted>
          </div>
          <div className='bg-accent rounded-xl gap-4 flex items-center border border-border w-full px-4 py-5 flex-wrap'>
            {workspaceMembers.length === 0 ? (
              <Muted>Não foi possível carregar os membros do workspace.</Muted>
            ) : (
              <AvatarGroup>
                {workspaceMembers.map((member) => (
                  <Tooltip key={member.id}>
                    <TooltipTrigger
                      render={<Avatar size='lg' className='cursor-default' />}
                    >
                      <AvatarImage
                        src={member.user.image ?? undefined}
                        alt={member.user.name}
                      />
                      <AvatarFallback>
                        {nameInitials(member.user.name)}
                      </AvatarFallback>
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>
                      {member.user.name}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </AvatarGroup>
            )}
          </div>
          <Link
            href={`/${slug}/settings/members`}
            className='hover:underline text-sm'
          >
            Adicionar novo membro
          </Link>
        </div>
        <div className='flex items-center gap-4 w-full'>
          <div className='h-52 bg-accent rounded-xl gap-4 flex flex-col border border-border w-full px-4 py-5'>
            <H4>Alimente seu workspace</H4>
            <div className='flex items-center gap-4 flex-wrap'>
              {WORKSPACE_QUICK_LINKS.map((link) => (
                <Link key={link.href} href={`/${slug}/${link.href}`}>
                  <Badge variant='outline' className='rounded-sm h-7 px-2'>
                    <SteelIcon icon={link.icon} size={14} />
                    {link.label}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
          <div className='max-w-52 h-52 bg-accent rounded-xl gap-4 flex flex-col border border-border w-full px-4 py-5'>
            <Link href='/docs' className='hover:underline text-sm'>
              Documentação
            </Link>
            <Link href='/talk-to-sales' className='hover:underline text-sm'>
              Contate as vendas
            </Link>
            {/* TODO: sem um número/link de suporte oficial definido ainda */}
            <Link href='#' className='hover:underline text-sm'>
              Suporte por WhatsApp
            </Link>
          </div>
        </div>
        <div className='space-y-4'>
          <div>
            <H4 className='text-base'>
              Descubra por que as equipes migram para o Steel
            </H4>
            <Muted className='text-sx text-muted-foreground'>
              Compare o Steel com as ferramentas que você usa hoje e veja a
              diferença.
            </Muted>
          </div>
          <div className='bg-accent rounded-xl gap-4 flex items-center border border-border w-full px-4 py-5 flex-wrap'>
            <Link href='#'>
              <Badge variant='outline' className='rounded-sm h-7 px-2'>
                Compare com o Glpi
              </Badge>
            </Link>
            <Link href='#'>
              <Badge variant='outline' className='rounded-sm h-7 px-2'>
                Compare com o Glpi
              </Badge>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
