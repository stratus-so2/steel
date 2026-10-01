'use client'

import { UserDropdownHelper } from '../user/user-dropdown-helper'
import { UserDropdownProfile } from '../user/user-dropdown-profile'
import { WorkSpaceDropdown } from '../workspace/workspace-dropdown/workspace-dropdown-selector'
import { HeaderInboxButton } from './header-inbox-button'

export function UserHeader({
  slug,
  workspaceId,
}: {
  slug: string
  workspaceId: string
}) {
  return (
    <div className='w-full flex justify-between items-center px-3.5'>
      <WorkSpaceDropdown currentSlug={slug} />
      <div className='flex items-center gap-1'>
        <HeaderInboxButton slug={slug} workspaceId={workspaceId} />
        <UserDropdownHelper />
        <UserDropdownProfile />
      </div>
    </div>
  )
}
