<img src="docs/assets/logo_greencode.png" alt="Banner do projeto" style="width:100%;">

# Greencode — AV2

API REST em Node.js e TypeScript para apoiar a **logística reversa de resíduos eletrônicos**: do recebimento do lote na organização até a triagem, o desmonte e a baixa definitiva de cada equipamento, com rastreabilidade e auditoria. É a evolução da AV1 (aplicação de linha de comando com arquivos criptografados), agora como servidor HTTP com banco de dados relacional.

> **Quer executar o projeto do zero?** Siga o [passo a passo](./docs/PASSO-A-PASSO.txt). Este README apresenta o sistema; a execução é explicada somente lá.

## O que o sistema faz

| Área | Funcionalidades |
| --- | --- |
| Organizações e contratos | Cadastro com validação de CNPJ (sem duplicidade), contrato com vigência, cláusulas e valor mensal, correção e exclusão controladas |
| Lotes | Recebimento com nota fiscal e transportadora, data de entrada validada (nunca futura, no máximo 90 dias atrás), triagem e finalização |
| Equipamentos | Tipo, marca, modelo, ano e peso, código de barras gerado pelo sistema, estado físico e status de rastreamento |
| Rastreabilidade | Cada mudança de status ou de estado físico vira uma movimentação, com responsável e justificativa |
| Relatórios e auditoria | Resumos por organização, por status e financeiro, com exportação em CSV (abre no Excel); consulta ao journal de tudo que foi criado, alterado ou excluído |
| Contas e acesso | Login com JWT, cinco papéis com permissões distintas e gestão de contas feita por um superusuário único |

## Papéis

| Papel | Responsabilidade |
| --- | --- |
| `SUPERUSUARIO` | Único no sistema; gerencia as contas de usuário (não opera lotes nem organizações) |
| `ADMINISTRADOR` | Acesso total à operação, sem gerir contas |
| `OPERADOR_CADASTRO` | Organizações e contratos |
| `GESTOR_ALMOXARIFADO` | Lotes, triagem, equipamentos e movimentações |
| `AUDITOR` | Somente consulta, relatórios e auditoria |

## Garantias de integridade

* **Sem atualizações perdidas:** versionamento otimista; alterar ou excluir exige a `versao` lida, e uma versão antiga responde 409.
* **Tudo ou nada:** cada operação roda em transação junto com o registro de auditoria.
* **Histórico preservado:** lote e equipamento só são excluídos antes da triagem; organização com lotes e usuário com histórico apenas são desativados.
* **Sistema nunca sem responsáveis:** sempre existe ao menos um usuário ativo nos papéis essenciais, ninguém desativa ou exclui a si mesmo, e o papel de superusuário não pode ser criado, atribuído nem removido pela API.
* **Acesso protegido:** senhas com bcrypt, papel conferido no banco a cada requisição e bloqueio do login por 15 minutos após 5 senhas erradas.

## Tecnologias

Node.js 20+, TypeScript, Fastify 5, Prisma 6, MySQL 8, JWT (`@fastify/jwt`), bcryptjs, Swagger (OpenAPI) e Vitest.

## Arquitetura

Monólito em camadas, com a regra de negócio separada da interface HTTP e do banco:

```text
Rotas (schema + papel) → Controllers → Serviços (regras + transação) → Repositórios (Prisma) → MySQL
```

Os detalhes do projeto foram listados no documento: [docs/ARQUITETURA.md](./docs/ARQUITETURA.md).

## Estrutura do repositório 

```text
AV2/
├── README.md                 # este arquivo
├── docs/                     # documentação, passo a passo e enunciado
└── greencode-av2/            # código da API
    ├── src/                  # rotas, controllers, serviços, repositórios, regras, segurança...
    ├── prisma/               # modelo do banco, migrações e dados de exemplo
    └── tests/                # testes unitários e de integração
```

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Passo a passo](./docs/PASSO-A-PASSO.txt) | Como baixar, configurar, testar e executar, em linguagem simples |
| [Documentação técnica](./docs/docs.md) | Arquitetura, segurança, validações, persistência, papéis, falhas e testes |
| [Arquitetura e decisões](./docs/ARQUITETURA.md) | Justificativas, trade-offs e limites do monólito |
| [Referência da API](./docs/API.md) | Todas as rotas, permissões e códigos de erro |
| [Checklist dos requisitos](./docs/CHECKLIST.md) | Requisitos da AV2 e onde cada um foi atendido |
| [Enunciado](./docs/AV2.pdf) | Atividade proposta |
