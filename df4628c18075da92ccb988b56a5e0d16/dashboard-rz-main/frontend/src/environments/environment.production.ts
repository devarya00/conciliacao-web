export const environment = {
  production: true,
  // vazio = path relativo, mesma origem do frontend (é o caso do deploy atual:
  // nginx.conf faz proxy_pass /api/ -> backend:3001, tudo servido na mesma
  // origem). Só preencha com URL absoluta (ex.: 'https://api.dominio.com.br')
  // se o frontend web passar a ser hospedado separado do backend, sem proxy
  // same-origin na frente.
  apiUrl: '',
};
