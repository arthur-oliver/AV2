// Proteção contra adivinhação de senha (força bruta): depois de N falhas seguidas para o mesmo login,
// novas tentativas são recusadas por um tempo (HTTP 429), mesmo que a senha enviada esteja correta.
//
// Os contadores ficam em memória: simples e sem tabela nova. Reiniciar o servidor zera os bloqueios.
// Em produção com várias instâncias, o ideal seria guardar isso em um armazenamento compartilhado (ex.: Redis).
// Observação: o login é contado mesmo que não exista, para a resposta não revelar quais logins existem.

interface Registro {
  falhas: number;
  bloqueadoAte: number; // 0 = sem bloqueio
  ultimaFalha: number;
}

export class ControleTentativasLogin {
  private readonly registros = new Map<string, Registro>();

  constructor(
    private readonly maxTentativas = 5,
    private readonly bloqueioMs = 15 * 60 * 1000,
    private readonly agora: () => number = () => Date.now(),
    private readonly limiteDeRegistros = 10000
  ) {}

  private chave(login: string): string {
    return login.trim().toLowerCase();
  }

  // Segundos que faltam para liberar o login (0 = liberado).
  segundosRestantes(login: string): number {
    const r = this.registros.get(this.chave(login));
    if (!r || r.bloqueadoAte <= this.agora()) return 0;
    return Math.ceil((r.bloqueadoAte - this.agora()) / 1000);
  }

  registrarFalha(login: string): void {
    const k = this.chave(login);
    const atual = this.registros.get(k);
    const agora = this.agora();
    // Recomeça do zero se o bloqueio anterior já expirou ou se a última falha foi há muito tempo.
    const vencido = atual !== undefined && ((atual.bloqueadoAte !== 0 && atual.bloqueadoAte <= agora) || agora - atual.ultimaFalha > this.bloqueioMs);
    const base: Registro = atual === undefined || vencido ? { falhas: 0, bloqueadoAte: 0, ultimaFalha: agora } : atual;
    base.falhas += 1;
    base.ultimaFalha = agora;
    if (base.falhas >= this.maxTentativas) base.bloqueadoAte = agora + this.bloqueioMs;
    this.registros.set(k, base);
    this.limparSeNecessario();
  }

  registrarSucesso(login: string): void {
    this.registros.delete(this.chave(login));
  }

  limpar(): void {
    this.registros.clear();
  }

  // Evita crescer sem limite se alguém tentar muitos logins diferentes.
  private limparSeNecessario(): void {
    if (this.registros.size <= this.limiteDeRegistros) return;
    const agora = this.agora();
    for (const [k, r] of this.registros) {
      if (r.bloqueadoAte !== 0 && r.bloqueadoAte <= agora) this.registros.delete(k);
    }
    // Ainda grande? Remove os mais antigos (o Map mantém a ordem de inserção).
    for (const k of this.registros.keys()) {
      if (this.registros.size <= this.limiteDeRegistros) break;
      this.registros.delete(k);
    }
  }
}

// Instância única usada pelo AuthServico.
export const controleLogin = new ControleTentativasLogin();

// escrito com carinho por Arthur.
