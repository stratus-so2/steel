import { type ReactNode, Suspense } from 'react'
import { SdSettingsNav } from '@/app/_components/servicedesk/settings/sd-settings-nav'

/**
 * Context rail of the settings screen, sitting where the module menu sits —
 * `SdModuleRail` steps aside for this route, so there is exactly one rail.
 *
 * The rail lives in this layout rather than being handed to the module layout
 * as a prop so that `SD_SETTINGS_TABS`, which statically imports all 24 tab
 * screens, stays out of the bundle of every other ServiceDesk page.
 *
 * The `Suspense` is required, not decorative: the rail marks the active
 * section from `?tab=`, and a client component reading `useSearchParams()`
 * without a boundary fails the build during static rendering.
 */
export default async function SdSettingsLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  return (
    <>
      <Suspense>
        <SdSettingsNav base={`/${slug}/servicedesk`} />
      </Suspense>
      {children}
    </>
  )
}
