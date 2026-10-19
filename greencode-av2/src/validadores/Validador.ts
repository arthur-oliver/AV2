// Classe abstrata herdada da AV1: contrato comum para todas as validações (herança + polimorfismo).
export abstract class Validador<T = unknown> {
  protected mensagemErro = '';

  abstract validar(objeto: T): boolean;

  obterMensagemErro(): string {
    return this.mensagemErro;
  }
}

// escrito com carinho por Arthur.
