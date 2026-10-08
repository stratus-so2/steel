'use client'

import {
  Delete02Icon,
  MoreHorizontalIcon,
  UserSwitchIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { memberRoleLabel } from '@/app/_components/workspace/settings/members/member-roles'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { notify } from '@/lib/notify'
import { useRemoveMember, useUpdateMemberRole } from '@/src/hooks/use-member'
import { InvitableRoleValues } from '@/src/schemas/invitation.schema'
import type { MemberDTO, MemberRole } from '@/types/member'

export function MemberRowActions({
  workspaceId,
  member,
}: {
  workspaceId: string
  member: MemberDTO
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const updateRole = useUpdateMemberRole(workspaceId)
  const removeMember = useRemoveMember(workspaceId)

  function handleRoleChange(value: unknown) {
    const role = value as MemberRole
    if (role === member.role) return
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () =>
          notify.success(
            `${member.name} agora é ${memberRoleLabel(role).toLowerCase()}`,
          ),
        onError: (error) =>
          notify.error(error, 'Não foi possível alterar o cargo'),
      },
    )
  }

  function handleRemove() {
    removeMember.mutate(member.userId, {
      onSuccess: () => {
        notify.success(`${member.name} foi removido do workspace`)
        setConfirmOpen(false)
      },
      onError: (error) =>
        notify.error(error, 'Não foi possível remover o membro'),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={`Ações de ${member.name}`}
            />
          }
        >
          <SteelIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-48'>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SteelIcon icon={UserSwitchIcon} strokeWidth={2} />
              Alterar cargo
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={member.role}
                onValueChange={handleRoleChange}
              >
                {InvitableRoleValues.map((role) => (
                  <DropdownMenuRadioItem
                    key={role}
                    value={role}
                    disabled={updateRole.isPending}
                  >
                    {memberRoleLabel(role)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant='destructive'
            onClick={() => setConfirmOpen(true)}
          >
            <SteelIcon icon={Delete02Icon} strokeWidth={2} />
            Remover do workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.email} perde o acesso ao workspace e aos projetos dele.
              Para voltar, precisa de um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={removeMember.isPending}
              onClick={handleRemove}
            >
              {removeMember.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
