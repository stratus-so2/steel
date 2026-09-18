'use client'

import type { ReactNode } from 'react'
import type { FeatureKey } from '@/src/config/features'
import { useFeature } from '@/src/hooks/use-feature-flags'

/**
 * Esconde UI de uma feature desligada para o workspace (catálogo em
 * src/config/features.ts). É só apresentação — o bloqueio real está no
 * service (`assertFeature`). Enquanto carrega, não renderiza nada para não
 * piscar a UI de algo que pode estar desligado.
 */
export function FeatureGate({
  workspaceId,
  feature,
  children,
  fallback = null,
}: {
  workspaceId: string
  feature: FeatureKey
  children: ReactNode
  fallback?: ReactNode
}) {
  const { enabled, isLoading } = useFeature(workspaceId, feature)
  if (isLoading) return null
  return enabled ? children : fallback
}

/** Aviso padrão para páginas inteiras de uma feature desligada. */
export function FeatureUnavailable({ title }: { title: string }) {
  return (
    <div className='mx-auto flex max-w-md flex-col items-center gap-1 rounded-lg border border-dashed p-8 text-center'>
      <p className='font-medium text-sm'>{title} não está disponível</p>
      <p className='text-muted-foreground text-sm'>
        Esta funcionalidade não está liberada para este workspace. Fale com a
        Stratus Telecom para ativá-la.
      </p>
    </div>
  )
}
