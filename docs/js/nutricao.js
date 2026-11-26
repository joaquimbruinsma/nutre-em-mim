/*
  Lógica do plano alimentar (funções puras: não mexem na tela nem no banco).
  Todos os valores de alimentos são por 100 g. Quantidades em gramas.
  Fonte dos dados da TACO: NEPA-UNICAMP (2011), 4. ed. rev. e ampl.
*/
(function (raiz) {
  'use strict';

  const NUTRIENTES = [
    { k: 'kcal', rotulo: 'Energia', un: 'kcal', casas: 0, grupo: 'Macronutrientes' },
    { k: 'prot', rotulo: 'Proteínas', un: 'g', casas: 1, grupo: 'Macronutrientes' },
    { k: 'lip', rotulo: 'Lipídios', un: 'g', casas: 1, grupo: 'Macronutrientes' },
    { k: 'carb', rotulo: 'Carboidratos', un: 'g', casas: 1, grupo: 'Macronutrientes' },
    { k: 'fibra', rotulo: 'Fibra alimentar', un: 'g', casas: 1, grupo: 'Macronutrientes' },
    { k: 'sat', rotulo: 'Gorduras saturadas', un: 'g', casas: 1, grupo: 'Lipídios' },
    { k: 'mono', rotulo: 'Gorduras monoinsaturadas', un: 'g', casas: 1, grupo: 'Lipídios' },
    { k: 'poli', rotulo: 'Gorduras poli-insaturadas', un: 'g', casas: 1, grupo: 'Lipídios' },
    { k: 'col', rotulo: 'Colesterol', un: 'mg', casas: 0, grupo: 'Lipídios' },
    { k: 'ca', rotulo: 'Cálcio', un: 'mg', casas: 0, grupo: 'Minerais' },
    { k: 'mg', rotulo: 'Magnésio', un: 'mg', casas: 0, grupo: 'Minerais' },
    { k: 'p', rotulo: 'Fósforo', un: 'mg', casas: 0, grupo: 'Minerais' },
    { k: 'fe', rotulo: 'Ferro', un: 'mg', casas: 1, grupo: 'Minerais' },
    { k: 'na', rotulo: 'Sódio', un: 'mg', casas: 0, grupo: 'Minerais' },
    { k: 'k', rotulo: 'Potássio', un: 'mg', casas: 0, grupo: 'Minerais' },
    { k: 'zn', rotulo: 'Zinco', un: 'mg', casas: 1, grupo: 'Minerais' },
    { k: 'cu', rotulo: 'Cobre', un: 'mg', casas: 2, grupo: 'Minerais' },
    { k: 'mn', rotulo: 'Manganês', un: 'mg', casas: 2, grupo: 'Minerais' },
    { k: 'rae', rotulo: 'Vitamina A (RAE)', un: 'mcg', casas: 0, grupo: 'Vitaminas' },
    { k: 'tiamina', rotulo: 'Tiamina (B1)', un: 'mg', casas: 2, grupo: 'Vitaminas' },
    { k: 'riboflavina', rotulo: 'Riboflavina (B2)', un: 'mg', casas: 2, grupo: 'Vitaminas' },
    { k: 'piridoxina', rotulo: 'Piridoxina (B6)', un: 'mg', casas: 2, grupo: 'Vitaminas' },
    { k: 'niacina', rotulo: 'Niacina', un: 'mg', casas: 1, grupo: 'Vitaminas' },
    { k: 'vitc', rotulo: 'Vitamina C', un: 'mg', casas: 1, grupo: 'Vitaminas' },
  ];
  const CHAVES = NUTRIENTES.map((n) => n.k);

  // Minúsculas, sem acentos, espaços simples.
  function normalizar(texto) {
    return String(texto ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Cada alimento ganha "_b" (texto de busca) e "ref" (identificador: taco:12 ou proprio:<uuid>).
  function prepararTaco(lista) {
    return lista.map((a) => ({ ...a, ref: 'taco:' + a.id, origem: 'taco', _b: normalizar(a.n) }));
  }
  // Alimento próprio: { id, nome, categoria, nutrientes: { kcal, prot, ... }, fonte }
  function prepararProprio(reg) {
    const n = reg.nutrientes || {};
    const a = { id: reg.id, n: reg.nome, ref: 'proprio:' + reg.id, origem: 'proprio', categoria: reg.categoria || '', fonte: reg.fonte || '' };
    CHAVES.forEach((k) => { a[k] = typeof n[k] === 'number' ? n[k] : null; });
    a._b = normalizar(reg.nome);
    return a;
  }

  // Todas as palavras digitadas precisam aparecer no nome. Quem começa com a 1ª palavra vem antes.
  function buscar(indice, termo, limite = 12) {
    const palavras = normalizar(termo).split(' ').filter(Boolean);
    if (!palavras.length) return [];
    const achados = [];
    for (const a of indice) {
      if (!palavras.every((p) => a._b.includes(p))) continue;
      let pontos = 2;
      if (a._b.startsWith(palavras[0])) pontos = 0;
      else if (a._b.includes(' ' + palavras[0]) || a._b.includes(', ' + palavras[0])) pontos = 1;
      achados.push({ a, pontos });
    }
    achados.sort((x, y) => x.pontos - y.pontos || x.a.n.length - y.a.n.length || x.a.n.localeCompare(y.a.n, 'pt-BR'));
    return achados.slice(0, limite).map((x) => x.a);
  }

  const zerar = () => Object.fromEntries(CHAVES.map((k) => [k, 0]));

  // Nutrientes de uma porção. Valor ausente conta como 0, e "semEnergia" avisa quando o alimento não tem energia.
  function nutrientesDoItem(alimento, gramas) {
    const f = (Number(gramas) > 0 ? Number(gramas) : 0) / 100;
    const valores = zerar();
    CHAVES.forEach((k) => { if (typeof alimento[k] === 'number') valores[k] = alimento[k] * f; });
    return { valores, semEnergia: typeof alimento.kcal !== 'number' };
  }

  // refeicoes: [{ itens: [{ ref, nome, g }] }]. resolver(ref) devolve o alimento ou null.
  function totais(refeicoes, resolver) {
    const total = zerar();
    const porRefeicao = [];
    const semDados = new Set();
    const naoEncontrados = new Set();
    refeicoes.forEach((ref) => {
      const sub = zerar();
      (ref.itens || []).forEach((it) => {
        const alimento = resolver(it.ref);
        if (!alimento) { naoEncontrados.add(it.nome); return; }
        const r = nutrientesDoItem(alimento, it.g);
        if (r.semEnergia) semDados.add(alimento.n);
        CHAVES.forEach((k) => { sub[k] += r.valores[k]; total[k] += r.valores[k]; });
      });
      porRefeicao.push(sub);
    });
    return { total, porRefeicao, semDados: [...semDados], naoEncontrados: [...naoEncontrados] };
  }

  // Distribuição de macronutrientes pelas calorias dos próprios macros (4 × P + 9 × L + 4 × C).
  function distribuicao(total) {
    const kp = 4 * total.prot, kl = 9 * total.lip, kc = 4 * total.carb;
    const soma = kp + kl + kc;
    if (!(soma > 0)) return { prot: null, lip: null, carb: null };
    return { prot: (kp / soma) * 100, lip: (kl / soma) * 100, carb: (kc / soma) * 100 };
  }

  const api = { NUTRIENTES, CHAVES, normalizar, prepararTaco, prepararProprio, buscar, nutrientesDoItem, totais, distribuicao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.Nutricao = api;
})(typeof window !== 'undefined' ? window : globalThis);
