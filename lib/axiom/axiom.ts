import { Axiom } from '@axiomhq/js';
import { NEXT_PUBLIC_AXIOM_TOKEN } from '@/lib/env/env';

const axiomClient = new Axiom({
  // Empty when unset: the loggers then never ship (lib/axiom/transports.ts).
  token: NEXT_PUBLIC_AXIOM_TOKEN ?? '',
});

export default axiomClient;
