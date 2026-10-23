import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { prisma } from './lib/prisma';
import { registrarTratamentoErros } from './plugins/erros';
import { registrarAuth } from './plugins/auth';
import { rotasAuth } from './rotas/auth';
import { rotasUsuarios } from './rotas/usuarios';
import { rotasOrganizacoes } from './rotas/organizacoes';
import { rotasLotes } from './rotas/lotes';
import { rotasEquipamentos } from './rotas/equipamentos';
import { rotasRelatorios } from './rotas/relatorios';

export async function construirApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.ambiente !== 'test'
  });

  // Ao fechar o servidor, encerra também a conexão com o banco.
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // Cabeçalhos de segurança (helmet). A política de conteúdo (CSP) fica desligada porque a interface /docs usa scripts próprios.
  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS: só as origens listadas em CORS_ORIGIN. Sem a variável, nenhuma origem externa é liberada.
  await app.register(cors, { origin: config.corsOrigens.length > 0 ? config.corsOrigens : false, exposedHeaders: ['X-Total-Count', 'X-Pagina', 'X-Limite'] });

  // Limite geral de requisições por IP (429 ao exceder). Desligado nos testes automatizados.
  if (config.ambiente !== 'test') {
    await app.register(rateLimit, {
      max: config.limiteRequisicoesPorMinuto,
      timeWindow: '1 minute'
    });
  }

  // Documentação automática da API (gerada a partir dos schemas das rotas).
  // Precisa ser registrada ANTES das rotas. Interface em: /docs
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Greencode API',
        version: '2.0.0',
        description:
          'API REST do sistema de logística reversa de resíduos eletrônicos. ' +
          'Faça login em POST /auth/login, copie o token e clique em "Authorize" para testar as rotas protegidas.'
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
      },
      tags: [
        { name: 'Sistema' },
        { name: 'Autenticação' },
        { name: 'Usuários' },
        { name: 'Organizações' },
        { name: 'Lotes' },
        { name: 'Equipamentos' },
        { name: 'Relatórios' },
        { name: 'Auditoria' }
      ]
    }
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  registrarTratamentoErros(app);
  await registrarAuth(app); // JWT + app.autenticar / app.autorizar (precisa vir ANTES das rotas)

  // Página inicial: leva à documentação interativa.
  app.get('/', { schema: { hide: true } }, async (_req, reply) => reply.redirect('/docs'));

  // Verifica se o servidor e o banco estão respondendo (rota pública).
  app.get('/health', { schema: { tags: ['Sistema'], summary: 'Saúde do servidor e do banco' } }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', banco: 'conectado', hora: new Date().toISOString() };
    } catch (erro) {
      app.log.error(erro);
      return reply.status(503).send({ status: 'erro', banco: 'indisponivel' });
    }
  });

  await app.register(rotasAuth);
  await app.register(rotasUsuarios);
  await app.register(rotasOrganizacoes);
  await app.register(rotasLotes);
  await app.register(rotasEquipamentos);
  await app.register(rotasRelatorios);

  return app;
}

// Oliver passou por aqui.
