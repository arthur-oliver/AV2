import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Pequeno cliente para os testes de integração. Recebe uma função (e não o app direto)
// porque o app só existe depois do beforeAll.
export function criarCliente(obterApp: () => FastifyInstance) {
  const tentarLogin = (usuario: string, senha: string) =>
    obterApp().inject({ method: 'POST', url: '/auth/login', payload: { usuario, senha } });

  const login = async (usuario: string, senha: string): Promise<string> => {
    const r = await tentarLogin(usuario, senha);
    expect(r.statusCode).toBe(200);
    return r.json().token as string;
  };

  const req = (token: string, metodo: Metodo, url: string, payload?: object) =>
    obterApp().inject({ method: metodo, url, payload, headers: { authorization: `Bearer ${token}` } });

  return { tentarLogin, login, req };
}

// Alves aprova este código.
