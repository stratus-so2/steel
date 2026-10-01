import { createId } from '@paralleldrive/cuid2'
import { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type {
  SdTicketApprovalWithRelations,
  SdTicketApprovalWithTicket,
} from '@/src/repositories/sd-ticket-approval.repository'
import type { SdTicketAttachmentWithRelations } from '@/src/repositories/sd-ticket-attachment.repository'
import type { SdTicketCostWithRelations } from '@/src/repositories/sd-ticket-cost.repository'
import type { SdTicketMessageWithRelations } from '@/src/repositories/sd-ticket-message.repository'
import type { SdTicketPartWithRelations } from '@/src/repositories/sd-ticket-part.repository'
import type { SdTicketSignatureWithRelations } from '@/src/repositories/sd-ticket-signature.repository'
import type { SdTicketTaskWithRelations } from '@/src/repositories/sd-ticket-task.repository'

/**
 * Fábricas das abas do chamado (histórico, anexos, tarefas, custos, peças,
 * aprovações e assinaturas): fakes para testes unitários e seeds no banco
 * para os de integração.
 */

const fixed = () => new Date('2026-09-21T12:00:00.000Z')

const author = () => ({
  id: 'u1',
  name: 'Ana Agente',
  email: 'ana@example.com',
  image: null,
})

/* ------------------------------ fakes (unit) ------------------------------ */

export function createFakeSdTicketAttachment(
  overrides?: Partial<SdTicketAttachmentWithRelations>,
): SdTicketAttachmentWithRelations {
  const id = overrides?.id ?? createId()
  return {
    id,
    workspaceId: 'ws1',
    ticketId: 't1',
    messageId: null,
    uploadedById: 'u1',
    kind: 'IMAGE',
    fileName: 'foto.png',
    mimeType: 'image/png',
    size: 1024,
    storageKey: `ws1/tickets/t1/${id}-foto.png`,
    createdAt: fixed(),
    deletedAt: null,
    uploadedBy: null,
    message: null,
    ...overrides,
  }
}

export function createFakeSdTicketMessage(
  overrides?: Partial<SdTicketMessageWithRelations>,
): SdTicketMessageWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    ticketId: 't1',
    authorKind: 'AGENT',
    authorUserId: 'u1',
    authorContactId: null,
    visibility: 'PUBLIC',
    channel: 'PLATFORM',
    body: 'Olá, estamos verificando.',
    whatsappMessageId: null,
    mentionedUserIds: [],
    editedAt: null,
    createdAt: fixed(),
    deletedAt: null,
    authorUser: null,
    authorContact: null,
    attachments: [],
    ...overrides,
  }
}

export function createFakeSdTicketTask(
  overrides?: Partial<SdTicketTaskWithRelations>,
): SdTicketTaskWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    ticketId: 't1',
    title: 'Trocar o cabo de rede',
    description: null,
    status: 'TODO',
    assigneeId: null,
    dueDate: null,
    completedAt: null,
    position: 0,
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    assignee: null,
    createdBy: author(),
    ...overrides,
  }
}

export function createFakeSdTicketCost(
  overrides?: Partial<SdTicketCostWithRelations>,
): SdTicketCostWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    ticketId: 't1',
    category: 'LABOR',
    description: 'Hora técnica',
    quantity: new Prisma.Decimal('2'),
    unitCost: new Prisma.Decimal('100'),
    billable: true,
    incurredAt: fixed(),
    userId: null,
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    user: null,
    createdBy: author(),
    ...overrides,
  }
}

export function createFakeSdTicketPart(
  overrides?: Partial<SdTicketPartWithRelations>,
): SdTicketPartWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    ticketId: 't1',
    partId: null,
    name: 'Fonte ATX 500W',
    sku: null,
    quantity: 1,
    unitCost: new Prisma.Decimal('250'),
    serialNumber: null,
    status: 'REQUESTED',
    notes: null,
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    part: null,
    createdBy: author(),
    ...overrides,
  }
}

export function createFakeSdTicketApproval(
  overrides?: Partial<SdTicketApprovalWithRelations>,
): SdTicketApprovalWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    ticketId: 't1',
    approverName: 'Carlos Gestor',
    approverEmail: 'gestor@example.com',
    approverUserId: null,
    tokenHash: createId(),
    status: 'PENDING',
    message: null,
    comment: null,
    requestedById: 'u1',
    roundId: null,
    sentAt: null,
    respondedAt: null,
    expiresAt: new Date('2026-09-28T12:00:00.000Z'),
    createdAt: fixed(),
    updatedAt: fixed(),
    approver: null,
    requestedBy: author(),
    ...overrides,
  }
}

