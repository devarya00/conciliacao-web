/** Variável de ambiente obrigatória — falha rápido e alto na subida do
 * processo em vez de cair num fallback previsível (ex.: JWT_SECRET fraco
 * que permitiria forjar token de admin se alguém esquecer de configurar). */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não configurada: ${name}`);
  }
  return value;
}
