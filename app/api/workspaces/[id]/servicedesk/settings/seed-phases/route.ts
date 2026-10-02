import { sdConfigRoute } from '@/src/lib/servicedesk/config-route'
import {
  type SeedSdPhasesDTO,
  SeedSdPhasesSchema,
} from '@/src/schemas/sd-phase.schema'
import { SdSeedService } from '@/src/services/sd-seed.service'

export const POST = sdConfigRoute<SeedSdPhasesDTO>({
  consent: 'POST /api/workspaces/[id]/servicedesk/settings/seed-phases',
  body: SeedSdPhasesSchema,
  handler: ({ userId, params, body }) =>
    SdSeedService.seedPhases(userId, params.id, body.ticketType),
})
