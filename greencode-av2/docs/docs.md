# GREENCODE — Documentação Técnica (AV2)

## 1. Objetivo

O GREENCODE é uma API REST para o núcleo operacional de uma plataforma de logística reversa de resíduos eletrônicos. Na AV2, a aplicação de linha de comando da AV1 foi transformada em um servidor HTTP com persistência em banco de dados relacional.

O sistema controla:

* organizações e contratos;
* lotes;
* equipamentos;
* movimentações e rastreabilidade;
* usuários, autenticação e autorização;
* relatórios, com exportação em CSV;
* auditoria;
* persistência dos dados.

Além do cadastro e da consulta pedidos no enunciado, a API cobre o ciclo de vida completo dos dados: correções, exclusões do que ainda não virou histórico e regras que impedem o sistema de ficar sem responsáveis (veja as seções 5 e 7).

A solução foi estruturada como um monólito, preparado para ser consumido por uma futura interface web (SPA).

---

## 2. Arquitetura

A solução foi organizada em camadas, separando as responsabilidades do sistema:

```text
src/
├── rotas/
├── controllers/
├── servicos/
├── repositorios/
├── regras/
├── validadores/
├── seguranca/
├── plugins/
└── dominio/ erros/ utils/ lib/
```

As principais responsabilidades são:

* **Rotas:** URLs, validação do formato das requisições (JSON Schema) e papel exigido.
* **Controllers:** conversão entre HTTP e chamadas de serviço, sem regras de negócio.
* **Serviços:** execução das regras, transações e registro de auditoria.
* **Repositórios:** consultas ao banco de dados por meio do Prisma.
* **Regras e validadores:** regras puras e validações específicas do domínio.
* **Segurança e plugins:** senhas, matriz de permissões, autenticação JWT e tratamento global de erros.

Fluxo de uma requisição:

```text
Cliente (Swagger / SPA)
      ↓
Rotas (schema + papel)
      ↓
Controllers
      ↓
Serviços (regras + transação)
      ↓
Repositórios (Prisma)
      ↓
MySQL
```

A separação reduz o acoplamento. Como previsto na AV1, a camada de serviços foi mantida e o repositório baseado em arquivos foi substituído por repositórios sobre banco relacional, sem que as regras de negócio dependessem da interface.

A documentação interativa (Swagger) é gerada a partir dos schemas das rotas e fica em `/docs`. Decisões, trade-offs e alternativas rejeitadas estão em [ARQUITETURA.md](./ARQUITETURA.md), e a lista completa de rotas está em [API.md](./API.md).

---

## 3. Orientação a Objetos

A implementação mantém os conceitos de orientação a objetos da AV1:

* **Herança:** `ValidadorCNPJ` e `ValidadorDataEntrada` especializam `Validador`.
* **Abstração:** `Validador` define um contrato comum para validações.
* **Polimorfismo:** diferentes validadores podem ser utilizados por meio da abstração `Validador`.
* **Encapsulamento por camadas:** cada serviço, repositório e controller é uma classe com responsabilidade única (`LoteServico`, `LoteRepositorio`, `LoteController`, entre outras).
* **Hierarquia de erros:** `ErroValidacao`, `NaoAutenticado`, `SemPermissao`, `NaoEncontrado`, `Conflito` e `RegraNegocio` especializam `AppError`, e cada uma carrega seu código HTTP.
* **Composição/agregação:** `Lote` contém equipamentos; `Equipamento` mantém seu histórico de movimentações; `Organizacao` possui contrato. Os relacionamentos são declarados no modelo do banco.

Essa organização permite adicionar novas regras e funcionalidades sem concentrar responsabilidades em uma única classe.

---

## 4. Segurança

A arquitetura de segurança atende aos requisitos definidos para a atividade.

### 4.1 Proteção dos dados

Na AV1, os dados eram protegidos por AES-256-CBC em arquivos. Na AV2, a persistência passou para o banco relacional, e as proteções são:

