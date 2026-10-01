import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhaseFlow,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  defaultHeaders,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

/** Base das rotas de um chamado. */
export const tabApi = (ws: string, ticketId: string) =>
  `/api/workspaces/${ws}/servicedesk/tickets/${ticketId}`

/** PNG 1×1 transparente. */
export const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
export const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`

/**
 * Workspace com fluxo de incidente, um agente (o OWNER, também em um
 * departamento), um solicitante (MEMBER sem departamento) com um chamado
 * dele e um segundo chamado sem vínculo com o solicitante.
 */
export async function setupTabs() {
  const { user: agent, workspace } = await authenticatedOwner()
  const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  const department = await seedSdDepartment(workspace.id)
  await seedSdDepartmentMember(department.id, agent.id)
  const requester = await addMember(workspace.id)
  const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
    title: 'Impressora não imprime',
    description: '<p>Papel atolado no andar 3</p>',
    requesterId: requester.id,
    createdById: requester.id,
    channel: 'PORTAL',
  })
  const other = await seedSdTicket(workspace.id, flow.initial.id, {
    title: 'Chamado de outra pessoa',
  })
  return { agent, requester, workspace, flow, ticket, other }
}

/** Upload multipart de um anexo (campo `file`). */
export async function uploadFile(
  path: string,
  cookie: string,
  file: { name: string; type: string; content: BlobPart },
) {
  const form = new FormData()
  form.append('file', new Blob([file.content], { type: file.type }), file.name)
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Origin: defaultHeaders.Origin, Cookie: cookie },
    body: form,
  })
}
