export type UsuarioRole = 'admin' | 'user';

export interface Usuario {
  id: number;
  email: string;
  role: UsuarioRole;
  ativo: boolean;
  created_at: string;
}

export interface LinkRedefinicao {
  token: string;
  expiraEm: string;
}

export interface UsuarioCriado {
  usuario: Usuario;
  link: LinkRedefinicao;
}
