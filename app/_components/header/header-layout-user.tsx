'use client'

import { MobileNavDrawer } from '../navigation/mobile-nav/mobile-nav-drawer'
import { GlobalSearch } from '../search/global-search'
import { UserDropdownHelper } from '../user/user-dropdown-helper'
import { UserDropdownProfile } from '../user/user-dropdown-profile'
import { WorkSpaceDropdown } from '../workspace/workspace-dropdown/workspace-dropdown-selector'
import { HeaderInboxButton } from './header-inbox-button'

export function UserHeader({
  slug,
  workspaceId,
  wikiEnabled = false,
}: {
  slug: string
  workspaceId: string
  wikiEnabled?: boolean
}) {
  return (
    <div className='w-full flex justify-between items-center gap-1 px-1.5 pt-[env(safe-area-inset-top)] md:px-3.5'>
      <div className='flex min-w-0 items-center gap-0.5'>
        <MobileNavDrawer slug={slug} wikiEnabled={wikiEnabled} />
        <WorkSpaceDropdown currentSlug={slug} />
      </div>
      {/* Touch targets: 40px below `md`, the compact 32-36px from there up. */}
      <div className='flex shrink-0 items-center gap-1 max-md:[&_[data-slot=button]]:size-10'>
        <GlobalSearch slug={slug} workspaceId={workspaceId} />
        <HeaderInboxButton slug={slug} workspaceId={workspaceId} />
        <UserDropdownHelper />
        <UserDropdownProfile />
      </div>
    </div>
  )
}
