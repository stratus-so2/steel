import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/customers`

describe('GET /api/workspaces/[id]/servicedesk/customers', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${base('some-id')}`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-member and SD_NOT_AGENT for a requester', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    expect((await getJson(base(workspace.id), stranger.cookie)).status).toBe(
      403,
    )

    const requester = await addMember(workspace.id, 'MEMBER')
    const res = await getJson(base(workspace.id), requester.cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('returns 422 for invalid query params', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await getJson(`${base(workspace.id)}?pageSize=999`, user.cookie)
    expect(res.status).toBe(422)
  })
})

describe('customers CRUD', () => {
  it('creates, lists, searches, reads, updates and deletes', async () => {
    const { user, workspace } = await authenticatedOwner()
    // Campo customizado precisa existir: o service valida os valores contra
    // as definições da entidade (chave sem definição é recusada).
    await prisma.sdCustomFieldDefinition.create({
      data: {
        workspaceId: workspace.id,
        entity: 'CUSTOMER',
        key: 'segmento',
        label: 'Segmento',
        type: 'TEXT',
      },
    })

    const unknownField = await postJson(
      base(workspace.id),
      { name: 'Sem definição', customFields: { inexistente: 'x' } },
      user.cookie,
    )
    expect(unknownField.status).toBe(422)
    expect((await unknownField.json()).error.code).toBe(
      'SD_CUSTOM_FIELD_INVALID',
    )

    const created = await postJson(
      base(workspace.id),
      {
        kind: 'COMPANY',
        name: 'Acme Ltda',
        document: '11.222.333/0001-81',
        whatsapp: '(11) 98765-4321',
        zipCode: '01001-000',
        state: 'sp',
        customFields: { segmento: 'varejo' },
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const customer = (await created.json()).data
    expect(customer).toMatchObject({
      kind: 'COMPANY',
      personType: 'LEGAL',
      document: '11222333000181',
      whatsapp: '5511987654321',
      zipCode: '01001000',
      state: 'SP',
      contactsCount: 0,
    })

    const duplicate = await postJson(
      base(workspace.id),
      { name: 'Outra', document: '11222333000181' },
      user.cookie,
    )
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json()).error.code).toBe(
      'SD_CUSTOMER_DOCUMENT_CONFLICT',
    )

    const invalid = await postJson(
      base(workspace.id),
      { name: 'Inválida', document: '11.222.333/0001-00' },
      user.cookie,
    )
    expect(invalid.status).toBe(422)
    expect((await invalid.json()).error.code).toBe('SD_DOCUMENT_INVALID')

    const listed = await getJson(
      `${base(workspace.id)}?kind=COMPANY&q=11.222.333`,
      user.cookie,
    )
    expect(listed.status).toBe(200)
    const page = (await listed.json()).data
    expect(page.total).toBe(1)
    expect(page.items[0].id).toBe(customer.id)

    const options = await getJson(
      `${base(workspace.id)}/options?q=acme&kind=COMPANY`,
      user.cookie,
    )
    expect((await options.json()).data).toEqual([
      {
        id: customer.id,
        label: 'Acme Ltda',
        sublabel: '11.222.333/0001-81 · SP',
      },
    ])

    const detail = await getJson(
      `${base(workspace.id)}/${customer.id}`,
      user.cookie,
    )
    expect(detail.status).toBe(200)
    expect((await detail.json()).data).toMatchObject({
      id: customer.id,
      contacts: [],
      recentTickets: [],
    })

    const updated = await patchJson(
      `${base(workspace.id)}/${customer.id}`,
      { tradeName: 'Acme', active: false },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    expect((await updated.json()).data).toMatchObject({
      tradeName: 'Acme',
      active: false,
    })

    const deleted = await deleteJson(
      `${base(workspace.id)}/${customer.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)

    const gone = await getJson(
      `${base(workspace.id)}/${customer.id}`,
      user.cookie,
    )
    expect(gone.status).toBe(404)
    expect((await gone.json()).error.code).toBe('SD_CUSTOMER_NOT_FOUND')
  })

  it('returns 422 for an invalid body', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await postJson(base(workspace.id), { name: '' }, user.cookie)
    expect(res.status).toBe(422)
  })
})

describe('POST /api/workspaces/[id]/servicedesk/{customers,contacts}/import', () => {
  it('imports customers and contacts from spreadsheet rows', async () => {
    const { user, workspace } = await authenticatedOwner()
    const customers = await postJson(
      `${base(workspace.id)}/import`,
      {
        kind: 'COMPANY',
        rows: [
          { razao_social: 'Acme', cnpj: '11.222.333/0001-81' },
          { razao_social: 'Sem CNPJ válido', cnpj: '1' },
        ],
      },
      user.cookie,
    )
    expect(customers.status).toBe(200)
    expect((await customers.json()).data).toEqual({
      created: 1,
      rejected: [
        {
          line: 3,
          message: 'Informe um CPF (11 dígitos) ou CNPJ (14 caracteres)',
        },
      ],
    })

    const contacts = await postJson(
      `/api/workspaces/${workspace.id}/servicedesk/contacts/import`,
      { rows: [{ nome: 'Ana', documento_cliente: '11222333000181' }] },
      user.cookie,
    )
    expect((await contacts.json()).data).toEqual({ created: 1, rejected: [] })

    const listed = await getJson(
      `/api/workspaces/${workspace.id}/servicedesk/contacts?q=ana`,
      user.cookie,
    )
    const [ana] = (await listed.json()).data.items
    expect(ana.customers[0]).toMatchObject({ name: 'Acme', isPrimary: true })
  })

  it('rejects an empty import with 422', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await postJson(
      `${base(workspace.id)}/import`,
      { kind: 'CLIENT', rows: [] },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })
})

describe('GET /api/workspaces/[id]/servicedesk/cep/[cep]', () => {
  it('rejects a malformed CEP without calling ViaCEP', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/servicedesk/cep/123`,
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('returns 403 for a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/servicedesk/cep/01001000`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})
