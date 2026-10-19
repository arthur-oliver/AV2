// Enumerações do domínio (mesmos valores do schema.prisma e da AV1).
// Usam o padrão "objeto const + tipo", que gera os mesmos tipos de string literal do Prisma.
// Assim, o código de regras não depende do Prisma Client e pode ser testado isoladamente.

export const PapelUsuario = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  OPERADOR_CADASTRO: 'OPERADOR_CADASTRO',
  GESTOR_ALMOXARIFADO: 'GESTOR_ALMOXARIFADO',
  AUDITOR: 'AUDITOR',
  SUPERUSUARIO: 'SUPERUSUARIO'
} as const;
export type PapelUsuario = (typeof PapelUsuario)[keyof typeof PapelUsuario];

export const StatusLote = {
  RECEBIDO: 'RECEBIDO',
  EM_TRIAGEM: 'EM_TRIAGEM',
  TRIAGEM_CONCLUIDA: 'TRIAGEM_CONCLUIDA',
  ENCAMINHADO: 'ENCAMINHADO',
  FINALIZADO: 'FINALIZADO'
} as const;
export type StatusLote = (typeof StatusLote)[keyof typeof StatusLote];

export const TipoEquipamento = {
  COMPUTADOR_MESA: 'COMPUTADOR_MESA',
  NOTEBOOK: 'NOTEBOOK',
  MONITOR: 'MONITOR',
  IMPRESSORA: 'IMPRESSORA',
  SERVIDOR: 'SERVIDOR',
  ROTEADOR: 'ROTEADOR',
  CABO_ESTRUTURADO: 'CABO_ESTRUTURADO',
  FONTE_ALIMENTACAO: 'FONTE_ALIMENTACAO'
} as const;
export type TipoEquipamento = (typeof TipoEquipamento)[keyof typeof TipoEquipamento];

// A ORDEM importa: do melhor para o pior estado (usada na regra das "duas categorias").
export const EstadoFisico = {
  NOVO: 'NOVO',
  BOM_ESTADO: 'BOM_ESTADO',
  USADO_LEVE: 'USADO_LEVE',
  USADO_MODERADO: 'USADO_MODERADO',
  DANIFICADO_LEVE: 'DANIFICADO_LEVE',
  DANIFICADO_GRAVE: 'DANIFICADO_GRAVE',
  INSERVIVEL: 'INSERVIVEL'
} as const;
export type EstadoFisico = (typeof EstadoFisico)[keyof typeof EstadoFisico];

export const StatusRastreamento = {
  AGUARDANDO_TRIAGEM: 'AGUARDANDO_TRIAGEM',
  EM_TRIAGEM: 'EM_TRIAGEM',
  AGUARDANDO_DESMONTE: 'AGUARDANDO_DESMONTE',
  EM_DESMONTE: 'EM_DESMONTE',
  PECAS_REAPROVEITADAS: 'PECAS_REAPROVEITADAS',
  MATERIAL_RECICLAVEL: 'MATERIAL_RECICLAVEL',
  DESCARTE_SEGURO: 'DESCARTE_SEGURO',
  BAIXA_DEFINITIVA: 'BAIXA_DEFINITIVA'
} as const;
export type StatusRastreamento = (typeof StatusRastreamento)[keyof typeof StatusRastreamento];

// escrito com carinho por Arthur.
