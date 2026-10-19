# Checklist da AV2 — requisito × implementação

Baseado no texto do enunciado da AV2 (que é narrativo e não traz lista numerada de entregas).

| # | Requisito do enunciado | Onde está | Situação |
|---|---|---|---|
| 1 | Servidor HTTP monolítico (Node.js + TypeScript) | `src/server.ts`, `src/app.ts` | ✅ |
| 2 | Camadas Controller → Service → Repository | `src/controllers`, `src/servicos`, `src/repositorios` | ✅ |
| 3 | Fastify (rotas declarativas, hooks, plugins, JSON Schema) | `src/rotas/*`, `src/plugins/*` | ✅ |
| 4 | Porta configurável por variável de ambiente | `PORT` em `.env` → `src/config.ts` | ✅ |
| 5 | Graceful shutdown | `src/server.ts` (SIGINT/SIGTERM → `app.close()` → fecha o banco) | ✅ |
| 6 | `schema.prisma` com Organizacao, Contrato, Lote, Equipamento, Movimentacao | `prisma/schema.prisma` | ✅ |
| 7 | Relacionamentos: Org 0..1 Contrato, Org N Lotes, Lote N Equip., Equip. N Movim. | `schema.prisma` (`organizacaoId @unique` em Contrato) | ✅ |
| 8 | Banco relacional (PostgreSQL ou MySQL) | MySQL 8 | ✅ |
| 9 | Migrações versionadas | `npm run db:migrate` → `prisma/migrations/` | ✅ (gerada ao rodar) |
| 10 | Autenticação JWT com `@fastify/jwt`, token com id e papel | `src/plugins/auth.ts`, `AuthController` | ✅ |
| 11 | Hash de senha com bcrypt | `src/seguranca/senha.ts` (`bcryptjs`) | ✅ |
| 12 | Hook que valida o token e injeta o usuário na requisição | `app.autenticar` → `req.user` | ✅ |
| 13 | Autorização por papel (4 papéis da AV1) | `src/seguranca/permissoes.ts`, `app.autorizar` | ✅ |
| 14 | Transações (`$transaction`) em operações compostas | `LoteServico`, `EquipamentoServico`, `OrganizacaoServico` | ✅ |
| 15 | Versionamento otimista (campo `versao`) | `src/utils/versao.ts` + repositórios | ✅ |
| 16 | Script de seed com massa representativa | `prisma/seed.ts` (`npm run db:seed`) | ✅ |
| 17 | Seed cobre estados variados e os cenários de validação da AV1 | 8 equipamentos em status/estados diferentes, org sem contrato | ✅ |
| 18 | Unicidade no banco: CNPJ e codigoBarrasInterno | `@unique` no `schema.prisma` | ✅ |
| 19 | Constraints/triggers para impedir estados inconsistentes | `prisma/sql/constraints.sql` (CHECK), `triggers-opcional.sql` | ⚠️ aplicar conforme o README |
| 20 | Regras da AV1 preservadas (CNPJ, data 90 dias, desmonte após triagem, justificativa) | `src/validadores`, `src/regras` + testes | ✅ |
| 21 | API documentada | `/docs` (Swagger) e `docs/API.md` | ✅ |
| 22 | Justificar decisões, trade-offs e alternativas rejeitadas | `docs/ARQUITETURA.md` (seção 4) | ✅ |
| 23 | Reflexão sobre limites do monólito | `docs/ARQUITETURA.md` (seção 6) | ✅ |
| 24 | Compatível com Windows 10+ e Ubuntu 24.04+ | Sem dependências nativas; instruções para ambos no README | ⚠️ valide rodando nos dois, se possível |
| 25 | Testes | `tests/unit` (sem banco) e `tests/integration` (API + MySQL) | ✅ |
| 26 | *(extra)* Corrigir e excluir lotes, equipamentos, organizações, contratos e usuários, sem perder o histórico | `PUT`/`DELETE` nas rotas; `docs/ARQUITETURA.md` (4.12) | ✅ |
| 27 | *(extra)* Sempre ao menos 1 usuário ativo em cada papel essencial; sem autoexclusão | `src/regras/usuarios.ts`, `UsuarioServico` (4.13) | ✅ |
| 28 | *(extra)* Superusuário único, dono das contas de usuário; cada usuário altera só a própria senha e o próprio nome; script de recuperação | `src/regras/usuarios.ts`, `UsuarioServico`, `prisma/redefinir-superusuario.ts` | ✅ |
| 29 | *(extra)* Papel conferido no banco a cada requisição; bloqueio de login por tentativas; redefinição de senha | `plugins/auth.ts`, `seguranca/tentativasLogin.ts` | ✅ |
| 30 | *(extra)* Exportação dos relatórios e da auditoria em CSV (`?formato=csv`) | `utils/csv.ts`, `servicos/RelatorioCsv.ts` | ✅ |

## Antes de entregar

- [ ] Rodar `npm run db:reset`, `npm run db:seed` e `npm test` do zero e conferir que passa (unitários + integração).
- [ ] Aplicar as constraints CHECK (item 19) e confirmar que o `npm test` continua passando.
- [ ] Conferir que o `.env` **não** foi para o GitHub (está no `.gitignore`; só o `.env.example` vai).
- [ ] Subir a pasta `prisma/migrations/` junto (é o histórico do banco).
- [ ] Ajustar o README com seu nome/turma, se o professor pedir.
