import type { CrmCompany } from '@prisma/client'
import type { CrmCompanyAddress, CrmCompanyDTO } from '@/types/crm-company'

export function toCrmCompanyDTO(company: CrmCompany): CrmCompanyDTO {
  return {
    id: company.id,
    name: company.name,
    cnpj: company.cnpj,
    domain: company.domain,
    employees: company.employees,
    linkedin: company.linkedin,
    address: (company.address as CrmCompanyAddress | null) ?? null,
    arr: company.arr ? Number(company.arr) : null,
    icp: company.icp,
    workspaceId: company.workspaceId,
    createdById: company.createdById,
    accountOwnerId: company.accountOwnerId,
    updatedById: company.updatedById,
    position: company.position,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  }
}
