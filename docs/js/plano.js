// Plano alimentar de um paciente: lista de planos, editor com busca na TACO, totais e impressão.
'use strict';

const $ = (id) => document.getElementById(id);
const REFEICOES_PADRAO = [
  ['Café da manhã', '07:00'], ['Lanche da manhã', '10:00'], ['Almoço', '12:30'],
  ['Lanche da tarde', '16:00'], ['Jantar', '19:30'], ['Ceia', '21:30'],
];

let paciente = null;
let tacoMeta = null;
let tacoPreparado = [];
let indice = [];
let mapa = new Map();
let proprios = [];
let planos = [];
let plano = null;          // plano aberto no editor
let sujo = false;          // há alterações não salvas
let linhas = [];           // referências às linhas de itens da tela (para atualizar números sem redesenhar)
let subtotais = [];
let focoNovo = null;
let temporizador;

// ---------- Utilidades ----------
function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}
function fmt(v, casas = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function dataBR(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function num(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function idCurto() { return 'r' + Math.random().toString(36).slice(2, 9); }
function avisar(texto) {
  const e = $('aviso');
  e.textContent = texto;
  e.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (e.hidden = true), 3500);
}
function erroPagina(texto) {
  $('erro-pagina').textContent = texto;
  $('conteudo').hidden = true;
}
const resolver = (ref) => mapa.get(ref) || null;

// ---------- Início ----------
(async function iniciar() {
  const sessao = await exigirLogin();
  if (!sessao) return;
  $('btn-sair').addEventListener('click', sair);

  const id = new URLSearchParams(location.search).get('paciente');
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    erroPagina('Paciente não informado. Volte à lista e use o botão “Plano”.');
    return;
  }
  const { data, error } = await db.from('pacientes').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    if (error) console.error(error);
    erroPagina('Não foi possível abrir este paciente.');
    return;
  }
  paciente = data;

  try {
    const resp = await fetch('data/taco.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    tacoMeta = await resp.json();
    tacoPreparado = Nutricao.prepararTaco(tacoMeta.alimentos);
  } catch (e) {
    console.error(e);
    erroPagina('Não foi possível carregar a tabela de alimentos (TACO). Abra o sistema pelo endereço do site ou pelo Live Server.');
    return;
  }

  $('conteudo').hidden = false;
  $('paciente-info').textContent = paciente.nome;
  $('fonte-taco').textContent = 'Fonte dos dados nutricionais: ' + tacoMeta.fonte + ' Valores por 100 g de alimento.';

  await carregarProprios();
  await carregarPlanos();

  $('btn-novo-plano').addEventListener('click', () => abrirEditor(null));
  $('btn-nova-refeicao').addEventListener('click', adicionarRefeicao);
  $('btn-salvar-plano').addEventListener('click', salvarPlano);
  $('btn-imprimir').addEventListener('click', imprimir);
  $('btn-fechar').addEventListener('click', fecharEditor);
  ['p-nome', 'p-data', 'p-kcal', 'p-prot', 'p-carb', 'p-lip', 'p-obs'].forEach((i) => $(i).addEventListener('input', lerCabecalho));
  window.addEventListener('beforeunload', (e) => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });
})();

// ---------- Dados ----------
function reconstruirIndice() {
  indice = [...tacoPreparado, ...proprios.map(Nutricao.prepararProprio)];
  mapa = new Map(indice.map((a) => [a.ref, a]));
}

async function carregarProprios() {
  const { data, error } = await db.from('alimentos_proprios').select('*').order('nome');
  if (error) {
    console.error(error);
    avisar('Não foi possível carregar os alimentos próprios (rode o SQL do plano alimentar no Supabase).');
    proprios = [];
  } else {
    proprios = data;
  }
  reconstruirIndice();
}

