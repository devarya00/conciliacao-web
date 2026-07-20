export type UsuarioRole = 'admin' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  role: UsuarioRole;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}
