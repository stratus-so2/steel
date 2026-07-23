import type {
  CrmLeadRoutingRule,
  CrmLeadRuleField,
  CrmLeadRuleOperator,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmLeadRoutingRuleRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmLeadRoutingRule[]>> {
    try {
      const rules = await prisma.crmLeadRoutingRule.findMany({
        where: { workspaceId },
        orderBy: { position: 'asc' },
      })
      return ok(rules)
    } catch (error) {
      return err(dbError('Failed to list CRM lead routing rules', error))
    }
  },

  async listActiveByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmLeadRoutingRule[]>> {
    try {
      const rules = await prisma.crmLeadRoutingRule.findMany({
        where: { workspaceId, active: true },
        orderBy: { position: 'asc' },
      })
      return ok(rules)
    } catch (error) {
      return err(dbError('Failed to list active CRM lead routing rules', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmLeadRoutingRule>> {
    try {
      const rule = await prisma.crmLeadRoutingRule.findFirst({
        where: { id, workspaceId },
      })
      if (!rule) return err(notFound('CrmLeadRoutingRule'))
      return ok(rule)
    } catch (error) {
      return err(dbError('Failed to find CRM lead routing rule by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    field: CrmLeadRuleField
    operator: CrmLeadRuleOperator
    value?: string
    ownerId: string
    active?: boolean
  }): Promise<Result<CrmLeadRoutingRule>> {
    try {
      const position = await prisma.crmLeadRoutingRule.count({
        where: { workspaceId: data.workspaceId },
      })
      const rule = await prisma.crmLeadRoutingRule.create({
        data: { ...data, position },
      })
      return ok(rule)
    } catch (error) {
      return err(dbError('Failed to create CRM lead routing rule', error))
    }
  },

  async update(
    id: string,
    data: {
      field?: CrmLeadRuleField
      operator?: CrmLeadRuleOperator
      value?: string
      ownerId?: string
      active?: boolean
    },
  ): Promise<Result<CrmLeadRoutingRule>> {
    try {
      const rule = await prisma.crmLeadRoutingRule.update({
        where: { id },
        data,
      })
      return ok(rule)
    } catch (error) {
      return err(dbError('Failed to update CRM lead routing rule', error))
    }
  },

  async delete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmLeadRoutingRule.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM lead routing rule', error))
    }
  },
}