async function carregarPlanos() {
  const { data, error } = await db.from('planos').select('*').eq('paciente_id', paciente.id).order('data_plano', { ascending: false });
  if (error) {
    console.error(error);
    avisar('Não foi possível carregar os planos (rode o SQL do plano alimentar no Supabase).');
    planos = [];
  } else {
    planos = data;
  }
  desenharLista();
}

// ---------- Lista de planos ----------
function desenharLista() {
  const corpo = $('lista-planos');
  corpo.replaceChildren();
  planos.forEach((p) => {
    const r = Nutricao.totais((p.conteudo && p.conteudo.refeicoes) || [], resolver);
    const tr = el('tr');
    tr.append(el('td', 'nome', p.nome), el('td', null, dataBR(p.data_plano)), el('td', null, fmt(r.total.kcal, 0) + ' kcal'));
    const acoes = el('td', 'acoes');
    const abrir = el('button', 'btn btn-pequeno', 'Abrir');
    abrir.addEventListener('click', () => abrirEditor(p));
    const dup = el('button', 'btn btn-pequeno', 'Duplicar');
    dup.addEventListener('click', () => duplicar(p));
    const apagar = el('button', 'btn btn-pequeno btn-perigo', 'Excluir');
    apagar.addEventListener('click', () => excluir(p));
    acoes.append(abrir, dup, apagar);
    tr.append(acoes);
    corpo.append(tr);
  });
  $('planos-vazio').hidden = planos.length > 0;
}

async function duplicar(p) {
  const copia = {
    paciente_id: paciente.id,
    nome: (p.nome + ' (cópia)').slice(0, 120),
    data_plano: hojeISO(),
    metas: p.metas || {},
    conteudo: p.conteudo || { refeicoes: [] },
    observacoes: p.observacoes,
  };
  const { error } = await db.from('planos').insert(copia);
  if (error) { console.error(error); avisar('Não foi possível duplicar o plano.'); return; }
  avisar('Plano duplicado.');
  await carregarPlanos();
}