export function createFakeSdTicketApprovalWithTicket(
  overrides?: Partial<SdTicketApprovalWithTicket>,
): SdTicketApprovalWithTicket {
  return {
    ...createFakeSdTicketApproval(),
    workspace: { id: 'ws1', name: 'Stratus', slug: 'stratus' },
    ticket: {
      id: 't1',
      workspaceId: 'ws1',
      number: 45,
      type: 'CHANGE',
      title: 'Atualização do firewall',
      description: '<p>Janela sábado</p>',
      assigneeId: null,
      requesterId: null,
      departmentId: null,
      deletedAt: null,
      phase: { name: 'Aguardando aprovação' },
      participants: [],
      contact: null,
    },
    ...overrides,
  }
}

export function createFakeSdTicketSignature(
  overrides?: Partial<SdTicketSignatureWithRelations>,
): SdTicketSignatureWithRelations {
  const id = overrides?.id ?? createId()
  return {
    id,
    workspaceId: 'ws1',
    ticketId: 't1',
    purpose: 'Aceite do atendimento',
    signerName: 'Maria Cliente',
    signerDocument: null,
    signerEmail: null,
    signedById: 'u1',
    storageKey: `ws1/tickets/t1/signatures/${id}.png`,
    imageSha256: 'a'.repeat(64),
    ticketSha256: 'b'.repeat(64),
    signedAt: fixed(),
    signedBy: null,
    ...overrides,
  }
}

/* ---------------------------- seeds (integration) ---------------------------- */

export async function seedSdTicketMessage(
  workspaceId: string,
  ticketId: string,
  overrides?: Partial<Prisma.SdTicketMessageUncheckedCreateInput>,
) {
  return prisma.sdTicketMessage.create({
    data: {
      workspaceId,
      ticketId,
      authorKind: 'AGENT',
      body: 'Mensagem de teste',
      ...overrides,
    },
  })
}

export async function seedSdTicketAttachment(
  workspaceId: string,
  ticketId: string,
  overrides?: Partial<Prisma.SdTicketAttachmentUncheckedCreateInput>,
) {
  const id = overrides?.id ?? createId()
  return prisma.sdTicketAttachment.create({
    data: {
      id,
      workspaceId,
      ticketId,
      kind: 'DOCUMENT',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      size: 10,
      storageKey: `${workspaceId}/tickets/${ticketId}/${id}-doc.pdf`,
      ...overrides,
    },
  })
}

export async function seedSdTicketTask(
  workspaceId: string,
  ticketId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdTicketTaskUncheckedCreateInput>,
) {
  return prisma.sdTicketTask.create({
    data: { workspaceId, ticketId, createdById, title: 'Tarefa', ...overrides },
  })
}

export async function seedSdTicketCost(
  workspaceId: string,
  ticketId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdTicketCostUncheckedCreateInput>,
) {
  return prisma.sdTicketCost.create({
    data: {
      workspaceId,
      ticketId,
      createdById,
      description: 'Custo',
      unitCost: '10.00',
      ...overrides,
    },
  })
}

export async function seedSdCatalogPart(
  workspaceId: string,
  overrides?: Partial<Prisma.SdPartUncheckedCreateInput>,
) {
  return prisma.sdPart.create({
    data: { workspaceId, name: 'Fonte ATX', unitCost: '250.00', ...overrides },
  })
}

export async function seedSdTicketPart(
  workspaceId: string,
  ticketId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdTicketPartUncheckedCreateInput>,
) {
  return prisma.sdTicketPart.create({
    data: {
      workspaceId,
      ticketId,
      createdById,
      name: 'Peça',
      unitCost: '10.00',
      ...overrides,
    },
  })
}

export async function seedSdTicketApproval(
  workspaceId: string,
  ticketId: string,
  requestedById: string,
  overrides?: Partial<Prisma.SdTicketApprovalUncheckedCreateInput>,
) {
  return prisma.sdTicketApproval.create({
    data: {
      workspaceId,
      ticketId,
      requestedById,
      approverEmail: 'gestor@example.com',
      tokenHash: createId(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ...overrides,
    },
  })
}

export async function seedSdTicketSignature(
  workspaceId: string,
  ticketId: string,
  overrides?: Partial<Prisma.SdTicketSignatureUncheckedCreateInput>,
) {
  return prisma.sdTicketSignature.create({
    data: {
      workspaceId,
      ticketId,
      signerName: 'Maria',
      storageKey: `${workspaceId}/tickets/${ticketId}/signatures/x.png`,
      imageSha256: 'a'.repeat(64),
      ticketSha256: 'b'.repeat(64),
      ...overrides,
    },
  })
}
