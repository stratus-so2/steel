import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crmCreateCompanyTool,
  crmCreatePersonTool,
  crmDeleteCompanyTool,
  crmDeletePersonTool,
  crmListCompaniesTool,
  crmListPeopleTool,
  crmUpdateCompanyTool,
  crmUpdatePersonTool,
} from '@/src/lib/ai/tools/crm/contacts'
import { err, ok } from '@/src/lib/result'
import { CrmCompanyService } from '@/src/services/crm-company.service'
import { CrmPersonService } from '@/src/services/crm-person.service'
import {
  company,
  dbErr,
  expectErr,
  expectOk,
  forbiddenErr,
  ME,
  person,
  previewOf,
  run,
  WS,
  wireDefaults,
} from './ai-tools-crm.fixtures'

vi.mock('@/src/services/workspace.service', () => ({
  WorkspaceService: { getById: vi.fn() },
}))
vi.mock('@/src/services/crm-member.service', () => ({
  CrmMemberService: { list: vi.fn() },
}))
vi.mock('@/src/services/crm-pipeline.service', () => ({
  CrmPipelineService: { list: vi.fn() },
  CrmPipelineStageService: { list: vi.fn() },
}))
vi.mock('@/src/services/crm-company.service', () => ({
  CrmCompanyService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/src/services/crm-person.service', () => ({
  CrmPersonService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const people = vi.mocked(CrmPersonService)
const companies = vi.mocked(CrmCompanyService)

type Page = { total: number; items: Array<Record<string, unknown>> }

beforeEach(() => {
  wireDefaults()
  companies.list.mockResolvedValue(
    ok([
      company(),
      company({
        id: 'company_2',
        name: 'Beta SA',
        domain: 'beta.com',
        cnpj: '12.345.678/0001-90',
        icp: false,
        accountOwnerId: 'user_bruno',
      }),
    ]),
  )
  companies.getById.mockResolvedValue(ok(company()))
})

describe('crm_list_people', () => {
  beforeEach(() => {
    people.list.mockResolvedValue(
      ok([
        person(),
        person({
          id: 'person_2',
          name: 'Eduardo',
          emails: [],
          phones: ['11 98888-7777'],
          city: 'Recife',
        }),
      ]),
    )
  })

  it('lists people with links and filters by query and city', async () => {
    const all = expectOk(await run(crmListPeopleTool, {}))
    expect((all.data as Page).items[0]).toMatchObject({
      id: 'person_1',
      href: '/acme/crm/people?record=person_1',
    })
    expect(all.summary).toBe('2 pessoa(s) encontrada(s)')

    const byPhone = expectOk(await run(crmListPeopleTool, { query: '98888' }))
    expect((byPhone.data as Page).items.map((i) => i.id)).toEqual(['person_2'])
    const byCity = expectOk(await run(crmListPeopleTool, { city: 'recife' }))
    expect((byCity.data as Page).total).toBe(1)
  })

  it('resolves the company filter', async () => {
    expectOk(await run(crmListPeopleTool, { company: 'beta.com' }))
    expect(people.list).toHaveBeenCalledWith(ME, WS, { companyId: 'company_2' })
  })

  it('maps company and service errors', async () => {
    expectErr(
      await run(crmListPeopleTool, { company: 'Zeta' }),
      'RESOURCE_NOT_FOUND',
    )
    people.list.mockResolvedValue(err(forbiddenErr))
    expectErr(await run(crmListPeopleTool, {}), 'FORBIDDEN')
  })
})

describe('crm_create_person', () => {
  it('validates e-mails', () => {
    expectErr(
      crmCreatePersonTool.parse({ name: 'X', emails: ['nope'] }),
      'VALIDATION_ERROR',
    )
  })

  it('previews with the company name and creates with its id', async () => {
    const args = { name: 'Fábio', emails: ['f@x.com'], company: 'Beta' }
    const preview = expectOk(await previewOf(crmCreatePersonTool, args))
    expect(preview.fields).toEqual(
      expect.arrayContaining([{ label: 'Empresa', after: 'Beta SA' }]),
    )
    expect(people.create).not.toHaveBeenCalled()

    people.create.mockResolvedValue(
      ok(person({ id: 'person_new', name: 'Fábio' })),
    )
    const out = expectOk(await run(crmCreatePersonTool, args))
    expect(people.create).toHaveBeenCalledWith(ME, WS, {
      name: 'Fábio',
      emails: ['f@x.com'],
      phones: [],
      companyId: 'company_2',
    })
    expect(out.target?.href).toBe('/acme/crm/people?record=person_new')
  })

  it('creates without company and maps errors', async () => {
    people.create.mockResolvedValue(ok(person()))
    expectOk(await run(crmCreatePersonTool, { name: 'Sem empresa' }))
    expect(people.create).toHaveBeenCalledWith(
      ME,
      WS,
      expect.objectContaining({ companyId: undefined }),
    )
    expectErr(
      await previewOf(crmCreatePersonTool, { name: 'X', company: 'Zeta' }),
      'RESOURCE_NOT_FOUND',
    )
    expectErr(
      await run(crmCreatePersonTool, { name: 'X', company: 'Zeta' }),
      'RESOURCE_NOT_FOUND',
    )
    people.create.mockResolvedValue(err(dbErr))
    expectErr(await run(crmCreatePersonTool, { name: 'X' }), 'DATABASE_ERROR')
  })
})

describe('crm_update_person', () => {
  beforeEach(() => {
    people.getById.mockResolvedValue(
      ok(person({ companyId: 'company_1', city: 'Campinas' })),
    )
  })

  it('requires a change', () => {
    expectErr(
      crmUpdatePersonTool.parse({ personId: 'person_1' }),
      'VALIDATION_ERROR',
    )
  })

  it('previews before → after, including the company change', async () => {
    const preview = expectOk(
      await previewOf(crmUpdatePersonTool, {
        personId: 'person_1',
        city: null,
        company: 'Beta',
      }),
    )
    expect(preview.fields).toEqual([
      { label: 'Cidade', before: 'Campinas', after: null },
      { label: 'Empresa', before: 'Acme Ltda', after: 'Beta SA' },
    ])

    const unlink = expectOk(
      await previewOf(crmUpdatePersonTool, {
        personId: 'person_1',
        company: null,
      }),
    )
    expect(unlink.fields).toEqual([
      { label: 'Empresa', before: 'Acme Ltda', after: null },
    ])
  })

  it('refuses a no-op and maps errors', async () => {
    expectErr(
      await previewOf(crmUpdatePersonTool, {
        personId: 'person_1',
        city: 'Campinas',
      }),
      'VALIDATION_ERROR',
    )
    expectErr(
      await previewOf(crmUpdatePersonTool, {
        personId: 'person_1',
        company: 'Zeta',
      }),
      'RESOURCE_NOT_FOUND',
    )
    people.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmUpdatePersonTool, { personId: 'person_1', city: 'X' }),
      'FORBIDDEN',
    )
  })

  it('executes with the company id (or null to unlink)', async () => {
    people.update.mockResolvedValue(ok(person()))
    expectOk(
      await run(crmUpdatePersonTool, { personId: 'person_1', company: null }),
    )
    expect(people.update).toHaveBeenLastCalledWith(ME, WS, 'person_1', {
      companyId: null,
    })
    expectOk(
      await run(crmUpdatePersonTool, { personId: 'person_1', jobTitle: 'CEO' }),
    )
    expect(people.update).toHaveBeenLastCalledWith(ME, WS, 'person_1', {
      jobTitle: 'CEO',
      companyId: undefined,
    })
    expectOk(
      await run(crmUpdatePersonTool, { personId: 'person_1', company: 'Beta' }),
    )
    expect(people.update).toHaveBeenLastCalledWith(ME, WS, 'person_1', {
      companyId: 'company_2',
    })
  })

  it('maps execute errors', async () => {
    expectErr(
      await run(crmUpdatePersonTool, { personId: 'person_1', company: 'Zeta' }),
      'RESOURCE_NOT_FOUND',
    )
    people.update.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmUpdatePersonTool, { personId: 'person_1', city: 'X' }),
      'DATABASE_ERROR',
    )
  })
})

