// Teste de integração: sobe a API de verdade (app.inject) contra o MySQL.
// Pré-requisitos: banco migrado e populado (npm run db:migrate && npm run db:seed) e .env configurado.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../src/app';
import { gerarCnpjValido } from '../helpers/cnpj';

let app: FastifyInstance;
const tokens: Record<string, string> = {};

async function login(usuario: string, senha: string) {
  const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { usuario, senha } });
  expect(r.statusCode).toBe(200);
  return r.json().token as string;
}

const req = (token: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } });

let orgId = '';
let loteId = '';
let loteVersao = 0;
let equipamentoId = '';
let equipamentoVersao = 0;

beforeAll(async () => {
  app = await construirApp();
  await app.ready();
  tokens.admin = await login('admin', 'Admin@123');
  tokens.operador = await login('operador', 'Operador@123');
  tokens.gestor = await login('gestor', 'Gestor@123');
  tokens.auditor = await login('auditor', 'Auditor@123');
});

afterAll(async () => {
  await app.close();
});

describe('autenticação e autorização', () => {
  it('health responde com o banco conectado', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' });
    expect(r.statusCode).toBe(200);
    expect(r.json().banco).toBe('conectado');
  });

  it('rejeita senha errada e acesso sem token', async () => {
    const a = await app.inject({ method: 'POST', url: '/auth/login', payload: { usuario: 'admin', senha: 'errada' } });
    expect(a.statusCode).toBe(401);
    const b = await app.inject({ method: 'GET', url: '/organizacoes' });
    expect(b.statusCode).toBe(401);
  });

  it('o token carrega o papel do usuário', async () => {
    const r = await req(tokens.gestor, 'GET', '/auth/me');
    expect(r.json().papel).toBe('GESTOR_ALMOXARIFADO');
  });

  it('respeita as permissões por papel', async () => {
    const dados = { razaoSocial: 'Teste Permissão', cnpj: gerarCnpjValido() };
    expect((await req(tokens.auditor, 'POST', '/organizacoes', dados)).statusCode).toBe(403);
    expect((await req(tokens.gestor, 'POST', '/organizacoes', dados)).statusCode).toBe(403);
    expect((await req(tokens.auditor, 'GET', '/usuarios')).statusCode).toBe(403);
    expect((await req(tokens.gestor, 'GET', '/auditoria')).statusCode).toBe(403);
  });
});

describe('organizações e contratos', () => {
  const cnpj = gerarCnpjValido();

  it('cadastra organização com contrato', async () => {
    const r = await req(tokens.operador, 'POST', '/organizacoes', {
      razaoSocial: 'Empresa de Teste Ltda',
      cnpj,
      contrato: { dataVencimento: '2099-12-31', clausulas: ['Coleta mensal'], valorMensal: 1234.5 }
    });
    expect(r.statusCode).toBe(201);
    const corpo = r.json();
    orgId = corpo.id;
    expect(corpo.versao).toBe(1);
    expect(corpo.cnpj).toBe(cnpj);
    expect(corpo.contratoVigente).toBe(true);
  });

  it('recusa CNPJ duplicado (409) e CNPJ inválido (400)', async () => {
    expect((await req(tokens.operador, 'POST', '/organizacoes', { razaoSocial: 'Duplicada', cnpj })).statusCode).toBe(409);
    expect((await req(tokens.operador, 'POST', '/organizacoes', { razaoSocial: 'Falsa', cnpj: '11111111111111' })).statusCode).toBe(400);
  });

  it('versionamento otimista: a segunda atualização com a mesma versão dá 409', async () => {
    const ok = await req(tokens.operador, 'PUT', `/organizacoes/${orgId}`, { telefone: '(11) 99999-0000', versao: 1 });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().versao).toBe(2);
    const conflito = await req(tokens.operador, 'PUT', `/organizacoes/${orgId}`, { telefone: '(11) 88888-0000', versao: 1 });
    expect(conflito.statusCode).toBe(409);
  });
});

