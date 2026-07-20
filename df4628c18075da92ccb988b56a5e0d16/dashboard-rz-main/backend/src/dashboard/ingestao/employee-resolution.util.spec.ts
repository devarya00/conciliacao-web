import { AliasEntry, matchAlias, normalizeAliasText, tokenSortRatio } from './employee-resolution.util';

describe('normalizeAliasText', () => {
  it('minusculiza, remove acento e colapsa espacos', () => {
    expect(normalizeAliasText('  Lísamára  Souza  ')).toBe('lisamara souza');
  });

  it('remove stopwords de departamento', () => {
    expect(normalizeAliasText('Lisa Dp Fiscal')).toBe('lisa fiscal');
    expect(normalizeAliasText('Setor de Contabil')).toBe('contabil');
  });

  it('trata pontuacao como separador de token', () => {
    expect(normalizeAliasText('Dep. Fiscal e Contábil.5')).toBe('dep fiscal e contabil 5');
  });

  it('string vazia/nula vira string vazia', () => {
    expect(normalizeAliasText('')).toBe('');
    expect(normalizeAliasText(null)).toBe('');
    expect(normalizeAliasText(undefined)).toBe('');
  });
});

describe('tokenSortRatio', () => {
  it('100 pra strings identicas', () => {
    expect(tokenSortRatio('lisa fiscal', 'lisa fiscal')).toBe(100);
  });

  it('ignora ordem dos tokens', () => {
    expect(tokenSortRatio('fiscal lisa', 'lisa fiscal')).toBe(100);
  });

  it('100 quando ambas vazias', () => {
    expect(tokenSortRatio('', '')).toBe(100);
  });

  it('score baixo pra strings bem diferentes', () => {
    expect(tokenSortRatio('lisa fiscal', 'joao pessoal')).toBeLessThan(50);
  });
});

function alias(overrides: Partial<AliasEntry>): AliasEntry {
  return {
    departamentoNormalizado: 'fiscal',
    aliasNormalizado: 'lisa fiscal',
    colaboradorId: 1,
    canonicalName: 'Lisa Fiscal',
    ...overrides,
  };
}

describe('matchAlias', () => {
  it('exact: match exato na chave composta departamento+alias', () => {
    const aliases = [alias({})];
    const resultado = matchAlias(aliases, 'Lisa Dp Fiscal', 'Fiscal');

    expect(resultado).toEqual({ employeeId: 1, canonicalName: 'Lisa Fiscal', matchType: 'exact' });
  });

  it('fuzzy: score >= 88 no mesmo departamento quando nao ha exato', () => {
    const aliases = [alias({ aliasNormalizado: 'liza fiscal' })];
    // "lisa fiscal" (normalizado de "Lisa Dp Fiscal") x "liza fiscal": 1 char de diferenca, sem bater exato.
    const resultado = matchAlias(aliases, 'Lisa Dp Fiscal', 'Fiscal');

    expect(resultado.matchType).toBe('fuzzy');
    expect(resultado.employeeId).toBe(1);
    expect(resultado.score).toBeGreaterThanOrEqual(88);
  });

  it('unresolved: nenhum alias no departamento bate exato nem >= threshold', () => {
    const aliases = [alias({ aliasNormalizado: 'joao pessoal', departamentoNormalizado: 'pessoal' })];
    const resultado = matchAlias(aliases, 'Maria Completamente Diferente', 'Fiscal');

    expect(resultado).toEqual({ employeeId: null, canonicalName: null, matchType: 'unresolved' });
  });

  it('unresolved: score fuzzy abaixo do threshold nao resolve', () => {
    const aliases = [alias({ aliasNormalizado: 'roberto carvalho' })];
    const resultado = matchAlias(aliases, 'Ana Silva', 'Fiscal');

    expect(resultado.matchType).toBe('unresolved');
  });

  it('nunca colapsa colaboradores de departamentos diferentes com mesmo nome/alias', () => {
    const aliases = [
      alias({ colaboradorId: 1, canonicalName: 'Vitor Fiscal', departamentoNormalizado: 'fiscal', aliasNormalizado: 'vitor' }),
      alias({ colaboradorId: 2, canonicalName: 'Vitor Pessoal', departamentoNormalizado: 'pessoal', aliasNormalizado: 'vitor' }),
    ];

    const resultadoFiscal = matchAlias(aliases, 'Vitor', 'Fiscal');
    const resultadoPessoal = matchAlias(aliases, 'Vitor', 'Pessoal');

    expect(resultadoFiscal.matchType).toBe('exact');
    expect(resultadoFiscal.employeeId).toBe(1);
    expect(resultadoPessoal.matchType).toBe('exact');
    expect(resultadoPessoal.employeeId).toBe(2);
    expect(resultadoFiscal.employeeId).not.toBe(resultadoPessoal.employeeId);
  });

  it('fuzzy tambem respeita a fronteira de departamento (nao cruza pra outro dept mesmo com score alto)', () => {
    const aliases = [
      alias({ colaboradorId: 1, canonicalName: 'Vitor Fiscal', departamentoNormalizado: 'fiscal', aliasNormalizado: 'vitor sousa' }),
      alias({ colaboradorId: 2, canonicalName: 'Vitor Pessoal', departamentoNormalizado: 'pessoal', aliasNormalizado: 'vitor souza' }),
    ];

    // "vitor souza" so existe em pessoal - buscando em fiscal nao pode resolver pro colaborador 2.
    const resultado = matchAlias(aliases, 'Vitor Souza', 'Fiscal');

    expect(resultado.employeeId).not.toBe(2);
  });

  it('allowFuzzy=false suprime a camada fuzzy mas mantem o match exato (alias ja aprovado nao pode voltar pra fila)', () => {
    const aliases = [alias({ departamentoNormalizado: '', aliasNormalizado: 'lisa fiscal' })];

    const semDeptFuzzy = matchAlias(aliases, 'Lisa Fizcal', '', false);
    expect(semDeptFuzzy.matchType).toBe('unresolved');

    const semDeptExato = matchAlias(aliases, 'Lisa Dp Fiscal', '', false);
    expect(semDeptExato.matchType).toBe('exact');
    expect(semDeptExato.employeeId).toBe(1);
  });
});
