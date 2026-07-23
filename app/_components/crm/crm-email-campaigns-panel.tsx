'use client'

import { Mail01Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useCreateCrmEmailCampaign,
  useCrmEmailCampaignRecipients,
  useCrmEmailCampaigns,
  useSendCrmEmailCampaign,
} from '@/src/hooks/use-crm-email-marketing'
import type { CrmCampaignStatusDTO } from '@/types/crm-email-marketing'

const STATUS_VARIANT: Record<
  CrmCampaignStatusDTO,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  SCHEDULED: 'secondary',
  SENDING: 'secondary',
  SENT: 'default',
  FAILED: 'destructive',
}

export function CrmEmailCampaignsPanel({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data: campaigns, isLoading } = useCrmEmailCampaigns(workspaceId)
  const sendCampaign = useSendCrmEmailCampaign(workspaceId)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  )

  async function handleSend(campaignId: string) {
    try {
      await sendCampaign.mutateAsync(campaignId)
      notify.success('Campanha enviada')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-end'>
        <CreateCrmEmailCampaignDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assunto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Escopo</TableHead>
            <TableHead className='w-40' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && campaigns?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhuma campanha de e-mail
              </TableCell>
            </TableRow>
          )}
          {campaigns?.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell>{campaign.subject}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[campaign.status]}>
                  {campaign.status}
                </Badge>
              </TableCell>
              <TableCell>{campaign.recipientScope}</TableCell>
              <TableCell className='flex items-center justify-end gap-1'>
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() =>
                    setSelectedCampaignId(
                      selectedCampaignId === campaign.id ? null : campaign.id,
                    )
                  }
                >
                  Destinatários
                </Button>
                {(campaign.status === 'DRAFT' ||
                  campaign.status === 'SCHEDULED') && (
                  <Button
                    variant='default'
                    size='xs'
                    onClick={() => handleSend(campaign.id)}
                    disabled={sendCampaign.isPending}
                  >
                    <SteelIcon icon={Mail01Icon} strokeWidth={2} />
                    Enviar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {selectedCampaignId && (
        <CrmEmailCampaignRecipientsPanel
          workspaceId={workspaceId}
          campaignId={selectedCampaignId}
        />
      )}
    </div>
  )
}

function CrmEmailCampaignRecipientsPanel({
  workspaceId,
  campaignId,
}: {
  workspaceId: string
  campaignId: string
}) {
  const { data: recipients, isLoading } = useCrmEmailCampaignRecipients(
    workspaceId,
    campaignId,
  )

  return (
    <div className='rounded-md border p-3'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-mail</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && recipients?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={2}
                className='text-center text-muted-foreground'
              >
                Nenhum destinatário
              </TableCell>
            </TableRow>
          )}
          {recipients?.map((recipient) => (
            <TableRow key={recipient.id}>
              <TableCell>{recipient.email}</TableCell>
              <TableCell>{recipient.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateCrmEmailCampaignDialog({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const createCampaign = useCreateCrmEmailCampaign(workspaceId)

  function handleClose() {
    setOpen(false)
    setSubject('')
    setContentHtml('')
    setFromAddress('')
    createCampaign.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createCampaign.mutateAsync({
        subject,
        contentHtml,
        fromAddress,
        recipientScope: 'ALL',
      })
      notify.success('Campanha criada')
      handleClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          <Button variant='default' size='xs'>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova campanha
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Assunto'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Input
                placeholder='Remetente (e-mail)'
                type='email'
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Textarea
                placeholder='Conteúdo (HTML)'
                value={contentHtml}
                onChange={(e) => setContentHtml(e.target.value)}
                rows={8}
                required
              />
            </Field>
          </FieldGroup>
          <p className='text-muted-foreground text-xs'>
            Esta campanha será enviada para todas as pessoas com e-mail
            cadastrado no workspace.
          </p>
          <div className='flex justify-end gap-2'>
            <DialogClose
              render={
                <Button
                  variant='outline'
                  size='sm'
                  type='button'
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
              }
            />
            <Button
              size='sm'
              type='submit'
              disabled={
                createCampaign.isPending ||
                !subject ||
                !contentHtml ||
                !fromAddress
              }
            >
              {createCampaign.isPending ? 'Criando...' : 'Criar campanha'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
