-- A19 e A20 compartilhavam o mesmo avaliador (custeio_exclusivo), retornando
-- texto e valor identicos - sao passos distintos no roteiro do escritorio.
-- A19 ganha avaliador proprio (reporta total de custos + contas componentes,
-- sem afirmar "unico"). A20 volta a nao_verificavel ate' o criterio real de
-- "DRE - Custos II" ser mapeado com o escritorio.
UPDATE conferencia_passo SET regra_automatica = 'dre_custo_total' WHERE codigo = 'A19';
UPDATE conferencia_passo SET regra_automatica = 'custos_ii_nao_mapeado' WHERE codigo = 'A20';
