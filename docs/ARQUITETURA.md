# Greencode AV2 — Arquitetura e decisões

## 1. Visão geral

A AV1 era uma aplicação de linha de comando com persistência em arquivos criptografados.
A AV2 transforma o Greencode em um **monólito servidor**: uma única aplicação Node.js que expõe uma **API RESTful**
e persiste os dados em um **banco relacional (MySQL)**, preparada para ser consumida por um front-end SPA.

```text
 Cliente (SPA / REST client)
        │  HTTP + JSON  (Authorization: Bearer <JWT>)
        ▼
┌─────────────────────────────────────────────────────────┐
│  Fastify                                                 │
│  ┌─────────┐   ┌─────────────┐   ┌──────────┐   ┌──────────────┐
│  │  Rotas  │ → │ Controllers │ → │ Services │ → │ Repositórios │ → Prisma → MySQL
│  │ schema  │   │ HTTP↔objeto │   │ regras + │   │ acesso a     │
│  │ + papel │   │             │   │ transação│   │ dados        │
│  └─────────┘   └─────────────┘   └──────────┘   └──────────────┘
│  Plugins: JWT/autorização · tratamento global de erros · Swagger
└─────────────────────────────────────────────────────────┘
```

**Controller → Service → Repository** (padrão sugerido no enunciado):

| Camada | Responsabilidade | Não faz |
|---|---|---|
| Rotas | URL, JSON Schema de validação, papel exigido | Lógica |
| Controller | Ler a requisição, chamar o service, escolher o status HTTP | Regra de negócio, SQL |
| Service | Regras de negócio, validações, transações, auditoria | Conhecer HTTP |
| Repository | Consultas via Prisma Client | Regra de negócio |

## 2. Do CLI (AV1) para a API (AV2)

| AV1 | AV2 |
|---|---|
| `RepositorioArquivo` (arquivos AES-256) | Repositórios Prisma sobre MySQL |
| Sessão em memória com expiração | JWT stateless (id + papel), validade configurável |
| SHA-256 + salt | bcrypt (salt embutido e custo configurável) |
| `Credencial` | Tabela `usuarios` |
| `Journal` em arquivo com rotação | Tabela `journal_transacoes`, gravada **na mesma transação** da operação |
| `ValidadorCNPJ`, `ValidadorDataEntrada` | Mantidos (mesma lógica), usados nos services |
| Regras de estado físico e de desmonte | Mantidas em `src/regras/` (funções puras, testadas sem banco) |
| Menu por papel na CLI | `app.autorizar(...papeis)` em cada rota |
| Operações atômicas por arquivo temporário + rename | Transações ACID (`$transaction`) |

## 3. Modelo de dados

```text
Organizacao 1 ──── 0..1 Contrato
Organizacao 1 ──── N    Lote
Lote        1 ──── N    Equipamento
Equipamento 1 ──── N    Movimentacao
Usuario                       JournalTransacao (auditoria)
```

- `Contrato.organizacaoId` é **único**: garante no máximo um contrato por organização (relação 1–0..1).
- **Unicidade no banco:** `Organizacao.cnpj` (14 dígitos, sem máscara), `Equipamento.codigoBarrasInterno`,
  `Equipamento(loteId, posicaoNoLote)`, `Usuario.usuario`. A aplicação verifica antes (mensagem amigável) e o banco
  garante depois (proteção contra corrida entre requisições).
- **Enums nativos** para status, tipo e estado físico: o banco recusa valores fora do domínio.
- **Constraints CHECK** (`prisma/sql/constraints.sql`) e triggers opcionais de imutabilidade do histórico.
- Valores monetários e de peso usam `DECIMAL` (sem erro de ponto flutuante).

## 4. Decisões, trade-offs e alternativas rejeitadas

### 4.1 Monólito em vez de microsserviços
**Escolha:** uma aplicação, um banco. **Por quê:** estágio inicial do negócio — implantação simples, depuração direta,
transações ACID entre lote, equipamento e movimentação sem coordenação distribuída. **Custo:** escala como um todo e
um deploy afeta tudo. **Mitigação:** módulos já separados por camada e por domínio (organizações, lotes, equipamentos,
relatórios), o que facilitaria extrair serviços no futuro. **Rejeitada:** microsserviços — complexidade operacional
(rede, consistência eventual, observabilidade) sem necessidade atual.

### 4.2 Autenticação com JWT
A API é stateless: qualquer instância valida o token sem compartilhar estado, e o token carrega id e papel.
**Custo:** um JWT não pode ser "cancelado" antes de expirar. **Mitigação:** validade curta (`JWT_EXPIRES_IN`, padrão 1 h)
e verificação do campo `ativo` e do papel do usuário no banco a cada requisição — desativar a conta ou trocar o papel
vale imediatamente. **Evolução:** refresh tokens e lista de revogação.

### 4.3 Senhas com bcrypt
As senhas são guardadas com `bcryptjs` (JavaScript puro): o salt vem embutido no hash, o custo é ajustável e não há
compilação nativa, o que garante o mesmo comportamento em Windows e Ubuntu. O login também compara contra um hash
fictício quando o usuário não existe, para o tempo de resposta não revelar quais logins existem.

