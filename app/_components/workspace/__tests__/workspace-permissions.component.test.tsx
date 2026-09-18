import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SYSTEM_PROFILE_PERMISSIONS } from '@/src/lib/permissions'
import {
  useCan,
  useIsPrivileged,
  type WorkspacePermissions,
  WorkspacePermissionsProvider,
} from '../workspace-permissions'

function Probe() {
  const canView = useCan('companies', 'VIEW')
  const canDelete = useCan('companies', 'DELETE')
  const canCreateBroadcast = useCan('broadcasts', 'CREATE')
  return (
    <span data-testid='probe'>
      {[canView, canDelete, canCreateBroadcast].map(String).join(',')}
    </span>
  )
}

function renderWith(value?: WorkspacePermissions) {
  render(
    value ? (
      <WorkspacePermissionsProvider value={value}>
        <Probe />
      </WorkspacePermissionsProvider>
    ) : (
      <Probe />
    ),
  )
  return screen.getByTestId('probe').textContent
}

describe('useCan()', () => {
  it('lets OWNER/ADMIN do everything', () => {
    expect(renderWith({ isPrivileged: true, permissions: null })).toBe(
      'true,true,true',
    )
  })

  it('follows the MEMBER matrix: no delete, no broadcast creation', () => {
    expect(
      renderWith({
        isPrivileged: false,
        permissions: SYSTEM_PROFILE_PERMISSIONS.MEMBER,
      }),
    ).toBe('true,false,false')
  })

  it('denies everything when no matrix is resolved', () => {
    expect(renderWith({ isPrivileged: false, permissions: null })).toBe(
      'false,false,false',
    )
  })

  it('falls back to allowed outside the provider (the API still decides)', () => {
    expect(renderWith()).toBe('true,true,true')
  })
})

function PrivilegedProbe() {
  return <span data-testid='privileged'>{String(useIsPrivileged())}</span>
}

describe('useIsPrivileged()', () => {
  function privilegedWith(value?: WorkspacePermissions) {
    render(
      value ? (
        <WorkspacePermissionsProvider value={value}>
          <PrivilegedProbe />
        </WorkspacePermissionsProvider>
      ) : (
        <PrivilegedProbe />
      ),
    )
    return screen.getByTestId('privileged').textContent
  }

  it('is true only for OWNER/ADMIN, whatever the matrix grants', () => {
    expect(privilegedWith({ isPrivileged: true, permissions: null })).toBe(
      'true',
    )
  })

  it('is false for a member even with a permissive matrix', () => {
    expect(
      privilegedWith({
        isPrivileged: false,
        permissions: SYSTEM_PROFILE_PERMISSIONS.MEMBER,
      }),
    ).toBe('false')
  })

  it('falls back to true outside the provider (the API still decides)', () => {
    expect(privilegedWith()).toBe('true')
  })
})
