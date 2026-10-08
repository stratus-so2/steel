'use client'

import { AddCircleIcon, AddTeamIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUser } from '@/src/hooks/use-user'
import type { MembershipDTO } from '@/types/user'
import { WorkspaceAvatar } from '../workspace-avatar'
import { WorkspaceDropdownCard } from './workspace-dropdown-card'

export function WorkSpaceDropdown({ currentSlug }: { currentSlug: string }) {
  const { push } = useRouter()
  const { data: user } = useUser()

  const memberships: MembershipDTO[] = user?.memberships ?? []
  const current = memberships.find((m) => m.slug === currentSlug)

  function handleSelect(slug: string) {
    if (slug !== currentSlug) push(`/${slug}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant='ghost' className='min-w-0 max-w-full max-md:h-10'>
            <WorkspaceAvatar
              name={current?.name ?? '?'}
              logoUrl={current?.logoUrl}
              className='size-6 rounded-sm text-xs'
              fallbackClassName='bg-blue-400 text-white'
            />
            <span className='truncate'>
              {current?.name ?? 'Selecionar workspace'}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent className='w-max p-3 flex flex-col gap-y-2 rounded-md'>
        <DropdownMenuGroup>
          <DropdownMenuItem disabled className='text-sm'>
            {user?.email}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {memberships.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              className='text-sm space-y-1'
              value={currentSlug}
              onValueChange={handleSelect}
            >
              {memberships.map((m) => (
                <WorkspaceDropdownCard key={m.workspaceId} membership={m} />
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem
            className='text-sm'
            render={<Link href='/create-workspace' />}
          >
            <SteelIcon icon={AddCircleIcon} />
            Criar workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            className='text-sm'
            render={<Link href={`/${currentSlug}/settings/members`} />}
          >
            <SteelIcon icon={AddTeamIcon} />
            Convidar para workspace
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
