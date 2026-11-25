/*
  Cálculos de avaliação nutricional (funções puras: não mexem na tela nem no banco).
  Unidades: peso em kg, altura em cm, dobras em mm, idade em anos.
  sexo: 'M' (masculino) ou 'F' (feminino).
  Estimativas por equações publicadas. A conduta é sempre da nutricionista.
*/
(function (raiz) {
  'use strict';

  const LOCAIS = {
    triceps: 'Tricipital',
    biceps: 'Bicipital',
    subescapular: 'Subescapular',
    peitoral: 'Peitoral',
    axilar_media: 'Axilar média',
    suprailiaca: 'Suprailíaca',
    abdominal: 'Abdominal',
    coxa: 'Coxa',
    panturrilha: 'Panturrilha medial',
  };

  const somar = (d, ks) => ks.reduce((t, k) => t + d[k], 0);

  function hojeISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // Idade completa na data de referência (padrão: hoje). Datas no formato AAAA-MM-DD.
  function idadeEm(nascimentoISO, referenciaISO) {
    if (!nascimentoISO) return null;
    const [a, m, d] = nascimentoISO.split('-').map(Number);
    const [ra, rm, rd] = (referenciaISO || hojeISO()).split('-').map(Number);
    if (!a || !ra) return null;
    let idade = ra - a;
    if (rm < m || (rm === m && rd < d)) idade--;
    return idade;
  }

  // ---------- IMC ----------
  function imc(peso, alturaCm) {
    if (!(peso > 0) || !(alturaCm > 0)) return null;
    const m = alturaCm / 100;
    return peso / (m * m);
  }

  // Adultos (20 a 59 anos): classificação da OMS. Idosos (60 anos ou mais): Lipschitz.
  function classificarImc(valor, idade) {
    if (valor == null || idade == null) return null;
    if (idade >= 60) {
      if (valor < 22) return 'Baixo peso';
      if (valor <= 27) return 'Eutrofia';
      return 'Sobrepeso';
    }
    if (idade >= 20) {
      if (valor < 18.5) return 'Baixo peso';
      if (valor < 25) return 'Eutrofia';
      if (valor < 30) return 'Sobrepeso';
      if (valor < 35) return 'Obesidade grau I';
      if (valor < 40) return 'Obesidade grau II';
      return 'Obesidade grau III';
    }
    return 'Menores de 20 anos: use as curvas de crescimento (não incluídas)';
  }

  // ---------- Percentual de gordura por dobras cutâneas ----------
  // Conversão de densidade corporal em % de gordura (Siri, 1961).
  const siri = (densidade) => 495 / densidade - 450;

  // Durnin e Womersley (1974): constantes por sexo e faixa de idade. D = c - m * log10(soma das 4 dobras)
  function constantesDW(sexo, idade) {
    const tabela = {
      M: [[17, 1.1533, 0.0643], [20, 1.1620, 0.0630], [30, 1.1631, 0.0632], [40, 1.1422, 0.0544], [50, 1.1620, 0.0700], [Infinity, 1.1715, 0.0779]],
      F: [[17, 1.1369, 0.0598], [20, 1.1549, 0.0678], [30, 1.1599, 0.0717], [40, 1.1423, 0.0632], [50, 1.1333, 0.0612], [Infinity, 1.1339, 0.0645]],
    };
    const linha = tabela[sexo].find(([limite]) => idade < limite);
    return [linha[1], linha[2]];
  }

  const PROTOCOLOS = {
    jp3: {
      nome: 'Jackson e Pollock (3 dobras)',
      fonte: 'Jackson e Pollock (1978); Jackson, Pollock e Ward (1980)',
      usaSexo: true, usaIdade: true,
      locais: (s) => (s === 'M' ? ['peitoral', 'abdominal', 'coxa'] : ['triceps', 'suprailiaca', 'coxa']),
      faixa: (s) => (s === 'M' ? [18, 61] : [18, 55]),
      densidade: (s, X, i) => (s === 'M'
        ? 1.10938 - 0.0008267 * X + 0.0000016 * X * X - 0.0002574 * i
        : 1.0994921 - 0.0009929 * X + 0.0000023 * X * X - 0.0001392 * i),
    },
    jp7: {
      nome: 'Jackson e Pollock (7 dobras)',
      fonte: 'Jackson e Pollock (1978); Jackson, Pollock e Ward (1980)',
      usaSexo: true, usaIdade: true,
      locais: () => ['peitoral', 'axilar_media', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
      faixa: (s) => (s === 'M' ? [18, 61] : [18, 55]),
      densidade: (s, X, i) => (s === 'M'
        ? 1.112 - 0.00043499 * X + 0.00000055 * X * X - 0.00028826 * i
        : 1.097 - 0.00046971 * X + 0.00000056 * X * X - 0.00012828 * i),
    },
    guedes: {
      nome: 'Guedes',
      fonte: 'Guedes (1985)',
      usaSexo: true, usaIdade: true,
      locais: (s) => (s === 'M' ? ['triceps', 'suprailiaca', 'abdominal'] : ['coxa', 'suprailiaca', 'subescapular']),
      faixa: (s) => (s === 'M' ? [17, 27] : [18, 30]),
      densidade: (s, X) => (s === 'M'
        ? 1.1714 - 0.0671 * Math.log10(X)
        : 1.1665 - 0.0706 * Math.log10(X)),
    },
    dw: {
      nome: 'Durnin e Womersley (4 dobras)',
      fonte: 'Durnin e Womersley (1974)',
      usaSexo: true, usaIdade: true,
      locais: () => ['biceps', 'triceps', 'subescapular', 'suprailiaca'],
      faixa: () => [16, 72],
      densidade: (s, X, i) => {
        const [c, m] = constantesDW(s, i);
        return c - m * Math.log10(X);
      },
    },
    petroski: {
      nome: 'Petroski',
      fonte: 'Petroski (1995), equações para brasileiros',
      usaSexo: true, usaIdade: true,
      locais: (s) => (s === 'M' ? ['subescapular', 'triceps', 'suprailiaca', 'panturrilha'] : ['axilar_media', 'suprailiaca', 'coxa', 'panturrilha']),
      faixa: (s) => (s === 'M' ? [18, 61] : [18, 51]),
      densidade: (s, X, i) => (s === 'M'
        ? 1.10726863 - 0.00081201 * X + 0.00000212 * X * X - 0.00041761 * i
        : 1.1954713 - 0.07513507 * Math.log10(X) - 0.00041072 * i),
    },
    faulkner: {
      nome: 'Faulkner',
      fonte: 'Faulkner (1968)',
      usaSexo: false, usaIdade: false,
      locais: () => ['triceps', 'subescapular', 'suprailiaca', 'abdominal'],
      faixa: () => null,
      // Calcula o % de gordura diretamente (sem densidade).
      percentual: (X) => X * 0.153 + 5.783,
      nota: 'Equação atribuída a Faulkner; estudos apontam que ela se aproxima da de Yuhasz, derivada de homens jovens. Use com cautela.',
    },
  };

  function percentualGordura(idProtocolo, { sexo, idade, dobras }) {
    const p = PROTOCOLOS[idProtocolo];
    if (!p) return { ok: false, erro: 'Protocolo desconhecido.' };
    if (p.usaSexo && sexo !== 'M' && sexo !== 'F') {
      return { ok: false, erro: 'Informe o sexo (feminino ou masculino) no cadastro do paciente.' };
    }
    if (p.usaIdade && !(idade >= 0)) {
      return { ok: false, erro: 'Informe a data de nascimento no cadastro do paciente.' };
    }
    const locais = p.locais(sexo);
    const faltando = locais.filter((k) => !(dobras[k] > 0));
    if (faltando.length) {
      return { ok: false, erro: 'Faltam as dobras: ' + faltando.map((k) => LOCAIS[k]).join(', ') + '.', locais };
    }

    const X = somar(dobras, locais);
    let densidade = null;
    let percentual;
    if (p.percentual) {
      percentual = p.percentual(X);
    } else {
      densidade = p.densidade(sexo, X, idade);
      percentual = siri(densidade);
    }

    const avisos = [];
    const faixa = p.faixa(sexo);
    if (faixa && (idade < faixa[0] || idade > faixa[1])) {
      avisos.push(`Esta equação foi desenvolvida para ${faixa[0]} a ${faixa[1]} anos. Fora dessa faixa, o resultado pode ser menos preciso.`);
    }
    if (p.nota) avisos.push(p.nota);
    if (!(percentual >= 2 && percentual <= 60)) {
      avisos.push('Resultado fora do esperado. Confira as medidas das dobras.');
    }
    return { ok: true, percentual, densidade, soma: X, locais, avisos };
  }

  // ---------- Gasto energético ----------
  // Tabelas por sexo e faixa de idade: [limite superior (exclusivo), a, b] => a * peso + b
  const FAO_1985 = {
    M: [[30, 15.3, 679], [60, 11.6, 879], [Infinity, 13.5, 487]],
    F: [[30, 14.7, 496], [60, 8.7, 829], [Infinity, 10.5, 596]],
  };
  // Relatório FAO/OMS/UNU de 2001: manteve as equações de Schofield (1985), em kcal sem arredondar.
  const FAO_2001 = {
    M: [[30, 15.057, 692.2], [60, 11.472, 873.1], [Infinity, 11.711, 587.7]],
    F: [[30, 14.818, 486.6], [60, 8.126, 845.6], [Infinity, 9.082, 658.5]],
  };
  function porFaixa(tabela, e) {
    const linha = tabela[e.sexo].find(([limite]) => e.idade < limite);
    return linha[1] * e.peso + linha[2];
  }
  const adultoFAO = (e) => (e.idade < 18 ? 'Disponível a partir de 18 anos nesta versão.' : null);

  const FORMULAS_GASTO = [
    {
      id: 'harris', nome: 'Harris-Benedict (1919)', precisa: ['sexo', 'idade', 'peso', 'alturaCm'],
      calc: (e) => (e.sexo === 'M'
        ? 66.473 + 13.7516 * e.peso + 5.0033 * e.alturaCm - 6.755 * e.idade
        : 655.0955 + 9.5634 * e.peso + 1.8496 * e.alturaCm - 4.6756 * e.idade),
    },
    {
      id: 'mifflin', nome: 'Mifflin-St Jeor (1990)', precisa: ['sexo', 'idade', 'peso', 'alturaCm'],
      calc: (e) => 10 * e.peso + 6.25 * e.alturaCm - 5 * e.idade + (e.sexo === 'M' ? 5 : -161),
      aviso: (e) => (e.idade < 19 || e.idade > 78 ? 'Desenvolvida para 19 a 78 anos.' : null),
    },
    {
      id: 'fao1985', nome: 'FAO/OMS 1985 (peso)', precisa: ['sexo', 'idade', 'peso'],
      bloqueio: adultoFAO,
      calc: (e) => porFaixa(FAO_1985, e),
    },
    {
      id: 'fao2001', nome: 'FAO/OMS 2001 (peso)', precisa: ['sexo', 'idade', 'peso'],
      bloqueio: adultoFAO,
      calc: (e) => porFaixa(FAO_2001, e),
    },
    {
      id: 'katch', nome: 'Katch-McArdle', precisa: ['mlg'],
      calc: (e) => 370 + 21.6 * e.mlg,
      aviso: () => 'Usa a massa livre de gordura (370 + 21,6 × MLG).',
    },
    {
      id: 'cunningham', nome: 'Cunningham (1980)', precisa: ['mlg'],
      calc: (e) => 500 + 22 * e.mlg,
      aviso: () => 'Usa a massa livre de gordura (500 + 22 × MLG).',
    },
    {
      id: 'tinsley_peso', nome: 'Tinsley (peso)', precisa: ['peso'],
      calc: (e) => 24.8 * e.peso + 10,
      aviso: () => 'Desenvolvida com atletas de físico muscular.',
    },
    {
      id: 'tinsley_mlg', nome: 'Tinsley (massa livre de gordura)', precisa: ['mlg'],
      calc: (e) => 25.9 * e.mlg + 284,
      aviso: () => 'Desenvolvida com atletas de físico muscular.',
    },
  ];

  const ROTULO_CAMPO = {
    sexo: 'sexo do paciente',
    idade: 'data de nascimento',
    peso: 'peso',
    alturaCm: 'altura',
    mlg: '% de gordura (para a massa livre de gordura)',
  };

  // Entrada: { sexo, idade, peso, alturaCm, mlg }. Devolve a TMB (kcal/dia) de cada equação.
  function gastoEnergetico(e) {
    return FORMULAS_GASTO.map((f) => {
      const saida = { id: f.id, nome: f.nome, valor: null, motivo: null, aviso: null };
      const faltando = f.precisa.filter((c) => {
        if (c === 'sexo') return e.sexo !== 'M' && e.sexo !== 'F';
        if (c === 'idade') return !(e.idade >= 0);
        return !(e[c] > 0);
      });
      if (faltando.length) {
        saida.motivo = 'Falta: ' + faltando.map((c) => ROTULO_CAMPO[c]).join(', ') + '.';
        return saida;
      }
      const bloqueio = f.bloqueio ? f.bloqueio(e) : null;
      if (bloqueio) { saida.motivo = bloqueio; return saida; }
      saida.valor = f.calc(e);
      saida.aviso = f.aviso ? f.aviso(e) : null;
      return saida;
    });
  }

  const api = {
    LOCAIS, PROTOCOLOS, FORMULAS_GASTO,
    idadeEm, imc, classificarImc, siri, percentualGordura, gastoEnergetico,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.Calculos = api;
})(typeof window !== 'undefined' ? window : globalThis);