* consultas parametrizadas pelo Prisma, que evitam SQL injection;
* senhas nunca devolvidas pela API;
* segredos (senha do banco e `JWT_SECRET`) apenas no arquivo `.env`, fora do repositório;
* erros internos sem detalhes técnicos na resposta (o detalhe fica apenas no log do servidor).

Como evolução para um ambiente de produção, recomenda-se criptografia de disco ou volume do banco e HTTPS por meio de um proxy reverso.

### 4.2 Senhas

As senhas não são armazenadas em texto puro.

O sistema utiliza **bcrypt** (biblioteca `bcryptjs`), com salt embutido no próprio hash e custo configurável. O bcrypt é lento de propósito, o que dificulta ataques de força bruta, resolvendo a limitação do SHA-256 registrada na AV1.

A senha deve ter de 8 a 72 caracteres, com ao menos uma letra e um número. No login, quando o usuário não existe, a senha é comparada com um hash fictício, para que o tempo de resposta não revele quais usuários existem.

### 4.3 Autenticação (JWT)

Após a autenticação em `POST /auth/login`, o sistema devolve um **token JWT** assinado, que contém o identificador do usuário e seu papel.

O token possui validade configurável pela variável `JWT_EXPIRES_IN` (padrão de **1 hora**). Depois desse período, as operações protegidas são recusadas com erro 401.

A cada requisição, o sistema também verifica no banco se a conta continua ativa e qual é o papel atual do usuário. Assim, desativar um usuário ou trocar seu papel vale imediatamente, mesmo que o token ainda não tenha expirado.

**Bloqueio por tentativas:** depois de 5 senhas erradas seguidas para o mesmo login, novas tentativas são recusadas por 15 minutos (HTTP 429), mesmo com a senha correta. O superusuário libera o login ao redefinir a senha. Os contadores ficam em memória; em produção, o ideal é um armazenamento compartilhado.

### 4.4 Autorização

A autenticação identifica o usuário e a autorização determina quais operações podem ser executadas de acordo com seu papel.

A checagem é feita antes de qualquer lógica da rota, a partir de uma matriz de permissões única (`src/seguranca/permissoes.ts`).

---

## 5. Validações

O sistema implementa validações em três níveis para impedir a persistência de dados inválidos e estados incompatíveis com as regras de negócio:

1. **Rotas (JSON Schema):** tipos, tamanhos, formatos e valores permitidos.
2. **Serviços e regras:** regras de negócio.
3. **Banco de dados:** unicidade, chaves estrangeiras, enums e constraints CHECK.

Entre as principais validações estão:

* CNPJ deve possuir 14 dígitos e dígitos verificadores válidos;
* CNPJ não pode ser duplicado;
* data de entrada não pode ser futura;
* data de entrada não pode ser anterior a 90 dias;
* equipamento não deve seguir para desmonte antes da triagem do lote;
* piora de duas ou mais categorias do estado físico exige justificativa;
* toda mudança de status exige justificativa;
* lote só pode ser finalizado quando todos os equipamentos tiverem baixa definitiva;
* operações que dependem de uma organização, lote ou equipamento existente devem rejeitar identificadores inexistentes;
* toda alteração ou exclusão exige a `versao` lida (versionamento otimista);
* lote e equipamento só são excluídos antes da triagem; a data de entrada do lote só é corrigida antes da triagem e continua obedecendo à regra dos 90 dias;
* organização que já enviou lotes não é excluída (apenas desativada); o contrato só é removido sem lotes em aberto;
* equipamento com baixa definitiva ou de lote finalizado não é editado;
* conta de usuário com histórico não é excluída (apenas desativada).

Essas validações são concentradas nos validadores, regras e serviços para que possam ser reutilizadas por outras interfaces.

---

## 6. Persistência e Journaling

Os dados são persistidos em um banco relacional **MySQL 8**, acessado por meio do **Prisma ORM**. O modelo possui sete tabelas:

```text
Organizacao 1 ──── 0..1 Contrato
Organizacao 1 ──── N    Lote
Lote        1 ──── N    Equipamento
Equipamento 1 ──── N    Movimentacao
Usuario
JournalTransacao
```

Operações com várias escritas (por exemplo, criar lote com equipamentos e movimentações) são executadas em uma **transação**: ou tudo é gravado, ou nada é. Isso substitui o mecanismo de arquivo temporário com `rename` da AV1.

Para evitar que duas requisições alterem o mesmo registro ao mesmo tempo, cada registro possui um campo `versao` (**versionamento otimista**). O cliente devolve a versão que leu e, se outra alteração ocorreu antes, a API responde com erro 409 (conflito).

As alterações são registradas na tabela `journal_transacoes`, na **mesma transação** da operação, permitindo identificar:

* identificador da operação;
* data e hora;
* operação realizada;
* entidade afetada;
* estado anterior;
* estado posterior;
* usuário responsável.

O journal pode ser consultado por filtros em `GET /auditoria`. A retenção mínima de **180 dias** é garantida porque nenhuma rotina apaga registros; triggers opcionais (`prisma/sql/triggers-opcional.sql`) impedem a edição ou remoção do histórico.

---

## 7. Papéis e controle de acesso

O sistema mantém os quatro papéis da AV1 e acrescenta o **superusuário**:

| Papel                   | Responsabilidade                                    |
| ----------------------- | --------------------------------------------------- |
| **SUPERUSUARIO**        | Único; gerencia as contas de usuário (não opera lotes, equipamentos nem organizações) |
| **ADMINISTRADOR**       | Gestão global da operação, sem gerir contas de usuário |
| **OPERADOR_CADASTRO**   | Organizações e contratos                            |
| **GESTOR_ALMOXARIFADO** | Lotes, triagem e equipamentos                       |
| **AUDITOR**             | Consultas, relatórios e auditoria, sem alteração de dados |

O controle de acesso é realizado em cada rota, antes da execução da regra de negócio, evitando que a autorização dependa exclusivamente do cliente utilizado.

### 7.1 Proteção contra um sistema sem responsáveis

Algumas regras garantem que o sistema nunca fique "trancado":

* **Sempre ao menos 1 usuário ativo** em cada papel essencial (`ADMINISTRADOR`, `OPERADOR_CADASTRO` e `GESTOR_ALMOXARIFADO`): sem administrador ninguém tem acesso total à operação, sem operador ninguém cadastra organizações e sem gestor ninguém recebe lotes. A regra vale ao desativar, excluir ou trocar o papel de um usuário. O `AUDITOR` só consulta e pode ficar sem ninguém.
* **Superusuário único e protegido:** só ele cria, edita, desativa e exclui contas; o papel não é criado nem atribuído pela API, e a conta não é rebaixada, desativada nem excluída. Cada usuário altera apenas a própria senha e o próprio nome. A recuperação de emergência é o script `npm run superusuario:redefinir -- NovaSenha@123`, executado por quem tem acesso ao servidor.
* **Corrida entre administradores:** a checagem usa `SELECT ... FOR UPDATE` dentro da transação, então dois administradores não conseguem desativar um ao outro ao mesmo tempo.
* **Ninguém desativa, exclui ou troca o próprio papel**, evitando se trancar para fora por engano.
* **Histórico preservado:** quem já operou o sistema só é desativado, para que a auditoria continue apontando o responsável.

---

## 8. Cenários de falha

A API trata situações de erro e operações inválidas e responde sempre no formato `{ "erro": "...", "mensagem": "..." }`:

