'use client'

import * as React from 'react'

/**
 * Como os widgets do dashboard são exibidos. `tv` = modo TV (tela cheia,
 * alto contraste, números enormes). `refreshKey` muda a cada atualização
 * automática: os widgets refazem a busca sem piscar (mantêm o dado anterior
 * enquanto carregam).
 */
export interface DashboardDisplay {
  variant: 'default' | 'tv'
  refreshKey: number
}

const DashboardDisplayContext = React.createContext<DashboardDisplay>({
  variant: 'default',
  refreshKey: 0,
})

export function DashboardDisplayProvider({
  variant = 'default',
  refreshKey = 0,
  children,
}: Partial<DashboardDisplay> & { children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ variant, refreshKey }),
    [variant, refreshKey],
  )
  return (
    <DashboardDisplayContext.Provider value={value}>
      {children}
    </DashboardDisplayContext.Provider>
  )
}

export function useDashboardDisplay(): DashboardDisplay {
  return React.useContext(DashboardDisplayContext)
}