### 4.4 Concorrência: versionamento otimista em vez de bloqueio pessimista
**Escolha:** cada registro tem `versao`; o cliente devolve a versão lida e o `UPDATE ... WHERE id = ? AND versao = ?`
só afeta a linha se ninguém alterou antes (senão **409 Conflito**). **Por quê:** conflitos são raros neste domínio,
não segura locks de banco durante a "reflexão" do usuário e funciona bem com API stateless. **Custo:** o cliente
precisa tratar o 409 e recarregar. **Rejeitado:** `SELECT ... FOR UPDATE` (pessimista) — locks longos e risco de
deadlock sem ganho aqui.

### 4.5 Transações
Operações com múltiplas escritas usam `prisma.$transaction`, para confirmar tudo ou nada:
criar lote + equipamentos + movimentações + journal; processar triagem (lote + todos os equipamentos + movimentações);
mudar status do equipamento + registrar movimentação; criar organização + contrato. O registro de **auditoria entra
na mesma transação**: não existe alteração sem rastro, nem rastro de alteração que falhou.

### 4.6 Auditoria no banco em vez de arquivo
O journal da AV1 (arquivo com rotação em 10 MB) vira a tabela `journal_transacoes` com antes/depois em JSON, usuário
e data, consultável por filtro (`GET /auditoria`). A retenção mínima de 180 dias passa a ser política de
administração do banco (nenhuma rotina apaga registros); triggers opcionais impedem edição/remoção.

### 4.7 Autorização por papel
Os 4 papéis da AV1 foram mantidos (matriz em `src/seguranca/permissoes.ts`). A checagem fica no `preHandler` da
rota, antes de qualquer lógica: o auditor só lê; operador cadastra organizações/contratos; gestor cuida de lotes e
equipamentos; administrador faz tudo na operação; o superusuário (único) é o dono das contas de acesso e não opera lotes,
equipamentos nem organizações (separação de funções).

### 4.8 Validação em três camadas
1. **JSON Schema** nas rotas: tipos, tamanhos, enums, formatos (rejeita lixo antes de chegar ao service).
2. **Services/regras:** regras de negócio (CNPJ, janela de 90 dias, transições de status, justificativas).
3. **Banco:** unicidade, FKs, enums e CHECK — última linha de defesa.

### 4.9 Ciclo de vida completo dos dados: corrigir e excluir sem perder o histórico
O enunciado pedia o essencial (cadastrar, consultar, avançar status). Um sistema de uso real também precisa **corrigir
um erro de digitação** e **desfazer um cadastro feito por engano**. A regra adotada foi: *organização e lote podem ser inativados
(soft delete) ou excluídos de vez, sempre em cadeia; a trilha de auditoria preserva o que foi feito.*

| Entidade | Corrigir | Inativar (soft delete) | Excluir (definitivo) |
|---|---|---|---|
| Organização | dados cadastrais | sim: inativa em cadeia todos os lotes e equipamentos; sem restrição por contrato ou lotes em aberto | sim, em cadeia: contrato, lotes, equipamentos e movimentações |
| Lote | nota fiscal, transportadora, observações; data de entrada só antes da triagem (regra dos 90 dias continua valendo) | sim: o lote e seus equipamentos ficam só para consulta | sim, em qualquer status, levando equipamentos e movimentações |
| Equipamento | tipo, marca, modelo, ano, peso (nunca o código de barras); status e estado físico têm rotas próprias, com justificativa | não (é tratado como inativo quando o lote está inativo) | sim, em qualquer fase |
| Contrato | substituir/renovar | não | sim; sem contrato ativo a organização deixa de receber novos lotes |
| Usuário | papel; senha (redefinida pelo superusuário); nome | desativar | só sem histórico; senão, desativar |

**Soft delete.** Organização e lote ganham a marca `ativo`. Inativar não apaga nada: o registro continua no banco e na
auditoria, mas deixa de aceitar alterações (422) até ser reativado. Inativar a organização desce em cadeia para todos
os seus lotes (`UPDATE` único dentro da transação); reativar a organização **não** reativa os lotes, que voltam um a um
e só com a organização ativa. Equipamentos não têm coluna própria: valem como inativos enquanto o lote estiver inativo.

**Exclusão em cadeia.** Excluir uma organização remove, numa única transação e nesta ordem, movimentações →
equipamentos → lotes → contrato → organização. Excluir um lote leva seus equipamentos e movimentações. Se qualquer passo
falhar (por exemplo, versão desatualizada), nada é removido.

**Contrato e lote.** Lote só é criado em organização ativa e com contrato vigente; a ausência de contrato não torna a
organização inativa, apenas impede novos lotes.

Toda exclusão exige a `versao` lida (`?versao=`), roda em transação e grava o estado anterior de cada item removido
no journal — o dado some da tabela, mas **a exclusão continua auditável**.

