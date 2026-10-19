<img src="docs/assets/logo_greencode.png" alt="Banner do projeto" style="width:100%;">

# Greencode

API REST monolítica em Node.js e TypeScript para apoiar a gestão da logística reversa de resíduos eletrônicos, com persistência em banco de dados relacional (MySQL). Evolução da AV1 (CLI com arquivos criptografados).

## Documentação
[Acesse a Documentação Técnica!](./docs/docs.md)

Documentos complementares: [Arquitetura e decisões](./docs/ARQUITETURA.md) · [Referência da API](./docs/API.md) · [Checklist dos requisitos](./docs/CHECKLIST.md)

Com o servidor em execução, a documentação interativa (Swagger) fica em `http://127.0.0.1:3000/docs`.

## Requisitos para executar

- Node.js 20 ou superior
- npm
- MySQL Server 8.0.16 ou superior (o MySQL Workbench é apenas o cliente gráfico)
- Windows 10+, Ubuntu 24.04+ ou derivados do Ubuntu

## Instalação e execução

1. Crie o banco de dados (MySQL Workbench ou terminal `mysql`):

```sql
CREATE DATABASE greencode CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Na pasta do projeto (terminal cmd), copie o arquivo de configuração e ajuste `DATABASE_URL` (usuário e senha do MySQL) e `JWT_SECRET` (32 caracteres ou mais):

```text
Windows (cmd):    copy .env.example .env
Ubuntu/Linux:     cp .env.example .env
```

3. Instale as dependências, crie as tabelas e carregue os dados de exemplo:

```text
npm install
npm run setup
```

O comando `npm run setup` aplica as migrações (criando a primeira, se ainda não existir) e executa o seed. Todo o passo a passo, em linguagem simples, está no arquivo `PASSO-A-PASSO.txt`.

4. Execute:

```text
npm run build
npm start
```

Para executar durante o desenvolvimento:

```text
npm run dev
```

O servidor inicia em `http://127.0.0.1:3000`. Teste a saúde da aplicação em `http://127.0.0.1:3000/health`.

## Usuários de exemplo

Criados pelo comando `npm run db:seed`:

| Usuário  | Senha        | Papel                |
| -------- | ------------ | -------------------- |
| superusuario | Super@123 | SUPERUSUARIO (único; gerencia as contas) |
| admin    | Admin@123    | ADMINISTRADOR        |
| operador | Operador@123 | OPERADOR_CADASTRO    |
| gestor   | Gestor@123   | GESTOR_ALMOXARIFADO  |
| auditor  | Auditor@123  | AUDITOR              |

Senhas de exemplo, apenas para desenvolvimento. O superusuário é o único que gerencia as contas (as demais contas operam o sistema).

## Testes

Automatizados (Vitest):

```text
npm run test:unit          # regras e validadores (não precisa de banco)
npm run test:integration   # fluxo completo na API (precisa do banco migrado e do seed)
npm test                   # todos
```

Manuais: abra `http://127.0.0.1:3000/docs` (Swagger) (o passo a passo está no `PASSO-A-PASSO.txt`).

Os testes de integração criam registros novos. Para voltar ao estado inicial, execute `npm run db:reset` (apaga tudo e recria as tabelas) e depois `npm run db:seed`.

## Organização do código

```text
greencode/
├── src/
│   ├── server.ts             # ponto de entrada
│   ├── app.ts                # montagem do Fastify (Swagger, erros, JWT, rotas)
│   ├── config.ts             # leitura e validação do .env
│   ├── rotas/                # URLs, validação (JSON Schema) e permissões
│   ├── controllers/          # interação HTTP
│   ├── servicos/             # regras e operações do sistema
│   ├── repositorios/         # acesso ao banco de dados (Prisma)
│   ├── regras/               # regras puras (estado físico, rastreamento, usuários)
│   ├── validadores/          # validações de entrada
│   ├── seguranca/            # senhas e matriz de permissões
│   ├── plugins/              # autenticação JWT e tratamento de erros
│   └── dominio/ erros/ utils/ lib/
├── prisma/
│   ├── schema.prisma         # modelo do banco
│   ├── seed.ts               # dados de exemplo
│   ├── migrations/           # migrações geradas pelo Prisma
│   └── sql/                  # constraints CHECK e triggers opcionais
├── tests/                    # testes unitários e de integração
├── docs/                     # documentação
├── package.json
└── tsconfig.json
```

## Observação sobre dados

Os dados ficam no banco MySQL `greencode`, e não mais na pasta `data/` da AV1. O arquivo `.env` contém a senha do banco e o segredo do JWT; não o envie para o repositório.

## Rotas

A API aceita e devolve JSON, e as rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`, obtido em `POST /auth/login`. Entre as rotas implementadas estão autenticação, gestão de usuários, cadastro, correção e exclusão de organizações e contratos, criação, triagem, correção e exclusão de lotes, equipamentos e rastreabilidade, relatórios e auditoria. Os relatórios e a auditoria também podem ser baixados em **CSV** (abre no Excel): basta acrescentar `?formato=csv`, por exemplo `/relatorios/financeiro?formato=csv`.

Além do que o enunciado pedia, a API protege o próprio funcionamento: existe um único **superusuário**, o único que cria, edita, desativa e exclui contas (o administrador opera o sistema, mas não gerencia contas); sempre há ao menos um usuário ativo em cada papel essencial (administrador, operador e gestor), ninguém desativa ou exclui a si mesmo, o que já virou histórico (lote triado, organização com lotes, usuário que já operou) só é desativado, e o login é bloqueado por 15 minutos após 5 senhas erradas seguidas. Se o superusuário esquecer a senha, quem tem acesso ao servidor a redefine com `npm run superusuario:redefinir -- NovaSenha@123`. A lista completa, com as permissões de cada papel, está em [docs/API.md](./docs/API.md) e no Swagger (`/docs`).
