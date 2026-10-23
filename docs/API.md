# Greencode AV2 — Referência da API

Documentação interativa (Swagger): `http://127.0.0.1:3000/docs`.

## Convenções

- **Formato:** JSON (`Content-Type: application/json`).
- **Autenticação:** `Authorization: Bearer <token>` (token obtido em `POST /auth/login`).
- **IDs:** UUID (36 caracteres). **Datas:** `AAAA-MM-DD` ou ISO 8601. **Decimais** (`valorMensal`, `pesoQuilogramas`) são devolvidos como texto (ex.: `"1.800"`) para não perder precisão.
- **Versionamento otimista:** toda alteração de organização, contrato, lote, equipamento e papel de usuário exige o campo `versao` lido anteriormente. Versão desatualizada → **409**. Nas exclusões (`DELETE`) a versão vai na URL: `?versao=3`.
- **Exclusões** respondem **204** (sem corpo). Organização e lote têm **soft delete** (`PATCH .../ativo`) e exclusão definitiva **em cadeia** (`DELETE`); equipamento e contrato só têm exclusão definitiva. Conta de usuário que já operou só é desativada: veja "Regras de proteção" abaixo.

### Formato de erro

```json
{ "erro": "REGRA_NEGOCIO", "mensagem": "Justificativa obrigatória para alteração de status." }
```

| HTTP | `erro` | Quando |
|---|---|---|
| 400 | `VALIDACAO` | Corpo/parâmetros inválidos (schema) ou dado inválido (CNPJ, data) |
| 401 | `NAO_AUTENTICADO` | Sem token, token inválido/expirado, senha incorreta, usuário inativo |
| 403 | `SEM_PERMISSAO` | O papel do usuário não permite a operação |
| 404 | `NAO_ENCONTRADO` | Registro inexistente |
| 409 | `CONFLITO` | CNPJ/código duplicado ou versão desatualizada |
| 429 | `MUITAS_TENTATIVAS` | Login bloqueado por 15 minutos após 5 senhas erradas seguidas |
| 422 | `REGRA_NEGOCIO` | Regra violada (transição de status, justificativa, desmonte antes da triagem...) |
| 500 | `ERRO_INTERNO` | Falha inesperada (detalhe apenas no log do servidor) |

## Paginação, proteção e relatórios

- **Paginação:** `GET /usuarios`, `/organizacoes`, `/lotes` e `/equipamentos` aceitam `?pagina=` (padrão 1) e `?limite=` (padrão 100, máximo 500). A resposta continua sendo a lista; o total vem nos cabeçalhos `X-Total-Count`, `X-Pagina` e `X-Limite`.
- **Relatórios** (`/relatorios/organizacao/:id` e `/relatorios/status/:status`) ignoram lotes inativos (soft delete). Com `?incluirInativos=true` eles entram na conta.
- **Código de barras:** é o `id` do equipamento, definido pelo sistema; o campo não pode ser enviado na criação.
- **Limite de requisições:** por IP, por minuto (`RATE_LIMIT_MAX`, padrão 300). Ao exceder, responde **429** `MUITAS_REQUISICOES`.
- **Cabeçalhos de segurança** (helmet) em todas as respostas e **CORS** só para as origens de `CORS_ORIGIN` (sem a variável, nenhuma origem externa é liberada).

## Papéis

| Papel | Pode |
|---|---|
| SUPERUSUARIO | **Único** no sistema e de maior acesso: gerencia as contas (criar, listar, trocar papel e nome, ativar/desativar, redefinir senha, excluir) com exclusividade e também executa tudo o que os outros papéis fazem (organizações, lotes, equipamentos, relatórios e auditoria) |
| ADMINISTRADOR | Tudo na operação do sistema, **menos** gerir contas de usuário |
| OPERADOR_CADASTRO | Criar/alterar/excluir organizações e contratos; consultar tudo (exceto auditoria) |
| GESTOR_ALMOXARIFADO | Lotes, triagem, equipamentos e movimentações (incluindo corrigir e excluir); consultar tudo (exceto auditoria) |
| AUDITOR | Somente consultas, relatórios e auditoria |

## Rotas

`L` = qualquer usuário autenticado · `S` = superusuário · `A` = admin · `C` = superusuário/admin/operador · `G` = superusuário/admin/gestor · `AU` = superusuário/admin/auditor (o superusuário acessa todas as rotas)

### Sistema e autenticação

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | público | Saúde do servidor e do banco |
| POST | `/auth/login` | público | `{usuario, senha}` → `{token, tipo, expiraEm, usuario}` |
| GET | `/auth/me` | L | Dados do usuário logado (`id`, `usuario`, `nome`, `papel`, `versao`) |
| PUT | `/auth/perfil` | L | `{nome, versao}` — o usuário altera o **próprio** nome |
| POST | `/auth/alterar-senha` | L | Altera a **própria** senha: `{senhaAtual, novaSenha}` (8–72 caracteres, letra + número) |

