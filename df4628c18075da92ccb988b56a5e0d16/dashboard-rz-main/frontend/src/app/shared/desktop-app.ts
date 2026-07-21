import { environment } from '../../environments/environment';

/**
 * Prefixo de URL da API. `environment.apiUrl` (build-time, `fileReplacements`
 * troca `environment.ts` por `environment.production.ts`) — vazio = path
 * relativo (dev via `proxy.conf.json`, ou produção same-origin). Preencha com
 * URL absoluta quando o frontend for hospedado separado do backend (ex.:
 * Vercel + backend em outro domínio).
 */
export function apiBase(): string {
  return environment.apiUrl ?? '';
}
