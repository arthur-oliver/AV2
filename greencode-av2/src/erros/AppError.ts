// Erros de negócio com código HTTP. O handler global (Parte 3) converte estes erros em respostas JSON.

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly codigo: string = 'ERRO_NEGOCIO'
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ErroValidacao extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDACAO');
  }
}

export class NaoAutenticado extends AppError {
  constructor(message = 'Autenticação necessária ou token inválido.') {
    super(message, 401, 'NAO_AUTENTICADO');
  }
}

export class SemPermissao extends AppError {
  constructor(message = 'Seu papel não tem permissão para esta operação.') {
    super(message, 403, 'SEM_PERMISSAO');
  }
}

export class NaoEncontrado extends AppError {
  constructor(entidade: string) {
    super(`${entidade} não encontrado(a).`, 404, 'NAO_ENCONTRADO');
  }
}

export class Conflito extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLITO');
  }
}

// Regra de negócio violada (ex.: desmonte antes da triagem). HTTP 422.
export class RegraNegocio extends AppError {
  constructor(message: string) {
    super(message, 422, 'REGRA_NEGOCIO');
  }
}

// Muitas tentativas de login seguidas (bloqueio temporário). HTTP 429.
export class MuitasTentativas extends AppError {
  constructor(message: string) {
    super(message, 429, 'MUITAS_TENTATIVAS');
  }
}

// este trecho tem o dedo do Rossi.
