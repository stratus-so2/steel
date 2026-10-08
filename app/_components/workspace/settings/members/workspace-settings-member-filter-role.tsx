'use client'

import { DataTableFacetedFilter } from '@/components/ui/data-table/data-table-faceted-filter'
import { MemberRoleFilterValues } from '@/src/schemas/member.schema'
import { MEMBER_ROLE_LABEL } from './member-roles'

const ROLE_OPTIONS = MemberRoleFilterValues.map((value) => ({
  value,
  label: MEMBER_ROLE_LABEL[value],
}))

interface WorkspaceSettingsMemberFilterRoleProps {
  selected: string[]
  onChange: (values: string[]) => void
}

export function WorkspaceSettingsMemberFilterRole({
  selected,
  onChange,
}: WorkspaceSettingsMemberFilterRoleProps) {
  return (
    <DataTableFacetedFilter
      title='Cargos'
      options={ROLE_OPTIONS}
      selected={selected}
      onChange={onChange}
    />
  )
}