| HTTP | Situação |
| ---- | -------- |
| 400  | corpo ou parâmetros inválidos, CNPJ inválido, data de entrada inválida |
| 401  | usuário ou senha incorretos, token ausente, inválido ou expirado, usuário inativo |
| 403  | usuário sem permissão para a operação |
| 404  | organização, lote ou equipamento inexistente |
| 409  | CNPJ ou código de barras duplicado, versão do registro desatualizada |
| 422  | regra de negócio violada: transição de status fora da sequência permitida, desmonte antes da triagem, justificativa ausente, exclusão de algo que já é histórico, desativação do último usuário ativo de um papel essencial |
| 429  | login bloqueado por 15 minutos após 5 senhas erradas seguidas |
| 500  | falha inesperada (o detalhe fica apenas no log do servidor) |

Nesses casos, a operação é recusada e nenhum dado inválido é gravado.

---

## 9. Testes

Os testes verificam tanto regras isoladas quanto a jornada completa de utilização da API. São executados com **Vitest**.

Entre as validações estão:

* CNPJ;
* data de entrada;
* regras de estado físico e de transição de status;
* autenticação;
* autorização por papel;
* rastreabilidade;
* conflito de versão;
* correção e exclusão de lotes, equipamentos, organizações, contratos e usuários;
* regra de "sempre ao menos 1 usuário ativo" por papel e proteção contra autoexclusão;
* bloqueio de login por tentativas e troca de papel com efeito imediato;
* tratamento de operações inválidas.

A jornada principal de teste é:

```text
Login
      ↓
Organização
      ↓
Lote
      ↓
Equipamento
      ↓
Triagem
      ↓
Múltiplas movimentações
      ↓
Consulta de rastreabilidade
      ↓
Relatório e auditoria
```

Os testes unitários não dependem de banco. Os testes de integração executam a jornada completa sobre a API, com o banco migrado e populado. Para testar à mão, use o Swagger em `/docs`.

### 9.1 Exportação em CSV

Os relatórios (`/relatorios/organizacao/:id`, `/relatorios/status/:status`, `/relatorios/financeiro`) e a consulta de auditoria (`/auditoria`) aceitam o parâmetro `?formato=csv`, que devolve um arquivo para download em vez de JSON. O arquivo abre direto no Excel em português (separador `;`, vírgula decimal, acentos corretos) e traz linha de total nos relatórios. As permissões são as mesmas da rota JSON, e textos que começam com `=`, `+`, `-` ou `@` são neutralizados para o Excel não os executar como fórmula. A geração fica em `src/utils/csv.ts` e `src/servicos/RelatorioCsv.ts` e é coberta por testes unitários e de integração.

---

## 10. Evolução do sistema

### Interface web

A API foi projetada para ser consumida por uma SPA:

```text
Interface Web (SPA)
      ↓
API REST (esta aplicação)
      ↓
Serviços
      ↓
Repositórios
      ↓
Banco relacional
```

### Limites do monólito

O monólito simplifica a implantação e permite transações entre lote, equipamento e movimentação. Por outro lado, a aplicação escala como um todo, e um módulo lento (como relatórios) concorre por recursos com os demais. Os módulos já estão separados por camada e por domínio, o que facilitaria extrair serviços no futuro.

### Segurança

Para uma versão de produção, são previstas as seguintes evoluções:

* limitação de tentativas de login (rate limiting);
* refresh tokens e lista de revogação;
* HTTPS por meio de proxy reverso;
* criptografia dos dados em repouso no banco;
* armazenamento dos segredos em um mecanismo externo de gerenciamento.

---

## 11. Execução

O projeto utiliza **Node.js, TypeScript e MySQL**.

Após criar o banco `greencode` e configurar o arquivo `.env`:

```bash
npm install
```

Criação das tabelas e dados de exemplo:

```bash
npm run db:migrate
npm run db:seed
```

Compilação:

```bash
npm run build
```

Execução:

```bash
npm start
```

Os testes automatizados podem ser executados com:

```bash
npm test
```

A utilização de dependências sem compilação nativa (`bcryptjs`) e de caminhos multiplataforma permite a execução em **Windows 10+ e Ubuntu 24.04+ (e derivados)**, desde que seja utilizada uma versão compatível do Node.js (20 ou superior).
