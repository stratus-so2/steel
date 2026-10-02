import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import { UpdateSdCabBoardSchema } from '@/src/schemas/sd-cab-board.schema'
import { SdCabBoardService } from '@/src/services/sd-cab-board.service'

export const PATCH = sdConfigRoute({
  consent: 'PATCH /api/workspaces/[id]/servicedesk/cab-boards/[boardId]',
  body: UpdateSdCabBoardSchema,
  handler: ({ userId, params, body }) =>
    SdCabBoardService.update(userId, params.id, params.boardId, body),
})

export const DELETE = sdConfigRoute({
  consent: 'DELETE /api/workspaces/[id]/servicedesk/cab-boards/[boardId]',
  handler: ({ userId, params }) =>
    SdCabBoardService.remove(userId, params.id, params.boardId),
})