describe('lotes e equipamentos', () => {
  it('cria lote com equipamentos em uma transação', async () => {
    const r = await req(tokens.gestor, 'POST', '/lotes', {
      organizacaoId: orgId,
      notaFiscal: 'NF-TESTE-1',
      transportadora: 'TransTeste',
      equipamentos: [
        { tipo: 'NOTEBOOK', anoFabricacao: 2020, estadoFisico: 'NOVO', pesoQuilogramas: 1.5 },
        { tipo: 'MONITOR', anoFabricacao: 2019, pesoQuilogramas: 3 }
      ]
    });
    expect(r.statusCode).toBe(201);
    const lote = r.json();
    loteId = lote.id;
    loteVersao = lote.versao;
    expect(lote.equipamentos).toHaveLength(2);
    expect(lote.equipamentos.map((e: any) => e.posicaoNoLote)).toEqual([1, 2]);
    expect(lote.resumo.pesoTotalKg).toBe(4.5);
    expect(lote.equipamentos[0].codigoBarrasInterno).toMatch(/^GC-NOTE-/);
  });

  it('valida a data de entrada do lote', async () => {
    const base = { organizacaoId: orgId, notaFiscal: 'NF-X', transportadora: 'T' };
    expect((await req(tokens.gestor, 'POST', '/lotes', { ...base, dataEntrada: '2099-01-01' })).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'POST', '/lotes', { ...base, dataEntrada: '2020-01-01' })).statusCode).toBe(400);
  });

  it('não desativa organização com lote em aberto (422)', async () => {
    const org = (await req(tokens.operador, 'GET', `/organizacoes/${orgId}`)).json();
    const r = await req(tokens.operador, 'PATCH', `/organizacoes/${orgId}/ativo`, { ativo: false, versao: org.versao });
    expect(r.statusCode).toBe(422);
  });

  it('antes da triagem, o desmonte é bloqueado', async () => {
    const lista = (await req(tokens.gestor, 'GET', `/equipamentos?loteId=${loteId}`)).json();
    equipamentoId = lista[0].id;
    equipamentoVersao = lista[0].versao;
    // AGUARDANDO_TRIAGEM -> AGUARDANDO_DESMONTE nem é uma transição válida
    const r = await req(tokens.gestor, 'PATCH', `/equipamentos/${equipamentoId}/status`, {
      status: 'AGUARDANDO_DESMONTE',
      justificativa: 'tentativa',
      versao: equipamentoVersao
    });
    expect(r.statusCode).toBe(422);
  });

  it('processa a triagem e rejeita versão desatualizada do lote', async () => {
    const velha = await req(tokens.gestor, 'POST', `/lotes/${loteId}/triagem`, { versao: loteVersao + 5 });
    expect(velha.statusCode).toBe(409);

    const r = await req(tokens.gestor, 'POST', `/lotes/${loteId}/triagem`, { versao: loteVersao });
    expect(r.statusCode).toBe(200);
    expect(r.json().statusProcessamento).toBe('TRIAGEM_CONCLUIDA');
    expect(r.json().equipamentos.every((e: any) => e.statusRastreamento === 'EM_TRIAGEM')).toBe(true);

    const de = (await req(tokens.gestor, 'GET', `/equipamentos/${equipamentoId}`)).json();
    equipamentoVersao = de.versao;
  });

  it('exige justificativa e permite desmonte após a triagem completa', async () => {
    const semJust = await req(tokens.gestor, 'PATCH', `/equipamentos/${equipamentoId}/status`, {
      status: 'AGUARDANDO_DESMONTE',
      justificativa: '',
      versao: equipamentoVersao
    });
    expect(semJust.statusCode).toBe(422);

    const ok = await req(tokens.gestor, 'PATCH', `/equipamentos/${equipamentoId}/status`, {
      status: 'AGUARDANDO_DESMONTE',
      justificativa: 'Triagem concluída',
      versao: equipamentoVersao
    });
    expect(ok.statusCode).toBe(200);
    equipamentoVersao = ok.json().versao;
  });

  it('estado físico: queda de 3 categorias só com justificativa', async () => {
    const sem = await req(tokens.gestor, 'PATCH', `/equipamentos/${equipamentoId}/estado-fisico`, {
      estadoFisico: 'USADO_MODERADO',
      versao: equipamentoVersao
    });
    expect(sem.statusCode).toBe(422);
    const com = await req(tokens.gestor, 'PATCH', `/equipamentos/${equipamentoId}/estado-fisico`, {
      estadoFisico: 'USADO_MODERADO',
      justificativa: 'Danos no transporte',
      versao: equipamentoVersao
    });
    expect(com.statusCode).toBe(200);
  });

  it('rastreabilidade: recebimento, triagem e mudança de status ficam no histórico', async () => {
    const r = await req(tokens.auditor, 'GET', `/equipamentos/${equipamentoId}/rastreamento`);
    expect(r.statusCode).toBe(200);
    const destinos = r.json().movimentacoes.map((m: any) => m.destino);
    expect(destinos).toEqual(['AGUARDANDO_TRIAGEM', 'EM_TRIAGEM', 'AGUARDANDO_DESMONTE']);
  });
});

describe('relatórios e auditoria', () => {
  it('relatório por organização soma lotes, equipamentos e peso', async () => {
    const r = await req(tokens.auditor, 'GET', `/relatorios/organizacao/${orgId}`);
    expect(r.statusCode).toBe(200);
    const rel = r.json();
    expect(rel.totalLotes).toBe(1);
    expect(rel.totalEquipamentos).toBe(2);
    expect(rel.pesoTotalKg).toBe(4.5);
  });

  it('o auditor lê o journal das operações realizadas', async () => {
    const r = await req(tokens.auditor, 'GET', `/auditoria?entidade=Equipamento&entidadeId=${equipamentoId}`);
    expect(r.statusCode).toBe(200);
    expect(r.json().total).toBeGreaterThanOrEqual(3); // criação + status + estado físico
  });

  it('o auditor não consegue alterar nada', async () => {
    const r = await req(tokens.auditor, 'POST', '/lotes', { organizacaoId: orgId, notaFiscal: 'NF', transportadora: 'T' });
    expect(r.statusCode).toBe(403);
  });
});

// este trecho tem o dedo do Rossi.
