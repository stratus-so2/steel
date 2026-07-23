import type { CrmLeadRuleField, CrmLeadRuleOperator } from '@prisma/client'

export interface LeadRuleSubject {
  name: string
  emails: string[]
  phones: string[]
  company: string | null
  jobTitle: string | null
  source: string | null
  city: string | null
}

interface LeadRule {
  field: CrmLeadRuleField
  operator: CrmLeadRuleOperator
  value: string | null
}

function fieldValue(subject: LeadRuleSubject, field: CrmLeadRuleField): string {
  switch (field) {
    case 'name':
      return subject.name
    case 'email':
      return subject.emails[0] ?? ''
    case 'phone':
      return subject.phones[0] ?? ''
    case 'company':
      return subject.company ?? ''
    case 'jobTitle':
      return subject.jobTitle ?? ''
    case 'source':
      return subject.source ?? ''
    case 'city':
      return subject.city ?? ''
  }
}

export function matchesLeadRule(
  subject: LeadRuleSubject,
  rule: LeadRule,
): boolean {
  const actual = fieldValue(subject, rule.field)

  switch (rule.operator) {
    case 'equals':
      return actual === (rule.value ?? '')
    case 'not_equals':
      return actual !== (rule.value ?? '')
    case 'contains':
      return rule.value ? actual.includes(rule.value) : false
    case 'is_empty':
      return actual.trim().length === 0
    case 'is_not_empty':
      return actual.trim().length > 0
  }
}

export function computeLeadScore<
  T extends LeadRule & { points: number; active: boolean },
>(subject: LeadRuleSubject, rules: T[]): number {
  return rules
    .filter((rule) => rule.active && matchesLeadRule(subject, rule))
    .reduce((total, rule) => total + rule.points, 0)
}

export function findLeadRoutingOwner<
  T extends LeadRule & { ownerId: string; active: boolean },
>(subject: LeadRuleSubject, rules: T[]): string | null {
  const match = rules.find(
    (rule) => rule.active && matchesLeadRule(subject, rule),
  )
  return match?.ownerId ?? null
}
