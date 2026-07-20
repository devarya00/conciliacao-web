import { environment } from '../../environments/environment';

export interface DesktopApp {
  isDesktop: boolean;
  version: string;
  apiBaseUrl: string;
}

declare global {
  interface Window {
    desktopApp?: DesktopApp;
  }
}

/**
 * Prefixo de URL da API, em ordem de prioridade:
 * 1. `window.desktopApp.apiBaseUrl` — dentro do wrapper Electron (exposto pelo
 *    preload, definido em `desktop/config.json` no empacotamento). Obrigatório
 *    ali: o app roda via `file://` e path relativo não resolve contra backend
 *    nenhum. É runtime, não build-time — o mesmo `dist/` do Angular serve pra
 *    qualquer `apiBaseUrl` configurado no pacote Electron.
 * 2. `environment.apiUrl` — só usado no build web, se o frontend algum dia for
 *    hospedado separado do backend (sem proxy same-origin). É build-time
 *    (`fileReplacements` troca `environment.ts` por `environment.production.ts`).
 *    Hoje fica vazio: `nginx.conf` já faz proxy_pass /api -> backend, mesma origem.
 * 3. vazio — path relativo (dev via `proxy.conf.json`, ou produção web same-origin).
 */
export function apiBase(): string {
  return window.desktopApp?.apiBaseUrl ?? environment.apiUrl ?? '';
}
