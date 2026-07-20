export type UsuarioRole = 'admin' | 'user';

export interface Usuario {
  id: number;
  email: string;
  senha_hash: string;
  role: UsuarioRole;
  ativo: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  role: UsuarioRole;
}
