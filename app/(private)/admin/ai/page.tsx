import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminAiSettingsPanel } from '@/app/_components/admin/ai/admin-ai-settings-panel'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import { ErrorState } from '@/app/_components/admin/shell/admin-ui'
import { getAuthSession } from '@/src/lib/auth-session'
import { PlatformAiSettingsService } from '@/src/services/platform-ai-settings.service'

export const metadata: Metadata = {
  title: 'Steel IA | Admin | Steel',
  description: 'Margem da plataforma sobre o preço real dos modelos de IA',
}

export default async function AdminAiPage() {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const result = await PlatformAiSettingsService.get(session.value.user.id)

  return (
    <AdminPage>
      <AdminPageHeader
        title='Steel IA'
        crumbs={[{ label: 'Steel IA' }]}
        description='Margem da plataforma sobre o preço real dos modelos de IA'
      />
      {result.ok ? (
        <AdminAiSettingsPanel initial={result.value} />
      ) : (
        <ErrorState message='Não foi possível carregar os ajustes de IA.' />
      )}
    </AdminPage>
  )
}