describe('crm_delete_person', () => {
  it('previews, deletes and maps errors', async () => {
    people.getById.mockResolvedValue(ok(person()))
    const preview = expectOk(
      await previewOf(crmDeletePersonTool, { personId: 'person_1' }),
    )
    expect(preview.title).toBe('Excluir a pessoa “Daniela Rocha”')
    people.remove.mockResolvedValue(ok(undefined))
    expect(
      expectOk(await run(crmDeletePersonTool, { personId: 'person_1' })).data,
    ).toEqual({ id: 'person_1', deleted: true })
    people.remove.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmDeletePersonTool, { personId: 'person_1' }),
      'DATABASE_ERROR',
    )
    people.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmDeletePersonTool, { personId: 'person_1' }),
      'FORBIDDEN',
    )
    expectErr(
      await run(crmDeletePersonTool, { personId: 'person_1' }),
      'FORBIDDEN',
    )
  })
})

describe('crm_list_companies', () => {
  it('lists with owner names and filters', async () => {
    const all = expectOk(await run(crmListCompaniesTool, {}))
    expect((all.data as Page).items[1]).toMatchObject({
      accountOwnerName: 'Bruno Lima',
      href: '/acme/crm/companies?record=company_2',
    })
    expect((all.data as Page).items[0]).toMatchObject({
      city: 'Campinas',
      accountOwnerName: null,
    })

    const byCnpj = expectOk(
      await run(crmListCompaniesTool, { query: '12.345' }),
    )
    expect((byCnpj.data as Page).total).toBe(1)
    const byOwner = expectOk(
      await run(crmListCompaniesTool, { owner: 'Bruno Lima' }),
    )
    expect((byOwner.data as Page).items.map((i) => i.id)).toEqual(['company_2'])

    await run(crmListCompaniesTool, { icp: true })
    expect(companies.list).toHaveBeenLastCalledWith(ME, WS, { icp: true })
  })

  it('maps owner and service errors', async () => {
    expectErr(
      await run(crmListCompaniesTool, { owner: 'Zé' }),
      'RESOURCE_NOT_FOUND',
    )
    companies.list.mockResolvedValue(err(forbiddenErr))
    expectErr(await run(crmListCompaniesTool, {}), 'FORBIDDEN')
  })
})

