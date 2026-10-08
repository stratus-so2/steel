import {
  Settings01Icon,
  UserAdd01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'
import { DropdownMenuRadioItem } from '@/components/ui/dropdown-menu'
import type { MembershipDTO } from '@/types/user'
import { WorkspaceAvatar } from '../workspace-avatar'

export function WorkspaceDropdownCard({
  membership,
}: {
  membership: MembershipDTO
}) {
  const roleLabel =
    membership.role.charAt(0) + membership.role.slice(1).toLowerCase()

  return (
    <DropdownMenuRadioItem
      value={membership.slug}
      className='data-checked:bg-accent'
    >
      <div className='flex flex-col items-start justify-center gap-y-4'>
        <div className='w-full flex gap-1.5 items-center'>
          <WorkspaceAvatar
            name={membership.name}
            logoUrl={membership.logoUrl}
            className='size-6 rounded-sm text-xs'
            fallbackClassName='bg-blue-400 text-white'
          />
          <div className='w-max'>
            <p>{membership.name}</p>
            <div className='text-xs text-muted-foreground flex gap-2 capitalize w-fit'>
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>
        <div className='flex gap-2'>
          <Link
            href={`/${membership.slug}/settings`}
            className={buttonVariants({ size: 'xs', variant: 'outline' })}
          >
            <SteelIcon icon={Settings01Icon} />
            Configurações
          </Link>
          <Link
            href={`/${membership.slug}/settings/members`}
            className={buttonVariants({ size: 'xs', variant: 'outline' })}
          >
            <SteelIcon icon={UserAdd01Icon} />
            Convidar membros
          </Link>
        </div>
      </div>
    </DropdownMenuRadioItem>
  )
}
