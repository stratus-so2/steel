import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { hasModuleAccess } from '@/src/lib/module-access-guard'

export default async function ServiceDeskLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  if (!(await hasModuleAccess(slug, 'SERVICE_DESK'))) notFound()

  return children
}
