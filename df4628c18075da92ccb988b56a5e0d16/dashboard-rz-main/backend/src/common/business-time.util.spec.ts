import { businessDurationSeconds, EXPEDIENTE_PADRAO, ExpedienteConfig } from './business-time.util';

const HORA = 3600;

describe('businessDurationSeconds', () => {
  it('sexta 16h -> segunda 8h conta so 1h de sexta + 1h de segunda (2h), nao ~64h corridas', () => {
    const inicio = '2026-06-05T16:00:00-04:00'; // sexta 16h America/Cuiaba (1h antes do fechamento, 17h)
    const fim = '2026-06-08T08:00:00-04:00'; // segunda 8h America/Cuiaba (1h apos abrir, 7h)

    const segundos = businessDurationSeconds(inicio, fim, EXPEDIENTE_PADRAO);

    expect(segundos).toBe(2 * HORA);
    expect(segundos).toBeLessThan(64 * HORA);
  });

  it('dentro do mesmo dia util, dentro do expediente: conta o intervalo cheio', () => {
    const segundos = businessDurationSeconds('2026-06-08T09:00:00-04:00', '2026-06-08T11:30:00-04:00', EXPEDIENTE_PADRAO);
    expect(segundos).toBe(2.5 * HORA);
  });

  it('intervalo comecando antes e terminando depois do expediente: limita a janela 07h-17h (10h)', () => {
    const segundos = businessDurationSeconds('2026-06-08T00:00:00-04:00', '2026-06-08T23:59:00-04:00', EXPEDIENTE_PADRAO);
    expect(segundos).toBe(10 * HORA);
  });

  it('intervalo inteiro dentro do fim de semana: zero', () => {
    // sabado 2026-06-06 10h -> domingo 2026-06-07 15h
    const segundos = businessDurationSeconds('2026-06-06T10:00:00-04:00', '2026-06-07T15:00:00-04:00', EXPEDIENTE_PADRAO);
    expect(segundos).toBe(0);
  });

  it('cruza 2 fins de semana (sexta a sexta seguinte): soma so os 5 dias uteis dentro do expediente inteiro + pontas parciais', () => {
    // sexta 2026-06-05 16h -> sexta 2026-06-12 08h:
    // sex05 16-17h (1h) + seg08..qui11 (4 dias x 10h = 40h) + sex12 07-08h (1h) = 42h
    const segundos = businessDurationSeconds('2026-06-05T16:00:00-04:00', '2026-06-12T08:00:00-04:00', EXPEDIENTE_PADRAO);
    expect(segundos).toBe(42 * HORA);
  });

  it('feriado configurado e excluido igual fim de semana', () => {
    const config: ExpedienteConfig = { ...EXPEDIENTE_PADRAO, feriados: new Set(['2026-06-08']) }; // segunda vira feriado
    // sexta 16h -> segunda 8h: com segunda feriado, conta so a 1h de sexta
    const segundos = businessDurationSeconds('2026-06-05T16:00:00-04:00', '2026-06-08T08:00:00-04:00', config);
    expect(segundos).toBe(1 * HORA);
  });

  it('config customizada de dias uteis/horario (ex.: inclui sabado, expediente 09h-12h)', () => {
    const config: ExpedienteConfig = {
      diasUteis: new Set([1, 2, 3, 4, 5, 6]), // seg-sab
      horaInicioMinutos: 9 * 60,
      horaFimMinutos: 12 * 60,
      feriados: new Set(),
      timeZone: 'America/Cuiaba',
    };
    // sabado 2026-06-06 08h -> sabado 2026-06-06 13h: expediente 9-12h -> 3h
    const segundos = businessDurationSeconds('2026-06-06T08:00:00-04:00', '2026-06-06T13:00:00-04:00', config);
    expect(segundos).toBe(3 * HORA);
  });

  it('fim antes ou igual ao inicio: zero (nao lanca erro, nao retorna negativo)', () => {
    expect(businessDurationSeconds('2026-06-08T10:00:00-04:00', '2026-06-08T09:00:00-04:00', EXPEDIENTE_PADRAO)).toBe(0);
    expect(businessDurationSeconds('2026-06-08T10:00:00-04:00', '2026-06-08T10:00:00-04:00', EXPEDIENTE_PADRAO)).toBe(0);
  });

  it('data invalida: zero', () => {
    expect(businessDurationSeconds('nao-e-data', '2026-06-08T10:00:00-04:00', EXPEDIENTE_PADRAO)).toBe(0);
  });

  it('aceita Date nativo alem de string ISO', () => {
    const inicio = new Date('2026-06-08T09:00:00-04:00');
    const fim = new Date('2026-06-08T11:00:00-04:00');
    expect(businessDurationSeconds(inicio, fim, EXPEDIENTE_PADRAO)).toBe(2 * HORA);
  });

  it('timestamp gravado em UTC (Z) e convertido corretamente pro fuso America/Cuiaba antes de aplicar o expediente', () => {
    // 2026-06-08T12:00:00Z = 08h America/Cuiaba (UTC-4), dentro do expediente 07h-17h
    // 2026-06-08T14:30:00Z = 10h30 America/Cuiaba
    const segundos = businessDurationSeconds('2026-06-08T12:00:00Z', '2026-06-08T14:30:00Z', EXPEDIENTE_PADRAO);
    expect(segundos).toBe(2.5 * HORA);
  });
});
