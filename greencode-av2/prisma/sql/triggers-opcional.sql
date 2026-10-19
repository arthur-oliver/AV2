-- OPCIONAL: torna o histórico imutável (equivalente ao "log imutável" do journal da AV1).
-- Bloqueia UPDATE e DELETE nas tabelas de movimentações e de journal.
-- ATENÇÃO: criar triggers exige o privilégio TRIGGER (e, com log binário ativo, privilégio SUPER ou
-- log_bin_trust_function_creators=1). Com o usuário root de uma instalação local, funciona normalmente.
-- Aplique pelo MySQL Workbench (executar o script inteiro).

CREATE TRIGGER trg_movimentacoes_sem_update BEFORE UPDATE ON movimentacoes
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Movimentacoes sao imutaveis.';

CREATE TRIGGER trg_movimentacoes_sem_delete BEFORE DELETE ON movimentacoes
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Movimentacoes sao imutaveis.';

CREATE TRIGGER trg_journal_sem_update BEFORE UPDATE ON journal_transacoes
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'O journal e imutavel.';

CREATE TRIGGER trg_journal_sem_delete BEFORE DELETE ON journal_transacoes
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'O journal e imutavel.';
