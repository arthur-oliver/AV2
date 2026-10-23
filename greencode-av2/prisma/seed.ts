// Carga inicial de dados (seed). Idempotente: pode rodar várias vezes sem duplicar registros.
// Execução: npm run db:seed
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const emDias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// IDs fixos só para o seed ser repetível.
const ID = {
  orgBanco: '00000000-0000-4000-8000-0000000000a1',
  orgHospital: '00000000-0000-4000-8000-0000000000a2',
  orgUniversidade: '00000000-0000-4000-8000-0000000000a3',
  lote1: '00000000-0000-4000-8000-0000000000b1',
  lote2: '00000000-0000-4000-8000-0000000000b2',
  lote3: '00000000-0000-4000-8000-0000000000b3'
};

async function usuarios() {
  const lista = [
    { usuario: 'superusuario', nome: 'Superusuário', senha: 'Super@123', papel: 'SUPERUSUARIO' },
    { usuario: 'admin', nome: 'Administrador', senha: 'Admin@123', papel: 'ADMINISTRADOR' },
    { usuario: 'operador', nome: 'Operador de Cadastro', senha: 'Operador@123', papel: 'OPERADOR_CADASTRO' },
    { usuario: 'gestor', nome: 'Gestor de Almoxarifado', senha: 'Gestor@123', papel: 'GESTOR_ALMOXARIFADO' },
    { usuario: 'auditor', nome: 'Auditor', senha: 'Auditor@123', papel: 'AUDITOR' }
  ] as const;

  for (const u of lista) {
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { usuario: u.usuario, nome: u.nome, senhaHash: await bcrypt.hash(u.senha, 10), papel: u.papel }
    });
  }
}

async function organizacoes() {
  const orgs = [
    {
      id: ID.orgBanco,
      razaoSocial: 'Banco Horizonte S.A.',
      cnpj: '11222333000181',
      inscricaoEstadual: '110042490114',
      enderecoCompleto: 'Av. Paulista, 1000 - São Paulo/SP',
      telefone: '(11) 3000-1000',
      email: 'ti@bancohorizonte.example',
      contrato: { valor: '15000.00', venc: emDias(300), auto: true }
    },
    {
      id: ID.orgHospital,
      razaoSocial: 'Hospital Vida Plena',
      cnpj: '45678912000155',
      inscricaoEstadual: 'ISENTO',
      enderecoCompleto: 'Rua das Flores, 200 - Curitiba/PR',
      telefone: '(41) 3000-2000',
      email: 'suprimentos@vidaplena.example',
      contrato: { valor: '8200.50', venc: emDias(120), auto: false }
    },
    {
      // Sem contrato: o contrato é opcional na AV2.
      id: ID.orgUniversidade,
      razaoSocial: 'Universidade Federal Exemplo',
      cnpj: '98765432000198',
      inscricaoEstadual: 'ISENTO',
      enderecoCompleto: 'Campus Central - Belo Horizonte/MG',
      telefone: '(31) 3000-3000',
      email: 'patrimonio@ufexemplo.example',
      contrato: null
    }
  ];

  for (const o of orgs) {
    const { contrato, ...dados } = o;
    await prisma.organizacao.upsert({ where: { id: o.id }, update: {}, create: dados });
    if (contrato) {
      await prisma.contrato.upsert({
        where: { organizacaoId: o.id },
        update: {},
        create: {
          organizacaoId: o.id,
          dataAssinatura: diasAtras(60),
          dataVencimento: contrato.venc,
          clausulas: [
            'Coleta mensal programada de equipamentos eletrônicos.',
            'Emissão de certificado de destinação ambiental.',
            'Rastreabilidade completa de cada equipamento.'
          ],
          valorMensal: contrato.valor,
          renovacaoAutomatica: contrato.auto
        }
      });
    }
  }
}

