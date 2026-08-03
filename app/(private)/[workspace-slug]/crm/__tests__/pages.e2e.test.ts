import { describe, expect, it } from 'vitest'
import { authenticatedOwner, defaultHeaders } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

// Renders every CRM sidebar section end-to-end against a real `next start`
// build, asserting a 200 (not a Next.js error boundary / 500) — this project
// doesn't otherwise test page-level SSR rendering, only API routes, so this
// is the only guard against a broken import/prop wiring in a page.tsx.
const SEGMENTS = [
  'leads',
  'opportunities',
  'companies',
  'people',
  'pipelines',
  'products',
  'forecast',
  'tasks',
  'tasks/calendar',
  'notes',
  'proposals',
  'forms',
  'custom-fields',
  'email-templates',
  'email-campaigns',
  'mailing-lists',
  'landing-pages',
  'workflows',
  'social',
  'email-sync',
  'reports',
  'dashboards',
  'settings',
  'integration-keys',
]

describe('CRM sidebar pages', () => {
  it('should redirect /crm to the Leads page', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await fetch(`${BASE_URL}/${workspace.slug}/crm`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })

  it.each(
    SEGMENTS,
  )('should render /crm/%s without a server error', async (segment) => {
    const { user, workspace } = await authenticatedOwner()

    const res = await fetch(`${BASE_URL}/${workspace.slug}/crm/${segment}`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
      redirect: 'manual',
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })
})
