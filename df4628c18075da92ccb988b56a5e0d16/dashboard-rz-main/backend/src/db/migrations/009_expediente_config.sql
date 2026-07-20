-- Config de "tempo util" (business calendar) usada por businessDurationSeconds
-- pra toda metrica de tempo (ociosidade, resolucao, atraso, SLA). Singleton
-- (1 linha, id=1) - dias uteis + janela de expediente ajustaveis sem mexer em
-- codigo. feriado fica vazia por padrao (gancho pra nacionais/municipais de
-- Rondonopolis-MT depois).
CREATE TABLE IF NOT EXISTS expediente_config (
  id             smallint PRIMARY KEY DEFAULT 1,
  dias_uteis     int[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 0=domingo .. 6=sabado
  hora_inicio    time NOT NULL DEFAULT '07:00',
  hora_fim       time NOT NULL DEFAULT '17:00',
  fuso_horario   text NOT NULL DEFAULT 'America/Cuiaba',
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expediente_config_singleton CHECK (id = 1)
);
INSERT INTO expediente_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS feriado (
  data  date PRIMARY KEY,
  nome  text NOT NULL
);