async function lotesEEquipamentos() {
  const lotes = [
    { id: ID.lote1, organizacaoId: ID.orgBanco, dias: 30, nf: 'NF-100001', transp: 'TransRapida', status: 'TRIAGEM_CONCLUIDA' },
    { id: ID.lote2, organizacaoId: ID.orgHospital, dias: 10, nf: 'NF-100002', transp: 'LogVerde', status: 'EM_TRIAGEM' },
    { id: ID.lote3, organizacaoId: ID.orgBanco, dias: 2, nf: 'NF-100003', transp: 'TransRapida', status: 'RECEBIDO' }
  ] as const;

  for (const l of lotes) {
    await prisma.lote.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        organizacaoId: l.organizacaoId,
        dataEntrada: diasAtras(l.dias),
        notaFiscal: l.nf,
        transportadora: l.transp,
        statusProcessamento: l.status,
        observacoes: 'Lote gerado pelo seed.'
      }
    });
  }

  // tipo, marca, modelo, ano, estado, peso, lote, posição, status
  // O código de barras do equipamento é o próprio id (gerado aqui com UUID fixo, só para o seed ser repetível).
  const equipamentos = [
    ['NOTEBOOK', 'Dell', 'Latitude 5400', 2018, 'USADO_MODERADO', '1.900', ID.lote1, 1, 'AGUARDANDO_DESMONTE'],
    ['COMPUTADOR_MESA', 'HP', 'ProDesk 400', 2016, 'DANIFICADO_LEVE', '7.500', ID.lote1, 2, 'EM_DESMONTE'],
    ['MONITOR', 'LG', '22MK430', 2019, 'BOM_ESTADO', '3.200', ID.lote1, 3, 'PECAS_REAPROVEITADAS'],
    ['SERVIDOR', 'IBM', 'x3650', 2012, 'DANIFICADO_GRAVE', '22.000', ID.lote1, 4, 'DESCARTE_SEGURO'],
    ['IMPRESSORA', 'Epson', 'L3150', 2020, 'USADO_LEVE', '4.000', ID.lote2, 1, 'EM_TRIAGEM'],
    ['ROTEADOR', 'Cisco', 'RV340', 2017, 'USADO_MODERADO', '1.100', ID.lote2, 2, 'EM_TRIAGEM'],
    ['NOTEBOOK', 'Lenovo', 'ThinkPad T480', 2019, 'USADO_LEVE', '1.700', ID.lote3, 1, 'AGUARDANDO_TRIAGEM'],
    ['FONTE_ALIMENTACAO', 'Corsair', 'CV550', 2015, 'INSERVIVEL', '1.300', ID.lote3, 2, 'AGUARDANDO_TRIAGEM']
  ] as const;

  for (const [indice, [tipo, marca, modelo, ano, estado, peso, loteId, pos, status]] of equipamentos.entries()) {
    const idFixo = `00000000-0000-4000-8000-0000000000c${indice + 1}`;
    // Idempotente: localiza pela posição no lote (e não pelo código), assim também funciona em bancos já populados.
    const existente = await prisma.equipamento.findFirst({ where: { loteId, posicaoNoLote: pos } });
    let e;
    if (existente) {
      e = existente.codigoBarrasInterno === existente.id
        ? existente
        : await prisma.equipamento.update({ where: { id: existente.id }, data: { codigoBarrasInterno: existente.id } });
    } else {
      e = await prisma.equipamento.create({
        data: {
          id: idFixo,
          codigoBarrasInterno: idFixo,
          tipo,
          marca,
          modelo,
          anoFabricacao: ano,
          estadoFisico: estado,
          pesoQuilogramas: peso,
          loteId,
          posicaoNoLote: pos,
          statusRastreamento: status
        }
      });
    }

    // Histórico inicial: só cria se o equipamento ainda não tem movimentações.
    const jaTem = await prisma.movimentacao.count({ where: { equipamentoId: e.id } });
    if (jaTem === 0) {
      await prisma.movimentacao.create({
        data: {
          equipamentoId: e.id,
          origem: 'CLIENTE',
          destino: 'AGUARDANDO_TRIAGEM',
          responsavel: 'gestor',
          observacao: 'Recebimento do lote (seed).'
        }
      });
    }
  }
}

async function main() {
  await usuarios();
  await organizacoes();
  await lotesEEquipamentos();
  console.log('Seed concluído: 5 usuários, 3 organizações, 3 lotes, 8 equipamentos.');
  console.log('Logins: superusuario/Super@123, admin/Admin@123, operador/Operador@123, gestor/Gestor@123, auditor/Auditor@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// este trecho tem o dedo do Rossi.
