'use client'

import { useCallback, useEffect, useState } from 'react'
import { Muted } from '@/components/typography/text/muted'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import { setMemberProfile, useProfiles } from '@/src/hooks/use-profile'
import type { WorkspaceMemberDTO } from '@/types/membership'

type ApiResponse<T> = { success: boolean; data?: T; message?: string }

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
}

export function CrmMembersSection({
  workspaceId,
  basePath = '/api/workspaces',
}: {
  workspaceId: string
  basePath?: string
}) {
  const [members, setMembers] = useState<WorkspaceMemberDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { profiles } = useProfiles(workspaceId, basePath)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${basePath}/${workspaceId}/members`)
      const json: ApiResponse<WorkspaceMemberDTO[]> = await res.json()
      if (json.success && json.data) setMembers(json.data)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, basePath])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function handleProfileChange(userId: string, profileId: string) {
    const nextId = profileId === '__none__' ? null : profileId
    const result = await setMemberProfile(workspaceId, userId, nextId, basePath)
    if (!result.ok) {
      notify.error(result.message ?? 'Não foi possível atualizar o perfil.')
      return
    }
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, profileId: nextId } : m)),
    )
  }

  if (isLoading) return <Muted>Carregando membros...</Muted>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Membro</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Perfil de acesso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.userId}>
            <TableCell>
              <div>
                <p className='font-medium text-sm'>{member.name}</p>
                <p className='text-muted-foreground text-xs'>{member.email}</p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant='secondary'>
                {ROLE_LABEL[member.role] ?? member.role}
              </Badge>
            </TableCell>
            <TableCell>
              <Select
                value={member.profileId ?? '__none__'}
                onValueChange={(value) =>
                  value && handleProfileChange(member.userId, value)
                }
              >
                <SelectTrigger className='w-48'>
                  <SelectValue placeholder='Padrão do papel' />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value='__none__'>Padrão do papel</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
