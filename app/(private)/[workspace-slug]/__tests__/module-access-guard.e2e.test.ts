import { describe, expect, it } from 'vitest'
import { authenticatedOwner, defaultHeaders } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const SEGMENTS = [
  { path: 'crm', module: 'CRM' as const },
  { path: 'zap', module: 'COMMUNICATION' as const },
  { path: 'servicedesk', module: 'SERVICE_DESK' as const },
]

// Este app usa streaming/Cache Components: o cabeçalho já sai como 200 antes
// de `notFound()` disparar mais fundo na árvore, então o status HTTP não
// muda — nem o `notFound()` já existente no layout pai para não-membro
// produz 404 real para um cliente que não executa JS. O sinal confiável é o
// marcador RSC que o React usa para trocar a árvore no cliente, e a ausência
// do conteúdo normal da página (mesmo padrão do teste de páginas do CRM).
describe('module access guard', () => {
  it.each(
    SEGMENTS,
  )('should not render /$path content when the module is disabled for the workspace', async ({
    path,
    module,
  }) => {
    const { user, workspace } = await authenticatedOwner()
    await prisma.workspaceModuleAccess.update({
      where: { workspaceId_module: { workspaceId: workspace.id, module } },
      data: { enabled: false },
    })

    const res = await fetch(`${BASE_URL}/${workspace.slug}/${path}`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('NEXT_HTTP_ERROR_FALLBACK;404')
  })

  it.each(
    SEGMENTS,
  )('should allow /$path when the module is enabled (default for new workspaces)', async ({
    path,
  }) => {
    const { user, workspace } = await authenticatedOwner()

    const res = await fetch(`${BASE_URL}/${workspace.slug}/${path}`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(html).not.toContain('Application error')
  })
})