async function excluir(p) {
  if (!confirm(`Excluir o plano "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
  const { error } = await db.from('planos').delete().eq('id', p.id);
  if (error) { console.error(error); avisar('Não foi possível excluir o plano.'); return; }
  if (plano && plano.id === p.id) fecharEditor(true);
  avisar('Plano excluído.');
  await carregarPlanos();
}

// ---------- Editor ----------
function abrirEditor(p) {
  if (sujo && !confirm('Há alterações não salvas no plano aberto. Descartar e continuar?')) return;
  if (p) {
    const c = JSON.parse(JSON.stringify(p.conteudo || { refeicoes: [] }));
    plano = {
      id: p.id, nome: p.nome, data_plano: p.data_plano, metas: p.metas || {}, observacoes: p.observacoes || '',
      refeicoes: (c.refeicoes || []).map((r) => ({ id: r.id || idCurto(), nome: r.nome || '', horario: r.horario || '', obs: r.obs || '', itens: r.itens || [] })),
    };
  } else {
    plano = {
      id: null, nome: '', data_plano: hojeISO(), metas: {}, observacoes: '',
      refeicoes: REFEICOES_PADRAO.map(([nome, horario]) => ({ id: idCurto(), nome, horario, obs: '', itens: [] })),
    };
  }
  sujo = false;
  $('editor-titulo').textContent = p ? 'Editar plano' : 'Novo plano';
  $('erro-plano').textContent = '';
  $('p-nome').value = plano.nome;
  $('p-data').value = plano.data_plano;
  $('p-kcal').value = plano.metas.kcal ?? '';
  $('p-prot').value = plano.metas.prot ?? '';
  $('p-carb').value = plano.metas.carb ?? '';
  $('p-lip').value = plano.metas.lip ?? '';
  $('p-obs').value = plano.observacoes;
  $('secao-editor').hidden = false;
  renderizarRefeicoes();
  $('secao-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fecharEditor(forcar) {
  if (forcar !== true && sujo && !confirm('Há alterações não salvas. Fechar mesmo assim?')) return;
  plano = null;
  sujo = false;
  $('secao-editor').hidden = true;
}

function lerCabecalho() {
  if (!plano) return;
  plano.nome = $('p-nome').value;
  plano.data_plano = $('p-data').value;
  plano.observacoes = $('p-obs').value;
  plano.metas = { kcal: num($('p-kcal').value), prot: num($('p-prot').value), carb: num($('p-carb').value), lip: num($('p-lip').value) };
  sujo = true;
  atualizarNumeros();
}

function adicionarRefeicao() {
  plano.refeicoes.push({ id: idCurto(), nome: 'Nova refeição', horario: '', obs: '', itens: [] });
  sujo = true;
  renderizarRefeicoes();
}

function renderizarRefeicoes() {
  const caixa = $('refeicoes');
  caixa.replaceChildren();
  linhas = [];
  subtotais = [];
  plano.refeicoes.forEach((ref, ri) => caixa.append(cartaoRefeicao(ref, ri)));
  atualizarNumeros();
  if (focoNovo) {
    const alvo = linhas.find((l) => l.ri === focoNovo.ri && l.ii === focoNovo.ii);
    if (alvo) { alvo.entradaG.focus(); alvo.entradaG.select(); }
    focoNovo = null;
  }
}

function cartaoRefeicao(ref, ri) {
  const cartao = el('div', 'cartao refeicao');

  const cab = el('div', 'refeicao-cab');
  const nome = document.createElement('input');
  nome.type = 'text'; nome.maxLength = 80; nome.value = ref.nome; nome.className = 'refeicao-nome';
  nome.setAttribute('aria-label', 'Nome da refeição');
  nome.addEventListener('input', () => { ref.nome = nome.value; sujo = true; });
  const hora = document.createElement('input');
  hora.type = 'time'; hora.value = ref.horario || ''; hora.className = 'refeicao-hora';
  hora.setAttribute('aria-label', 'Horário');
  hora.addEventListener('input', () => { ref.horario = hora.value; sujo = true; });
  const sub = el('span', 'refeicao-sub', '0 kcal');
  subtotais[ri] = sub;
  const sobe = el('button', 'btn btn-pequeno', '↑');
  sobe.type = 'button'; sobe.title = 'Subir refeição'; sobe.disabled = ri === 0;
  sobe.addEventListener('click', () => mover(ri, -1));
  const desce = el('button', 'btn btn-pequeno', '↓');
  desce.type = 'button'; desce.title = 'Descer refeição'; desce.disabled = ri === plano.refeicoes.length - 1;
  desce.addEventListener('click', () => mover(ri, 1));
  const remover = el('button', 'btn btn-pequeno btn-perigo', 'Remover');
  remover.type = 'button';
  remover.addEventListener('click', () => {
    if (ref.itens.length && !confirm(`Remover "${ref.nome}" e os ${ref.itens.length} alimento(s) dela?`)) return;
    plano.refeicoes.splice(ri, 1);
    sujo = true;
    renderizarRefeicoes();
  });
  cab.append(nome, hora, sub, sobe, desce, remover);
  cartao.append(cab);

  if (ref.itens.length) {
    const caixa = el('div', 'tabela-caixa');
    const tabela = el('table', 'tabela-itens');
    const thead = el('thead');
    const trh = el('tr');
    ['Alimento', 'Qtd (g)', 'Medida caseira', 'kcal', 'P (g)', 'C (g)', 'L (g)', ''].forEach((t) => trh.append(el('th', null, t)));
    thead.append(trh);
    const corpo = el('tbody');
    ref.itens.forEach((it, ii) => corpo.append(linhaItem(ref, ri, it, ii)));
    tabela.append(thead, corpo);
    caixa.append(tabela);
    cartao.append(caixa);
  } else {
    cartao.append(el('p', 'nota', 'Nenhum alimento ainda. Use a busca abaixo.'));
  }

  cartao.append(campoBusca(ref, ri));
  const obs = document.createElement('input');
  obs.type = 'text'; obs.maxLength = 300; obs.value = ref.obs || ''; obs.placeholder = 'Observação da refeição (opcional)';
  obs.className = 'refeicao-obs'; obs.setAttribute('aria-label', 'Observação da refeição');
  obs.addEventListener('input', () => { ref.obs = obs.value; sujo = true; });
  cartao.append(obs);
  return cartao;
}

function mover(ri, delta) {
  const alvo = ri + delta;
  if (alvo < 0 || alvo >= plano.refeicoes.length) return;
  [plano.refeicoes[ri], plano.refeicoes[alvo]] = [plano.refeicoes[alvo], plano.refeicoes[ri]];
  sujo = true;
  renderizarRefeicoes();
}

function linhaItem(ref, ri, it, ii) {
  const tr = el('tr');
  const alimento = resolver(it.ref);
  const tdNome = el('td', 'nome', it.nome);
  if (!alimento) tdNome.append(el('div', 'aviso-item', 'Alimento não encontrado (foi removido?)'));
  tr.append(tdNome);

  const entradaG = document.createElement('input');
  entradaG.type = 'text'; entradaG.inputMode = 'decimal'; entradaG.className = 'entrada-g';
  entradaG.value = it.g ? String(it.g).replace('.', ',') : '';
  entradaG.setAttribute('aria-label', 'Quantidade em gramas de ' + it.nome);
  entradaG.addEventListener('input', () => {
    const v = num(entradaG.value);
    it.g = Number.isFinite(v) && v > 0 ? v : 0;
    entradaG.classList.toggle('invalido', entradaG.value.trim() !== '' && !(v > 0));
    sujo = true;
    atualizarNumeros();
  });
  const tdG = el('td'); tdG.append(entradaG); tr.append(tdG);

  const medida = document.createElement('input');
  medida.type = 'text'; medida.maxLength = 60; medida.value = it.medida || ''; medida.className = 'entrada-medida';
  medida.placeholder = 'Ex.: 2 colheres de sopa';
  medida.setAttribute('aria-label', 'Medida caseira de ' + it.nome);
  medida.addEventListener('input', () => { it.medida = medida.value; sujo = true; });
  const tdM = el('td'); tdM.append(medida); tr.append(tdM);

  const cKcal = el('td', 'num'); const cP = el('td', 'num'); const cC = el('td', 'num'); const cL = el('td', 'num');
  tr.append(cKcal, cP, cC, cL);

  const tdX = el('td', 'acoes');
  const x = el('button', 'btn btn-pequeno btn-perigo', '✕');
  x.type = 'button'; x.title = 'Remover alimento'; x.setAttribute('aria-label', 'Remover ' + it.nome);
  x.addEventListener('click', () => { ref.itens.splice(ii, 1); sujo = true; renderizarRefeicoes(); });
  tdX.append(x); tr.append(tdX);

  linhas.push({ ri, ii, it, entradaG, cKcal, cP, cC, cL });
  return tr;
}

// ---------- Busca de alimentos ----------
function campoBusca(ref, ri) {
  const caixa = el('div', 'busca-alimento');
  const input = document.createElement('input');
  input.type = 'search'; input.placeholder = 'Buscar alimento para adicionar (ex.: arroz integral)';
  input.setAttribute('aria-label', 'Buscar alimento'); input.autocomplete = 'off';
  const lista = el('ul', 'resultados-busca');
  lista.hidden = true;
  let achados = [];
  let ativo = -1;

  function fechar() { lista.hidden = true; ativo = -1; }
  function marcar() { [...lista.children].forEach((li, i) => li.classList.toggle('ativo', i === ativo)); }
  function escolher(a) {
    if (!a) return;
    ref.itens.push({ ref: a.ref, nome: a.n, g: 100, medida: '' });
    sujo = true;
    focoNovo = { ri, ii: ref.itens.length - 1 };
    renderizarRefeicoes();
  }
  function mostrar() {
    achados = Nutricao.buscar(indice, input.value, 12);
    lista.replaceChildren();
    ativo = achados.length ? 0 : -1;
    if (!input.value.trim()) { fechar(); return; }
    if (!achados.length) {
      lista.append(el('li', 'sem-resultado', 'Nenhum alimento encontrado. Você pode cadastrar em “Alimentos próprios”.'));
    }
    achados.forEach((a, i) => {
      const li = el('li');
      li.append(el('span', 'res-nome', a.n));
      const detalhe = typeof a.kcal === 'number' ? fmt(a.kcal, 0) + ' kcal/100 g' : 'sem dados de energia';
      li.append(el('span', 'res-detalhe', (a.origem === 'proprio' ? 'própria · ' : '') + detalhe));
      li.addEventListener('mousedown', (e) => { e.preventDefault(); escolher(a); });
      lista.append(li);
      if (i === 0) li.classList.add('ativo');
    });
    lista.hidden = false;
  }

  input.addEventListener('input', mostrar);
  input.addEventListener('focus', () => { if (input.value.trim()) mostrar(); });
  input.addEventListener('blur', () => setTimeout(fechar, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (achados.length) { ativo = (ativo + 1) % achados.length; marcar(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (achados.length) { ativo = (ativo - 1 + achados.length) % achados.length; marcar(); } }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(achados[ativo >= 0 ? ativo : 0]); }
    else if (e.key === 'Escape') { fechar(); }
  });
  caixa.append(input, lista);
  return caixa;
}

// ---------- Números e totais ----------
function atualizarNumeros() {
  if (!plano) return;
  const r = Nutricao.totais(plano.refeicoes, resolver);

  linhas.forEach((l) => {
    const alimento = resolver(l.it.ref);
    if (!alimento) {
      [l.cKcal, l.cP, l.cC, l.cL].forEach((c) => (c.textContent = '—'));
      return;
    }
    const n = Nutricao.nutrientesDoItem(alimento, l.it.g);
    l.cKcal.textContent = n.semEnergia ? 'sem dados' : fmt(n.valores.kcal, 0);
    l.cKcal.classList.toggle('sem-dados', n.semEnergia);
    l.cP.textContent = fmt(n.valores.prot, 1);
    l.cC.textContent = fmt(n.valores.carb, 1);
    l.cL.textContent = fmt(n.valores.lip, 1);
  });
  subtotais.forEach((el_, i) => {
    if (el_ && r.porRefeicao[i]) el_.textContent = fmt(r.porRefeicao[i].kcal, 0) + ' kcal';
  });
  desenharPainel(r);
}

function metricaPainel(rotulo, valor, detalhe) {
  const c = el('div', 'metrica');
  c.append(el('span', 'metrica-rotulo', rotulo), el('strong', 'metrica-valor', valor));
  if (detalhe) c.append(el('span', 'metrica-detalhe', detalhe));
  return c;
}

function desenharPainel(r) {
  const p = $('painel');
  p.replaceChildren();
  p.append(el('h2', null, 'Totais do dia'));
  const t = r.total;
  const m = (plano && plano.metas) || {};

  let detalheKcal = null;
  if (m.kcal > 0) {
    const dif = t.kcal - m.kcal;
    detalheKcal = `Meta ${fmt(m.kcal, 0)} kcal · ${dif >= 0 ? '+' : '−'}${fmt(Math.abs(dif), 0)} kcal (${fmt((t.kcal / m.kcal) * 100, 0)}% da meta)`;
  }
  p.append(metricaPainel('Energia', fmt(t.kcal, 0) + ' kcal', detalheKcal));

  const d = Nutricao.distribuicao(t);
  const linhaMacro = (rotulo, g, pct, meta) => {
    const detalhe = (pct !== null ? fmt(pct, 0) + '% das calorias' : '—') + (meta > 0 ? ` · meta ${fmt(meta, 0)}%` : '');
    return metricaPainel(rotulo, fmt(g, 1) + ' g', detalhe);
  };
  p.append(linhaMacro('Proteínas', t.prot, d.prot, m.prot), linhaMacro('Carboidratos', t.carb, d.carb, m.carb), linhaMacro('Lipídios', t.lip, d.lip, m.lip));
  p.append(metricaPainel('Fibra alimentar', fmt(t.fibra, 1) + ' g'));
  p.append(el('p', 'nota', 'Percentuais calculados sobre 4 × proteínas + 9 × lipídios + 4 × carboidratos.'));

  if (r.semDados.length) {
    p.append(el('p', 'aviso-calculo', 'Sem dados de energia na TACO: ' + r.semDados.join('; ') + '. Esses itens não entram na soma. Cadastre-os em “Alimentos próprios” (ex.: pelo rótulo).'));
  }
  if (r.naoEncontrados.length) {
    p.append(el('p', 'aviso-calculo', 'Alimentos não encontrados (talvez removidos): ' + r.naoEncontrados.join('; ') + '.'));
  }

  const det = el('details', 'detalhes-micro');
  det.append(el('summary', null, 'Gorduras, minerais e vitaminas'));
  const tab = el('table', 'tabela-micro');
  let grupo = '';
  Nutricao.NUTRIENTES.filter((n) => !['kcal', 'prot', 'lip', 'carb', 'fibra'].includes(n.k)).forEach((n) => {
    if (n.grupo !== grupo) {
      grupo = n.grupo;
      const trg = el('tr', 'grupo'); const th = el('th', null, grupo); th.colSpan = 2; trg.append(th); tab.append(trg);
    }
    const tr = el('tr');
    tr.append(el('td', null, n.rotulo), el('td', 'num', fmt(t[n.k], n.casas) + ' ' + n.un));
    tab.append(tr);
  });
  det.append(tab, el('p', 'nota', 'Valores ausentes na TACO entram como 0, então esses totais podem estar subestimados.'));
  p.append(det);
}

// ---------- Salvar ----------
function validarPlano() {
  lerCabecalho();
  if (!plano.nome.trim()) return 'Dê um nome ao plano.';
  if (!plano.data_plano) return 'Informe a data do plano.';
  const m = plano.metas;
  if (Number.isNaN(m.kcal) || (m.kcal !== null && (m.kcal < 300 || m.kcal > 10000))) return 'Meta de energia: informe um valor entre 300 e 10000 kcal.';
  for (const [k, rotulo] of [['prot', 'proteínas'], ['carb', 'carboidratos'], ['lip', 'lipídios']]) {
    if (Number.isNaN(m[k]) || (m[k] !== null && (m[k] < 0 || m[k] > 100))) return `Meta de ${rotulo}: informe um percentual entre 0 e 100.`;
  }
  for (const ref of plano.refeicoes) {
    for (const it of ref.itens) {
      if (!(it.g > 0) || it.g > 5000) return `Informe a quantidade (em gramas, até 5000) de "${it.nome}" na refeição "${ref.nome}".`;
    }
  }
  return null;
}

async function salvarPlano() {
  $('erro-plano').textContent = '';
  const problema = validarPlano();
  if (problema) { $('erro-plano').textContent = problema; return; }

  const metas = {};
  Object.entries(plano.metas).forEach(([k, v]) => { if (v !== null && v !== undefined) metas[k] = v; });
  const dados = {
    paciente_id: paciente.id,
    nome: plano.nome.trim().slice(0, 120),
    data_plano: plano.data_plano,
    metas,
    conteudo: {
      refeicoes: plano.refeicoes.map((r) => ({
        id: r.id, nome: (r.nome || '').trim() || 'Refeição', horario: r.horario || '', obs: (r.obs || '').trim(),
        itens: r.itens.map((i) => ({ ref: i.ref, nome: i.nome, g: i.g, medida: (i.medida || '').trim() })),
      })),
    },
    observacoes: plano.observacoes.trim() || null,
    atualizado_em: new Date().toISOString(),
  };

  $('btn-salvar-plano').disabled = true;
  let erro;
  if (plano.id) {
    ({ error: erro } = await db.from('planos').update(dados).eq('id', plano.id));
  } else {
    const r = await db.from('planos').insert(dados).select('id').single();
    erro = r.error;
    if (!erro) plano.id = r.data.id;
  }
  $('btn-salvar-plano').disabled = false;

  if (erro) {
    console.error(erro);
    $('erro-plano').textContent = 'Não foi possível salvar. Tente novamente.';
    return;
  }
  sujo = false;
  $('editor-titulo').textContent = 'Editar plano';
  avisar('Plano salvo.');
  await carregarPlanos();
}

// ---------- Impressão ----------
function imprimir() {
  const antes = sujo;
  lerCabecalho();
  sujo = antes;
  const incluir = $('chk-nutri').checked;
  const r = Nutricao.totais(plano.refeicoes, resolver);
  const area = $('impressao');
  area.replaceChildren();

  area.append(el('h1', null, 'Plano alimentar'));
  const meta = el('p', 'imp-meta');
  meta.textContent = `${paciente.nome} · ${plano.nome || 'Plano'} · ${plano.data_plano ? dataBR(plano.data_plano) : ''}`;
  area.append(meta);
  if (plano.metas.kcal > 0) area.append(el('p', null, `Meta de energia: ${fmt(plano.metas.kcal, 0)} kcal/dia`));

  plano.refeicoes.forEach((ref, i) => {
    const bloco = el('div', 'imp-refeicao');
    bloco.append(el('h2', null, `${ref.horario ? ref.horario + ' · ' : ''}${ref.nome}`));
    if (ref.itens.length) {
      const ul = el('ul');
      ref.itens.forEach((it) => {
        const qtd = it.medida && it.medida.trim() ? `${it.medida.trim()} (${fmt(it.g, 0)} g)` : `${fmt(it.g, 0)} g`;
        ul.append(el('li', null, `${it.nome}: ${qtd}`));
      });
      bloco.append(ul);
    } else {
      bloco.append(el('p', 'nota', '—'));
    }
    if (ref.obs) bloco.append(el('p', 'imp-obs', ref.obs));
    if (incluir && r.porRefeicao[i]) {
      const s = r.porRefeicao[i];
      bloco.append(el('p', 'imp-sub', `Energia ${fmt(s.kcal, 0)} kcal · P ${fmt(s.prot, 1)} g · C ${fmt(s.carb, 1)} g · L ${fmt(s.lip, 1)} g`));
    }
    area.append(bloco);
  });

  if (incluir) {
    const t = r.total;
    const d = Nutricao.distribuicao(t);
    area.append(el('h2', null, 'Totais do dia'));
    area.append(el('p', null, `Energia ${fmt(t.kcal, 0)} kcal · Proteínas ${fmt(t.prot, 1)} g (${fmt(d.prot, 0)}%) · Carboidratos ${fmt(t.carb, 1)} g (${fmt(d.carb, 0)}%) · Lipídios ${fmt(t.lip, 1)} g (${fmt(d.lip, 0)}%) · Fibra ${fmt(t.fibra, 1)} g`));
    if (r.semDados.length) area.append(el('p', 'imp-obs', 'Itens sem dados de energia na TACO (não somados): ' + r.semDados.join('; ') + '.'));
  }
  if (plano.observacoes && plano.observacoes.trim()) {
    area.append(el('h2', null, 'Orientações gerais'));
    area.append(el('p', 'imp-obs', plano.observacoes.trim()));
  }
  area.append(el('p', 'imp-fonte', 'Fonte dos dados nutricionais: ' + tacoMeta.fonte));
  window.print();
}
