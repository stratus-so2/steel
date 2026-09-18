import type { FeatureKey } from '@/src/config/features'
import type { ModuleKind } from './workspace-connection'

/** Override vigente (ou expirado) de uma feature num workspace. */
export interface FeatureOverrideDTO {
  enabled: boolean
  note: string | null
  expiresAt: string | null
  /** `true` quando `expiresAt` já passou — o override não vale mais. */
  expired: boolean
  updatedById: string | null
  updatedAt: string
}

/** Linha do painel admin: catálogo + default do plano + override + efetivo. */
export interface WorkspaceFeatureDTO {
  key: FeatureKey
  module: ModuleKind
  label: string
  description: string
  planDefault: boolean
  override: FeatureOverrideDTO | null
  enabled: boolean
}

/** Mapa efetivo consumido pela UI do workspace (esconder o que não vale). */
export type WorkspaceFeatureMapDTO = Record<FeatureKey, boolean>
