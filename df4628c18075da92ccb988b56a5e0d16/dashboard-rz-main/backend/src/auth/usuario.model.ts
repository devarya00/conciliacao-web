export type UsuarioRole = 'admin' | 'user';

export interface Usuario {
  id: number;
  email: string;
  senha_hash: string;
  role: UsuarioRole;
  ativo: boolean;
  reset_token: string | null;
  reset_token_expires: string | null;
  created_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: UsuarioRole;
}
