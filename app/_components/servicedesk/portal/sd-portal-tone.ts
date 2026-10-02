/**
 * Cor de estado das telas do solicitante — o portal de dentro do app e o
 * portal externo (`../external-portal`) — num mapa fechado, nunca espalhada
 * no JSX. Segue o padrão do repositório (`bg-<c>-500/10` + `text-<c>-700
 * dark:text-<c>-300`), que tem contraste no claro e no escuro com uma
 * declaração só e fica visível ao Tailwind.
 *
 * Tudo que o tema nomeia (superfície, borda, erro, destaque) usa token:
 * `card`, `muted`, `border`, `destructive`, `primary`. Aqui ficam apenas os
 * dois estados sem token — confirmação e a estrela da avaliação.
 */

import { SD_TONE_SOFT, SD_TONE_TEXT } from '../sd-tone'

/** Confirmação: "tudo resolvido", "como foi resolvido", "verifique o e-mail". */
export const SD_PORTAL_OK_TONE = SD_TONE_SOFT.emerald

/** Só o texto da confirmação, quando a superfície já vem do tema. */
export const SD_PORTAL_OK_TEXT = SD_TONE_TEXT.emerald

/** Estrela marcada da avaliação (CSAT) e o estado de passagem do mouse. */
export const SD_CSAT_STAR_ON = 'text-amber-500'
export const SD_CSAT_STAR_HOVER = 'hover:text-amber-500'
