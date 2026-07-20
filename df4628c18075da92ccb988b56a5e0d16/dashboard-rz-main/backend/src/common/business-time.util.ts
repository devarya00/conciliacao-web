/**
 * Duracao em "tempo util" (business calendar): conta so dias uteis dentro da
 * janela de expediente, no fuso configurado - usado por toda metrica baseada
 * em tempo (ociosidade, resolucao, atraso, SLA) em vez de `fim - inicio`
 * corrido. Puro/sem I/O: config injetada pelo chamador (ExpedienteService
 * carrega de expediente_config/feriado e monta esse objeto).
 */
export interface ExpedienteConfig {
  /** 0=domingo .. 6=sabado (mesma convencao de Date#getUTCDay). */
  diasUteis: Set<number>;
  /** minutos desde 00:00 - ex.: 08:00 -> 480 */
  horaInicioMinutos: number;
  /** minutos desde 00:00 - ex.: 18:00 -> 1080 */
  horaFimMinutos: number;
  /** 'YYYY-MM-DD' no fuso configurado */
  feriados: Set<string>;
  /** IANA tz name, ex.: 'America/Cuiaba' */
  timeZone: string;
}

export const EXPEDIENTE_PADRAO: ExpedienteConfig = {
  diasUteis: new Set([1, 2, 3, 4, 5]), // seg-sex
  horaInicioMinutos: 7 * 60,
  horaFimMinutos: 17 * 60,
  feriados: new Set(),
  timeZone: 'America/Cuiaba',
};

interface DataCivil {
  ano: number;
  mes: number; // 1-12
  dia: number;
}

/** Offset (minutos) de `timeZone` em relacao a UTC no instante `date`. Nao assume DST fixo - le do ICU tzdb do proprio Node. */
function offsetMinutos(date: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const comoUtc = Date.UTC(valor('year'), valor('month') - 1, valor('day'), valor('hour'), valor('minute'), valor('second'));
  return Math.round((comoUtc - date.getTime()) / 60000);
}

/** Data civil (ano/mes/dia) de `date` conforme visto em `timeZone`. */
function dataCivilEm(date: Date, timeZone: string): DataCivil {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return { ano: valor('year'), mes: valor('month'), dia: valor('day') };
}

/** Instante UTC correspondente ao horario local `hhmm` (minutos desde 00:00) na data civil `d`, no fuso `timeZone`. */
function instanteLocal(d: DataCivil, minutosDoDia: number, timeZone: string): Date {
  const h = Math.floor(minutosDoDia / 60);
  const m = minutosDoDia % 60;
  // 1a aproximacao tratando os componentes como UTC, depois corrige pelo offset real do fuso
  // nesse instante (2 passadas cobrem qualquer borda de transicao de fuso, ainda que
  // America/Cuiaba nao tenha DST hoje).
  let aproxUtc = Date.UTC(d.ano, d.mes - 1, d.dia, h, m);
  for (let i = 0; i < 2; i++) {
    const off = offsetMinutos(new Date(aproxUtc), timeZone);
    aproxUtc = Date.UTC(d.ano, d.mes - 1, d.dia, h, m) - off * 60000;
  }
  return new Date(aproxUtc);
}

function diaDaSemana(d: DataCivil): number {
  // triade Y/M/D e "flutuante" (sem fuso) - usar UTC so como epoch neutro pra tirar o dia da semana e correto.
  return new Date(Date.UTC(d.ano, d.mes - 1, d.dia)).getUTCDay();
}

function chaveIso(d: DataCivil): string {
  return `${d.ano}-${String(d.mes).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`;
}

function proximoDia(d: DataCivil): DataCivil {
  const t = new Date(Date.UTC(d.ano, d.mes - 1, d.dia) + 86400000);
  return { ano: t.getUTCFullYear(), mes: t.getUTCMonth() + 1, dia: t.getUTCDate() };
}

function comparaDataCivil(a: DataCivil, b: DataCivil): number {
  return a.ano * 10000 + a.mes * 100 + a.dia - (b.ano * 10000 + b.mes * 100 + b.dia);
}

/**
 * Duracao em segundos entre `start` e `end` contando so dias uteis (nao
 * feriado) dentro da janela de expediente configurada, no fuso configurado.
 * Cruza fim de semana/feriado corretamente: descarta os dias nao uteis
 * inteiros e conta so a fatia dentro do expediente nos dias uteis das pontas
 * (ex.: sexta 17h -> segunda 9h conta so sexta 17h-18h + segunda 8h-9h).
 * end <= start (ou start invalido) -> 0.
 */
export function businessDurationSeconds(
  start: Date | string,
  end: Date | string,
  config: ExpedienteConfig = EXPEDIENTE_PADRAO,
): number {
  const inicio = start instanceof Date ? start : new Date(start);
  const fim = end instanceof Date ? end : new Date(end);
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || fim <= inicio) return 0;

  const { timeZone, diasUteis, feriados, horaInicioMinutos, horaFimMinutos } = config;
  const diaInicio = dataCivilEm(inicio, timeZone);
  const diaFim = dataCivilEm(fim, timeZone);

  let totalMs = 0;
  for (let dia = diaInicio; comparaDataCivil(dia, diaFim) <= 0; dia = proximoDia(dia)) {
    if (!diasUteis.has(diaDaSemana(dia))) continue;
    if (feriados.has(chaveIso(dia))) continue;

    const expedienteInicio = instanteLocal(dia, horaInicioMinutos, timeZone);
    const expedienteFim = instanteLocal(dia, horaFimMinutos, timeZone);

    const janelaInicio = expedienteInicio > inicio ? expedienteInicio : inicio;
    const janelaFim = expedienteFim < fim ? expedienteFim : fim;

    if (janelaFim > janelaInicio) totalMs += janelaFim.getTime() - janelaInicio.getTime();
  }

  return Math.round(totalMs / 1000);
}
