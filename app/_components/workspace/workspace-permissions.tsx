'use client'

import { createContext, type ReactNode, useContext } from 'react'
import {
  can,
  type PermissionAction,
  type PermissionMap,
} from '@/src/lib/permissions'

export interface WorkspacePermissions {
  isPrivileged: boolean
  permissions: PermissionMap | null
}

const Ctx = createContext<WorkspacePermissions | null>(null)

/**
 * Permissões efetivas do usuário na workspace, resolvidas no layout (server)
 * para a UI esconder ações que a API recusaria. É só conveniência de UX: a
 * autorização de verdade continua nos services.
 */
export function WorkspacePermissionsProvider({
  value,
  children,
}: {
  value: WorkspacePermissions
  children: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * O usuário pode executar `action` em `resource`? Fora do provider devolve
 * `true` (a API decide); OWNER/ADMIN sempre podem; os demais seguem a matriz
 * com negação por padrão.
 */
/**
 * O usuário é OWNER/ADMIN da workspace? Para controles só de administrador
 * que não mapeiam para um recurso da matriz (ex.: ajustes de IA). Fora do
 * provider devolve `null` (quem chama decide o fallback).
 */
export function useIsWorkspaceAdmin(): boolean | null {
  const ctx = useContext(Ctx)
  return ctx ? ctx.isPrivileged : null
}

export function useCan(resource: string, action: PermissionAction): boolean {
  const ctx = useContext(Ctx)
  if (!ctx) return true
  if (ctx.isPrivileged) return true
  return ctx.permissions ? can(ctx.permissions, resource, action) : false
}
