export const environment = {
  production: true,
  // frontend hospedado na Vercel, separado do backend — sem proxy
  // same-origin na frente, então isso PRECISA de URL absoluta
  // (ex.: 'https://api.dominio.com.br'). Preencher quando a URL do
  // backend em produção existir; também ajustar connect-src em
  // frontend/src/index.html e CORS_ALLOWED_ORIGINS no backend.
  apiUrl: '',
};
