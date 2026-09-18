import {
  AxiomJSTransport,
  ConsoleTransport,
  Logger,
  type Transport,
} from '@axiomhq/logging'
import axiomClient from '@/lib/axiom/axiom'
import { NEXT_PUBLIC_AXIOM_DATASET, NODE_ENV } from '@/lib/env/env'

const transports: [Transport, ...Transport[]] = [
  new AxiomJSTransport({
    axiom: axiomClient,
    dataset: NEXT_PUBLIC_AXIOM_DATASET,
  }),
]

if (NODE_ENV !== 'production') {
  transports.push(new ConsoleTransport({ prettyPrint: true }))
}

export const logger = new Logger({ transports })
