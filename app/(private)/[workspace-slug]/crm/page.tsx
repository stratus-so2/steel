import { redirect } from 'next/navigation'

export default async function CrmPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  redirect(`/${slug}/crm/leads`)
}
