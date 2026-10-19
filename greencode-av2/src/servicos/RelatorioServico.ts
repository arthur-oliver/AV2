import { prisma } from '../lib/prisma';
import { NaoEncontrado } from '../erros/AppError';
import { intervalo } from '../utils/datas';
import type { StatusRastreamento } from '../dominio/enums';

const arred = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;

// Relatórios e consulta de auditoria (somente leitura).
export class RelatorioServico {
  // Equivalente ao gerarRelatorioPorOrganizacao() da AV1.
  async porOrganizacao(organizacaoId: string, inicio?: string, fim?: string) {
    const per = intervalo(inicio, fim);
    const org = await prisma.organizacao.findUnique({ where: { id: organizacaoId }, select: { id: true, razaoSocial: true, cnpj: true } });
    if (!org) throw new NaoEncontrado('Organização');

    const lotes = await prisma.lote.findMany({
      where: { organizacaoId, dataEntrada: { gte: per.inicio, lte: per.fim } },
      include: { equipamentos: { select: { pesoQuilogramas: true, statusRastreamento: true } } },
      orderBy: { dataEntrada: 'asc' }
    });

    const porStatus: Record<string, number> = {};
    let totalEquipamentos = 0;
    let peso = 0;
    for (const l of lotes) {
      for (const e of l.equipamentos) {
        totalEquipamentos += 1;
        peso += Number(e.pesoQuilogramas);
        porStatus[e.statusRastreamento] = (porStatus[e.statusRastreamento] ?? 0) + 1;
      }
    }

    return {
      organizacao: org,
      periodo: per,
      totalLotes: lotes.length,
      totalEquipamentos,
      pesoTotalKg: arred(peso, 3),
      equipamentosPorStatus: porStatus,
      lotes: lotes.map((l) => ({
        id: l.id,
        dataEntrada: l.dataEntrada,
        notaFiscal: l.notaFiscal,
        statusProcessamento: l.statusProcessamento,
        equipamentos: l.equipamentos.length
      }))
    };
  }

  // Equivalente ao gerarRelatorioPorStatus() da AV1.
  async porStatus(status: StatusRastreamento) {
    const equipamentos = await prisma.equipamento.findMany({
      where: { statusRastreamento: status },
      include: { lote: { select: { id: true, notaFiscal: true, organizacaoId: true } } },
      orderBy: { atualizadoEm: 'desc' },
      take: 500
    });
    return { status, total: equipamentos.length, equipamentos };
  }

  // Contratos vigentes em algum momento do período (assinados até o fim e que vencem depois do início).
  async financeiro(inicio?: string, fim?: string) {
    const per = intervalo(inicio, fim);
    const contratos = await prisma.contrato.findMany({
      where: { dataAssinatura: { lte: per.fim }, dataVencimento: { gte: per.inicio } },
      include: { organizacao: { select: { id: true, razaoSocial: true, cnpj: true } } },
      orderBy: { valorMensal: 'desc' }
    });
    const total = contratos.reduce((s, c) => s + Number(c.valorMensal), 0);
    return {
      periodo: per,
      organizacoesComContrato: contratos.length,
      valorMensalContratado: arred(total, 2),
      contratos: contratos.map((c) => ({
        organizacao: c.organizacao,
        valorMensal: Number(c.valorMensal),
        dataVencimento: c.dataVencimento,
        renovacaoAutomatica: c.renovacaoAutomatica
      }))
    };
  }

  // Consulta ao journal (auditoria): quem fez o quê, com estado antes/depois.
  async auditoria(f: { entidade?: string; entidadeId?: string; usuario?: string; inicio?: string; fim?: string; limite?: number }) {
    const per = f.inicio || f.fim ? intervalo(f.inicio, f.fim) : undefined;
    const registros = await prisma.journalTransacao.findMany({
      where: {
        ...(f.entidade && { entidade: f.entidade }),
        ...(f.entidadeId && { entidadeId: f.entidadeId }),
        ...(f.usuario && { usuarioResponsavel: f.usuario }),
        ...(per && { timestamp: { gte: per.inicio, lte: per.fim } })
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(f.limite ?? 100, 500)
    });
    return { total: registros.length, registros };
  }
}

// Oliver passou por aqui.
