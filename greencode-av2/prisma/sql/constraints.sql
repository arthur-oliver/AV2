-- Constraints CHECK adicionais (requer MySQL 8.0.16 ou superior).
-- Complementam as validações da aplicação: mesmo que alguém grave direto no banco,
-- estados inconsistentes são recusados.
-- Como aplicar: veja o README (seção "Constraints no banco").

ALTER TABLE equipamentos ADD CONSTRAINT chk_equip_peso    CHECK (pesoQuilogramas > 0);
ALTER TABLE equipamentos ADD CONSTRAINT chk_equip_ano     CHECK (anoFabricacao BETWEEN 1970 AND 2100);
ALTER TABLE equipamentos ADD CONSTRAINT chk_equip_posicao CHECK (posicaoNoLote >= 1);
ALTER TABLE equipamentos ADD CONSTRAINT chk_equip_versao  CHECK (versao >= 1);

ALTER TABLE contratos    ADD CONSTRAINT chk_contrato_valor  CHECK (valorMensal >= 0);
ALTER TABLE contratos    ADD CONSTRAINT chk_contrato_datas  CHECK (dataVencimento > dataAssinatura);
ALTER TABLE contratos    ADD CONSTRAINT chk_contrato_versao CHECK (versao >= 1);

ALTER TABLE organizacoes ADD CONSTRAINT chk_org_cnpj   CHECK (cnpj REGEXP '^[0-9]{14}$');
ALTER TABLE organizacoes ADD CONSTRAINT chk_org_versao CHECK (versao >= 1);

ALTER TABLE lotes        ADD CONSTRAINT chk_lote_versao CHECK (versao >= 1);
ALTER TABLE usuarios     ADD CONSTRAINT chk_usuario_versao CHECK (versao >= 1);