### Usuários

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/usuarios` | S | Lista usuários (sem hash de senha). Filtros `papel`, `ativo` |
| GET | `/usuarios/:id` | S | Detalha um usuário |
| POST | `/usuarios` | S | `{usuario, senha, papel}` |
| PUT | `/usuarios/:id` | S | `{papel, versao}` — troca o papel (vale na hora, mesmo com token antigo) |
| PATCH | `/usuarios/:id/ativo` | S | `{ativo}` — ativa ou desativa a conta |
| POST | `/usuarios/:id/redefinir-senha` | S | `{novaSenha}` — também libera um login bloqueado por tentativas |
| DELETE | `/usuarios/:id` | S | Exclui só conta **sem histórico** (nunca usou o sistema); as demais devem ser desativadas |

### Organizações e contratos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/organizacoes` | L | Filtros `ativo`, `busca` (razão social ou CNPJ) |
| GET | `/organizacoes/:id` | L | Detalhe com contrato e `contratoVigente` |
| POST | `/organizacoes` | C | Cria (contrato opcional). Valida CNPJ; 409 se repetido |
| PUT | `/organizacoes/:id` | C | Atualiza dados (exige `versao`; CNPJ não muda) |
| PATCH | `/organizacoes/:id/ativo` | C | `{ativo, versao}` — **soft delete**. Ao inativar, inativa em cadeia todos os lotes (e seus equipamentos); sem restrição por contrato ou lotes em aberto. Reativar não reativa os lotes |
| PUT | `/organizacoes/:id/contrato` | C | Cria ou substitui o contrato (substituir exige `versao` do contrato) |
| PATCH | `/organizacoes/:id/contrato/renovar` | C | `{novoVencimento, versao}` (deve ser posterior ao atual) |
| DELETE | `/organizacoes/:id/contrato?versao=` | C | Remove o contrato (versão do contrato). Sem contrato ativo a organização não recebe novos lotes |
| DELETE | `/organizacoes/:id?versao=` | C | Exclusão definitiva **em cadeia**: remove contrato, lotes, equipamentos e movimentações (uma transação; tudo no journal) |

### Lotes

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/lotes` | L | Filtros `organizacaoId`, `status`, `ativo`, `inicio`, `fim` |
| GET | `/lotes/:id` | L | Lote + equipamentos + `resumo` (quantidade, peso total, texto de triagem) |
| POST | `/lotes` | G | Cria o lote (e equipamentos opcionais) numa transação. Data de entrada: hoje até 90 dias atrás. A organização precisa estar ativa e ter **contrato ativo** (422) |
| POST | `/lotes/:id/equipamentos` | G | `{versao, equipamentos[]}` — só em lote `RECEBIDO` |
| PUT | `/lotes/:id` | G | Corrige `notaFiscal`, `transportadora`, `observacoes`, `dataEntrada` (esta só antes da triagem, regra dos 90 dias) + `versao`. Lote finalizado não muda |
| PATCH | `/lotes/:id/ativo` | G | `{ativo, versao}` — **soft delete** do lote (e dos seus equipamentos). Lote inativo não aceita alterações; reativar exige a organização ativa |
| DELETE | `/lotes/:id?versao=` | G | Exclusão definitiva em cadeia: remove o lote, equipamentos e movimentações, em qualquer status |
| POST | `/lotes/:id/triagem` | G | `{versao}` — lote vai a `TRIAGEM_CONCLUIDA`; equipamentos a `EM_TRIAGEM` |
| — | *(status do lote)* | — | Não há rota manual: o status do lote é **derivado** dos equipamentos. Só muda quando todos têm o mesmo status: todos `AGUARDANDO_TRIAGEM` → `RECEBIDO`; todos `EM_TRIAGEM` → `TRIAGEM_CONCLUIDA`; todos no mesmo status de desmonte/destinação → `ENCAMINHADO`; todos `BAIXA_DEFINITIVA` → `FINALIZADO`. Status misturados mantêm o lote como está |

### Equipamentos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/equipamentos` | L | Filtros `status`, `tipo`, `loteId` + paginação |
| GET | `/equipamentos/:id` | L | Detalhe + `proximosStatusPermitidos` |
| GET | `/equipamentos/:id/rastreamento` | L | Histórico completo de movimentações |
| PUT | `/equipamentos/:id` | G | Corrige `tipo`, `marca`, `modelo`, `anoFabricacao`, `pesoQuilogramas` + `versao`. O código de barras é o próprio `id` do equipamento e não muda. Não vale após baixa definitiva ou lote finalizado |
| DELETE | `/equipamentos/:id?versao=` | G | Exclusão definitiva do equipamento e das movimentações dele, em qualquer fase. Equipamento de lote inativo não pode ser alterado (422) |
| PATCH | `/equipamentos/:id/status` | G | `{status, justificativa, versao}` — valida transição e registra movimentação |
| PATCH | `/equipamentos/:id/estado-fisico` | G | `{estadoFisico, justificativa?, versao}` — piora de 2+ categorias exige justificativa |
| POST | `/equipamentos/:id/movimentacoes` | G | `{destino, observacao?}` — movimentação física sem mudar status |