### 4.10 Proteção do próprio sistema (nunca ficar "trancado")
- **Mínimo de 1 ativo por papel essencial.** `ADMINISTRADOR`, `OPERADOR_CADASTRO` e `GESTOR_ALMOXARIFADO` sempre têm
  pelo menos um usuário ativo: sem administrador ninguém tem acesso total à operação; sem operador ninguém cadastra organizações; sem
  gestor ninguém recebe lotes. A regra (`src/regras/usuarios.ts`) vale para desativar, excluir e trocar o papel.
  O `AUDITOR` só lê, então o sistema opera sem ele.
- **Corrida entre dois administradores.** Dois admins sendo desativados um ao outro ao mesmo tempo poderiam zerar o papel.
  Por isso a checagem usa `SELECT ... FOR UPDATE` nos usuários ativos do papel, dentro da transação: o segundo pedido
  espera o primeiro terminar e então enxerga o resultado já confirmado.
- **Superusuário único.** Gerir contas é função exclusiva do papel `SUPERUSUARIO`, que existe uma só vez: nasce no
  seed (`superusuario`) e a API nunca cria, atribui, rebaixa, desativa ou exclui esse papel (`exigirPapelAtribuivel` e
  `exigirNaoSuperusuario`, em `src/regras/usuarios.ts`). Assim sempre há quem gerencie as contas, e o administrador
  comprometido não consegue criar contas nem se promover. Cada usuário só altera a própria senha (exige a senha
  atual) e o próprio nome. **Se o superusuário esquecer a senha**, quem tem acesso ao servidor roda
  `npm run superusuario:redefinir -- NovaSenha@123`, que também reativa a conta e grava no journal.
- **Sem autoexclusão.** Ninguém desativa, exclui nem troca o próprio papel (evita se trancar para fora por engano).
- **Papel sempre fresco.** O papel usado nas permissões é lido do banco a cada requisição. Se o superusuário rebaixa alguém,
  vale na hora — e não só quando o token (válido por até 1 h) expirar.
- **Bloqueio por tentativas.** 5 senhas erradas seguidas para o mesmo login bloqueiam novas tentativas por 15 minutos
  (HTTP 429). Os contadores ficam em memória (simples, sem tabela nova); reiniciar o servidor zera os bloqueios.
  O superusuário também libera o login ao redefinir a senha. **Custo:** um atacante pode travar o login de outra pessoa
  de propósito; em produção, combinar com limite por IP (rate limiting) e armazenamento compartilhado (Redis).

### 4.11 Exportação dos relatórios em CSV
Os relatórios e a auditoria aceitam `?formato=csv`. **Decisão:** o mesmo endpoint serve JSON ou CSV, em vez de rotas
novas; o serviço de relatório continua devolvendo o mesmo objeto e a conversão fica em funções puras
(`RelatorioCsv.ts`), então a regra de negócio e as permissões não mudam. **Formato:** separador `;`, vírgula decimal e
BOM UTF-8, porque é o que o Excel em português abre sem assistente de importação; CRLF e aspas conforme a RFC 4180.
**Segurança:** texto que começa com `=`, `+`, `-` ou `@` recebe um apóstrofo na frente (injeção de fórmula em CSV).

## 5. Segurança

- Senhas com bcrypt; nunca retornadas pela API (`select` explícito).
- JWT assinado (`JWT_SECRET` ≥ 32 caracteres, validado na inicialização); segredos só em `.env` (fora do Git).
- Consultas parametrizadas pelo Prisma (sem concatenação de SQL).
- Erros internos não vazam detalhes (resposta genérica 500; detalhe só no log).
- Autorização por papel em todas as rotas protegidas; contas podem ser desativadas; o papel é conferido no banco a cada requisição.
- Bloqueio temporário do login após 5 falhas seguidas (429) e redefinição de senha pelo superusuário.
- **Limitações conhecidas:** sem *rate limiting* por IP (só o bloqueio por login, em memória), sem HTTPS embutido (use proxy reverso em produção),
  sem refresh token, sem criptografia de dados em repouso no banco (na AV1 os arquivos eram AES-256; em produção,
  use criptografia de disco/volume do banco).

## 6. Limites do monólito (reflexão)

- Escala vertical e horizontal da aplicação inteira, não por módulo.
- Um módulo lento (relatórios) concorre por recursos com os demais — candidato a réplica de leitura/serviço próprio.
- Acoplamento via banco único: mudar uma tabela afeta vários módulos.
- Quando reconsiderar: múltiplos times, necessidades de escala muito diferentes por módulo, integrações pesadas
  (mensageria, certificados ambientais negociáveis) ou exigências de disponibilidade independentes.

## 7. Compatibilidade

Node.js 20+ (Windows 10+, Ubuntu 24.04+ e derivados). Sem dependências nativas (por isso `bcryptjs`);
o Prisma baixa o binário correto do sistema operacional na instalação. Variáveis de ambiente por `.env`.

## 8. Evoluções futuras

Front-end SPA consumindo esta API; refresh tokens; rate limiting por IP; paginação nas listagens e relatórios extensos; CI com testes;
imagem Docker da aplicação; exportação de relatórios em PDF (o CSV já existe); certificados de compensação ambiental.
