import { construirApp } from './app';
import { config } from './config';

async function iniciar() {
  const app = await construirApp();

  // Graceful shutdown: para de aceitar novas conexões, finaliza as ativas e fecha o banco.
  let encerrando = false;
  const encerrar = async (sinal: string) => {
    if (encerrando) return;
    encerrando = true;
    app.log.info(`Sinal ${sinal} recebido. Encerrando o servidor...`);
    try {
      await app.close();
      process.exit(0);
    } catch (erro) {
      app.log.error(erro);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void encerrar('SIGINT')); // Ctrl+C (Windows e Linux)
  process.on('SIGTERM', () => void encerrar('SIGTERM')); // Linux/Docker

  try {
    await app.listen({ port: config.porta, host: config.host });
  } catch (erro) {
    app.log.error(erro);
    process.exit(1);
  }
}

void iniciar();

// este trecho tem o dedo do Rossi.