**Transições de status do equipamento**

```text
AGUARDANDO_TRIAGEM → EM_TRIAGEM
EM_TRIAGEM         → AGUARDANDO_DESMONTE | MATERIAL_RECICLAVEL | DESCARTE_SEGURO
AGUARDANDO_DESMONTE→ EM_DESMONTE
EM_DESMONTE        → PECAS_REAPROVEITADAS | MATERIAL_RECICLAVEL | DESCARTE_SEGURO
PECAS_REAPROVEITADAS | MATERIAL_RECICLAVEL | DESCARTE_SEGURO → BAIXA_DEFINITIVA
```

Ir para `AGUARDANDO_DESMONTE`/`EM_DESMONTE` só é permitido quando o lote já concluiu a triagem. Toda mudança exige justificativa.

**Ordem dos estados físicos (do melhor ao pior):** `NOVO`, `BOM_ESTADO`, `USADO_LEVE`, `USADO_MODERADO`, `DANIFICADO_LEVE`, `DANIFICADO_GRAVE`, `INSERVIVEL`.

### Relatórios e auditoria

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/relatorios/organizacao/:id` | L | Lotes, equipamentos, peso e contagem por status no período (`inicio`, `fim`; padrão: 90 dias) |
| GET | `/relatorios/status/:status` | L | Equipamentos em um status de rastreamento. Ignora lotes inativos (`?incluirInativos=true` inclui) |
| GET | `/relatorios/financeiro` | L | Valor mensal dos contratos vigentes no período |
| GET | `/auditoria` | AU | Journal: filtros `entidade`, `entidadeId`, `usuario`, `inicio`, `fim`, `limite` (máx. 500) |

**Exportação em CSV:** todos os relatórios acima e `/auditoria` aceitam `?formato=csv` (por exemplo `/relatorios/financeiro?formato=csv`). A resposta vira um arquivo para download, com separador `;`, números com vírgula decimal e acentos corretos, que abre direto no Excel em português do Brasil. Sem o parâmetro, a resposta continua em JSON. As permissões são as mesmas da rota, e o texto que começa com `=`, `+`, `-` ou `@` é neutralizado para o Excel não executá-lo como fórmula.

## Regras de proteção (pensadas para o sistema nunca ficar "trancado")

| Regra | Resposta |
|---|---|
| Só o **superusuário** gerencia contas; o administrador (e os demais papéis) recebem 403 em `/usuarios` | 403 |
| O superusuário é **único**: o papel `SUPERUSUARIO` não é criado nem atribuído pela API, e a conta não é rebaixada, desativada nem excluída | 400 / 422 |
| Cada usuário altera só a própria senha (`/auth/alterar-senha`, exige a senha atual) e o próprio nome (`/auth/perfil`); o superusuário também não redefine a própria senha por `/usuarios` | 422 |
| Sempre existe ao menos **1 usuário ativo** em cada papel essencial: `ADMINISTRADOR`, `OPERADOR_CADASTRO` e `GESTOR_ALMOXARIFADO` (o `AUDITOR` só consulta e pode ficar vazio). Vale para desativar, excluir e trocar o papel | 422 |
| Ninguém desativa, exclui nem troca o próprio papel | 422 |
| O papel usado nas permissões é o do banco, não o do token: trocar ou desativar tem efeito imediato | 403 / 401 |
| Conta que já operou o sistema (tem histórico de auditoria) só pode ser desativada | 422 |
| Lote só é criado em organização **ativa** e com **contrato ativo** (vigente) | 422 |
| Lote inativo (soft delete) e seus equipamentos ficam só para consulta até a reativação; um lote só é reativado com a organização ativa | 422 |
| 5 senhas erradas seguidas para o mesmo login bloqueiam novas tentativas por 15 minutos | 429 |
| Toda criação, correção e exclusão grava antes/depois no journal (`GET /auditoria`) | — |

## Exemplo rápido

```bash
# 1) login
curl -X POST http://127.0.0.1:3000/auth/login -H "Content-Type: application/json" \
  -d '{"usuario":"gestor","senha":"Gestor@123"}'

# 2) usar o token
curl http://127.0.0.1:3000/lotes -H "Authorization: Bearer SEU_TOKEN"
```

(No `cmd` do Windows use `curl.exe` e escape as aspas do JSON: `-d "{\"usuario\":\"gestor\",\"senha\":\"Gestor@123\"}"`.)
