import { paraCsv } from '../utils/csv';
import type { Celula } from '../utils/csv';
import type { RelatorioServico } from './RelatorioServico';

// Converte o resultado de cada relatório em linhas de CSV (uma tabela por arquivo, com linha de TOTAL
// quando faz sentido). Funções puras: recebem o mesmo objeto que a API devolve em JSON.
type Resultado<K extends keyof RelatorioServico> = Awaited<ReturnType<RelatorioServico[K]>>;


export function csvPorOrganizacao(r: Resultado<'porOrganizacao'>): string {
  const linhas: Celula[][] = [['Organização', 'CNPJ', 'Lote', 'Data de entrada', 'Nota fiscal', 'Status do lote', 'Equipamentos']];
  for (const l of r.lotes) {
    linhas.push([r.organizacao.razaoSocial, r.organizacao.cnpj, l.id, l.dataEntrada, l.notaFiscal, l.statusProcessamento, l.equipamentos]);
  }
  linhas.push(['TOTAL', '', `${r.totalLotes} lote(s)`, '', '', '', r.totalEquipamentos]);
  linhas.push(['Peso total (kg)', '', r.pesoTotalKg]);
  return paraCsv(linhas);
}

export function csvPorStatus(r: Resultado<'porStatus'>): string {
  const linhas: Celula[][] = [
    ['Código de barras', 'Tipo', 'Marca', 'Modelo', 'Ano', 'Estado físico', 'Peso (kg)', 'Status', 'Lote', 'Nota fiscal', 'Atualizado em']
  ];
  for (const e of r.equipamentos) {
    linhas.push([
      e.codigoBarrasInterno, e.tipo, e.marca, e.modelo, e.anoFabricacao, e.estadoFisico,
      Number(e.pesoQuilogramas), e.statusRastreamento, e.lote.id, e.lote.notaFiscal, e.atualizadoEm
    ]);
  }
  linhas.push(['TOTAL', `${r.total} equipamento(s)`]);
  return paraCsv(linhas);
}

export function csvFinanceiro(r: Resultado<'financeiro'>): string {
  const linhas: Celula[][] = [['Organização', 'CNPJ', 'Valor mensal (R$)', 'Vencimento', 'Renovação automática']];
  for (const c of r.contratos) {
    linhas.push([c.organizacao.razaoSocial, c.organizacao.cnpj, c.valorMensal, c.dataVencimento, c.renovacaoAutomatica]);
  }
  linhas.push(['TOTAL', `${r.organizacoesComContrato} organização(ões)`, r.valorMensalContratado]);
  return paraCsv(linhas);
}

export function csvAuditoria(r: Resultado<'auditoria'>): string {
  const linhas: Celula[][] = [['Data/hora (UTC)', 'Operação', 'Entidade', 'Id da entidade', 'Usuário', 'Antes', 'Depois']];
  for (const j of r.registros) {
    linhas.push([
      j.timestamp, j.operacao, j.entidade, j.entidadeId, j.usuarioResponsavel,
      j.dadosAntes == null ? '' : JSON.stringify(j.dadosAntes),
      j.dadosDepois == null ? '' : JSON.stringify(j.dadosDepois)
    ]);
  }
  return paraCsv(linhas);
}


// este trecho tem o dedo do Rossi.