describe('crm_create_company', () => {
  it('previews and creates', async () => {
    const preview = expectOk(
      await previewOf(crmCreateCompanyTool, {
        name: 'Nova',
        arr: 1000,
        icp: true,
        employees: 10,
      }),
    )
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        { label: 'ICP', after: 'Sim' },
        { label: 'Funcionários', after: '10' },
      ]),
    )
    companies.create.mockResolvedValue(
      ok(company({ id: 'c_new', name: 'Nova' })),
    )
    const out = expectOk(await run(crmCreateCompanyTool, { name: 'Nova' }))
    expect(companies.create).toHaveBeenCalledWith(ME, WS, {
      name: 'Nova',
      icp: false,
    })
    expect(out.target?.href).toBe('/acme/crm/companies?record=c_new')
    companies.create.mockResolvedValue(err(dbErr))
    expectErr(await run(crmCreateCompanyTool, { name: 'X' }), 'DATABASE_ERROR')
  })
})

describe('crm_update_company', () => {
  it('previews only real changes and refuses a no-op', async () => {
    const preview = expectOk(
      await previewOf(crmUpdateCompanyTool, {
        companyId: 'company_1',
        icp: false,
        arr: null,
        domain: 'acme.com',
      }),
    )
    expect(preview.fields).toEqual([
      {
        label: 'ARR',
        before: expect.stringContaining('120.000,00'),
        after: null,
      },
      { label: 'ICP', before: 'Sim', after: 'Não' },
    ])
    expectErr(
      await previewOf(crmUpdateCompanyTool, {
        companyId: 'company_1',
        domain: 'acme.com',
      }),
      'VALIDATION_ERROR',
    )
    expectErr(
      crmUpdateCompanyTool.parse({ companyId: 'company_1' }),
      'VALIDATION_ERROR',
    )
    companies.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmUpdateCompanyTool, {
        companyId: 'company_1',
        icp: false,
      }),
      'FORBIDDEN',
    )
  })

  it('executes and maps errors', async () => {
    companies.update.mockResolvedValue(ok(company({ arr: 5 })))
    expectOk(
      await run(crmUpdateCompanyTool, { companyId: 'company_1', arr: 5 }),
    )
    expect(companies.update).toHaveBeenCalledWith(ME, WS, 'company_1', {
      arr: 5,
      address: undefined,
    })
    companies.update.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmUpdateCompanyTool, { companyId: 'company_1', arr: 5 }),
      'DATABASE_ERROR',
    )
  })
})

describe('crm_delete_company', () => {
  it('previews, deletes and maps errors', async () => {
    const preview = expectOk(
      await previewOf(crmDeleteCompanyTool, { companyId: 'company_1' }),
    )
    expect(preview.fields).toEqual([{ label: 'Domínio', after: 'acme.com' }])
    companies.remove.mockResolvedValue(ok(undefined))
    expect(
      expectOk(await run(crmDeleteCompanyTool, { companyId: 'company_1' }))
        .data,
    ).toEqual({ id: 'company_1', deleted: true })
    companies.remove.mockResolvedValue(err(dbErr))
    expectErr(
      await run(crmDeleteCompanyTool, { companyId: 'company_1' }),
      'DATABASE_ERROR',
    )
    companies.getById.mockResolvedValue(err(forbiddenErr))
    expectErr(
      await previewOf(crmDeleteCompanyTool, { companyId: 'company_1' }),
      'FORBIDDEN',
    )
    expectErr(
      await run(crmDeleteCompanyTool, { companyId: 'company_1' }),
      'FORBIDDEN',
    )
  })
})
