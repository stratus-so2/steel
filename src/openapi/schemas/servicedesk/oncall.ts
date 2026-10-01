import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs do plantão do ServiceDesk (`types/sd-oncall.d.ts`): escalas com
 * camadas e participantes, trocas pontuais, quem está de plantão agora e a
 * linha do tempo das próximas semanas.
 */

const dateTime = () => z.iso.datetime()

const Rotation = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY']).meta({
  description: 'Tamanho do período do rodízio: 1, 7 ou 14 dias.',
})

const Source = z.enum(['rotation', 'override', 'none']).meta({
  description:
    '`rotation` = veio do rodízio, `override` = troca pontual, `none` = camada sem participante.',
})

const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
})

const NamedRef = z.object({ id: z.string(), name: z.string() })

export const SdOnCallScheduleDTO = dto(
  'SdOnCallSchedule',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'Plantão de redes' }),
    department: NamedRef.nullable().meta({
      description: 'Time coberto; `null` = escala geral da workspace.',
    }),
    timezone: z.string().meta({ example: 'America/Sao_Paulo' }),
    rotation: Rotation,
    rotationStart: dateTime().meta({
      description: 'Âncora do rodízio: o primeiro participante cobre daqui.',
    }),
    handoffTime: z.string().meta({
      description: 'Hora da virada, no fuso da escala.',
      example: '09:00',
    }),
    calendar: NamedRef.nullable().meta({
      description:
        'Calendário de expediente: com ele a escala só vale **fora** do horário comercial; `null` = vale 24 h.',
    }),
    active: z.boolean(),
    layers: z.array(
      z.object({
        id: z.string(),
        name: z.string().meta({ example: 'Primeira chamada' }),
        level: z.number().int().meta({
          description: '1 = primeira chamada, 2 = retaguarda…',
          example: 1,
        }),
        participants: z.array(
          z.object({
            id: z.string(),
            position: z.number().int().meta({
              description: 'Ordem do rodízio (0 é o primeiro).',
            }),
            user: User,
          }),
        ),
      }),
    ),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdOnCallOverrideDTO = dto(
  'SdOnCallOverride',
  z.object({
    id: z.string(),
    scheduleId: z.string(),
    scheduleName: z.string(),
    layerId: z.string().nullable().meta({
      description: '`null` = a troca cobre a escala inteira.',
    }),
    user: User,
    startsAt: dateTime(),
    endsAt: dateTime(),
    reason: z.string().nullable(),
    createdAt: dateTime(),
  }),
)

const Slot = z.object({
  layerId: z.string(),
  layerName: z.string(),
  level: z.number().int(),
  userId: z.string().nullable(),
  user: User.nullable(),
  source: Source,
  overrideId: z.string().nullable(),
  periodStart: dateTime(),
  periodEnd: dateTime(),
})

export const SdOnCallNowDTO = dto(
  'SdOnCallNow',
  z.object({
    scheduleId: z.string(),
    scheduleName: z.string(),
    department: NamedRef.nullable(),
    timezone: z.string(),
    at: dateTime(),
    offHours: z.boolean().meta({
      description:
        'Fora do expediente do calendário da escala (sempre `true` quando não há calendário).',
    }),
    applies: z.boolean().meta({
      description: 'A escala está valendo: ativa **e** fora do expediente.',
    }),
    layers: z.array(Slot),
  }),
)

export const SdOnCallTimelineDTO = dto(
  'SdOnCallTimeline',
  z.object({
    scheduleId: z.string(),
    scheduleName: z.string(),
    timezone: z.string(),
    from: dateTime(),
    to: dateTime(),
    layers: z.array(
      z.object({
        layerId: z.string(),
        layerName: z.string(),
        level: z.number().int(),
        segments: z.array(
          z.object({
            start: dateTime(),
            end: dateTime(),
            userId: z.string().nullable(),
            user: User.nullable(),
            source: Source,
            overrideId: z.string().nullable(),
          }),
        ),
      }),
    ),
  }),
)
