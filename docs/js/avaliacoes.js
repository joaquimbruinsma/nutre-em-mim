// Página de avaliação física de um paciente: formulário, resultados, histórico e gráficos.
'use strict';

const $ = (id) => document.getElementById(id);
const CIRCUNFERENCIAS = [
  ['cintura', 'Cintura'], ['quadril', 'Quadril'], ['abdomen', 'Abdômen'],
  ['braco', 'Braço relaxado'], ['coxa', 'Coxa'], ['panturrilha', 'Panturrilha'],
];
const NS_SVG = 'http://www.w3.org/2000/svg';

let paciente = null;
let avaliacoes = [];
let editandoId = null;
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
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Aceita vírgula ou ponto. Vazio => null. Texto inválido => NaN.
function num(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function avisar(texto) {
  const e = $('aviso');
  e.textContent = texto;
  e.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (e.hidden = true), 3500);
}
function sexoCodigo() {
  if (paciente.sexo === 'Feminino') return 'F';
  if (paciente.sexo === 'Masculino') return 'M';
  return null;
}
function erroPagina(texto) {
  $('erro-pagina').textContent = texto;
  $('conteudo').hidden = true;
}

// ---------- Início ----------
(async function iniciar() {
  const sessao = await exigirLogin();
  if (!sessao) return;
  $('btn-sair').addEventListener('click', sair);

  const id = new URLSearchParams(location.search).get('paciente');
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    erroPagina('Paciente não informado. Volte à lista e use o botão “Avaliações”.');
    return;
  }
  const { data, error } = await db.from('pacientes').select('*').eq('id', id).maybeSingle();
  if (error || !data) {
    if (error) console.error(error);
    erroPagina('Não foi possível abrir este paciente.');
    return;
  }
  paciente = data;
  $('conteudo').hidden = false;

  montarCabecalho();
  montarFormulario();
  limparFormulario();
  await carregar();
})();

function montarCabecalho() {
  const idade = Calculos.idadeEm(paciente.data_nascimento);
  const partes = [paciente.nome];
  if (idade !== null) partes.push(`${idade} anos`);
  if (paciente.sexo) partes.push(paciente.sexo);
  $('paciente-info').textContent = partes.join(' · ');
  $('aviso-cadastro').hidden = !!(sexoCodigo() && paciente.data_nascimento);
}

function campoNumerico(pai, id, rotulo) {
  const campo = el('div', 'campo');
  const label = el('label', null, rotulo);
  label.htmlFor = id;
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.id = id;
  campo.append(label, input);
  pai.append(campo);
  return campo;
}

function montarFormulario() {
  Object.entries(Calculos.LOCAIS).forEach(([k, rotulo]) => campoNumerico($('grade-dobras'), 'd-' + k, rotulo));
  CIRCUNFERENCIAS.forEach(([k, rotulo]) => campoNumerico($('grade-circ'), 'c-' + k, rotulo));

  const sel = $('f-protocolo');
  sel.append(new Option('Não calcular', ''));
  Object.entries(Calculos.PROTOCOLOS).forEach(([k, p]) => sel.append(new Option(p.nome, k)));
  sel.append(new Option('Informar o % de gordura (ex.: bioimpedância)', 'manual'));

  $('form-aval').addEventListener('input', atualizarResultados);
  $('form-aval').addEventListener('change', atualizarResultados);
  $('form-aval').addEventListener('submit', salvar);
  $('btn-limpar').addEventListener('click', limparFormulario);
}

// ---------- Formulário ----------
function limparFormulario() {
  editandoId = null;
  $('form-titulo').textContent = 'Nova avaliação';
  $('btn-salvar').textContent = 'Salvar avaliação';
  $('erro-aval').textContent = '';
  $('form-aval').reset();
  $('f-data').value = hojeISO();
  atualizarResultados();
}

function preencher(r) {
  editandoId = r.id;
  $('form-titulo').textContent = 'Editar avaliação de ' + dataBR(r.data_avaliacao);
  $('btn-salvar').textContent = 'Salvar alterações';
  $('erro-aval').textContent = '';
  $('f-data').value = r.data_avaliacao;
  $('f-peso').value = r.peso ?? '';
  $('f-altura').value = r.altura ?? '';
  Object.keys(Calculos.LOCAIS).forEach((k) => { $('d-' + k).value = (r.dobras || {})[k] ?? ''; });
  CIRCUNFERENCIAS.forEach(([k]) => { $('c-' + k).value = (r.circunferencias || {})[k] ?? ''; });
  $('f-protocolo').value = r.protocolo || '';
  $('f-pg').value = r.percentual_gordura_manual ?? '';
  $('f-fator').value = r.fator_atividade ?? '';
  $('f-obs').value = r.observacoes ?? '';
  atualizarResultados();
  $('form-titulo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function lerFormulario() {
  const ent = {
    data: $('f-data').value,
    peso: num($('f-peso').value),
    alturaCm: num($('f-altura').value),
    dobras: {},
    circ: {},
    protocolo: $('f-protocolo').value,
    pgManual: num($('f-pg').value),
    fator: num($('f-fator').value),
    obs: $('f-obs').value.trim(),
  };
  Object.keys(Calculos.LOCAIS).forEach((k) => {
    const v = num($('d-' + k).value);
    if (v !== null) ent.dobras[k] = v;
  });
  CIRCUNFERENCIAS.forEach(([k]) => {
    const v = num($('c-' + k).value);
    if (v !== null) ent.circ[k] = v;
  });
  return ent;
}

function validar(ent) {
  if (!ent.data) return 'Informe a data da avaliação.';
  if (!(ent.peso > 0)) return 'Informe o peso.';
  const limites = [
    ['Peso', ent.peso, 2, 400],
    ['Altura', ent.alturaCm, 30, 250],
    ['% de gordura', ent.protocolo === 'manual' ? ent.pgManual : null, 1, 70],
    ['Fator de atividade', ent.fator, 1, 2.5],
  ];
  Object.entries(ent.dobras).forEach(([k, v]) => limites.push(['Dobra ' + Calculos.LOCAIS[k], v, 1, 80]));
  CIRCUNFERENCIAS.forEach(([k, rotulo]) => limites.push([rotulo, ent.circ[k] ?? null, 5, 250]));
  for (const [rotulo, v, min, max] of limites) {
    if (v === null || v === undefined) continue;
    if (Number.isNaN(v) || v < min || v > max) return `${rotulo}: informe um valor entre ${min} e ${max}.`;
  }
  if ([ent.peso, ent.alturaCm, ent.pgManual, ent.fator].some((v) => Number.isNaN(v))) return 'Há um valor inválido no formulário.';
  return null;
}

async function salvar(e) {
  e.preventDefault();
  $('erro-aval').textContent = '';
  const ent = lerFormulario();
  const problema = validar(ent);
  if (problema) { $('erro-aval').textContent = problema; return; }

  const dados = {
    paciente_id: paciente.id,
    data_avaliacao: ent.data,
    peso: ent.peso,
    altura: ent.alturaCm,
    dobras: ent.dobras,
    circunferencias: ent.circ,
    protocolo: ent.protocolo || null,
    percentual_gordura_manual: ent.protocolo === 'manual' ? ent.pgManual : null,
    fator_atividade: ent.fator,
    observacoes: ent.obs || null,
  };

  $('btn-salvar').disabled = true;
  const resposta = editandoId
    ? await db.from('avaliacoes').update(dados).eq('id', editandoId)
    : await db.from('avaliacoes').insert(dados);
  $('btn-salvar').disabled = false;

  if (resposta.error) {
    console.error(resposta.error);
    $('erro-aval').textContent = 'Não foi possível salvar. Tente novamente.';
    return;
  }
  avisar(editandoId ? 'Avaliação atualizada.' : 'Avaliação salva.');
  limparFormulario();
  await carregar();
}

async function excluir(r) {
  if (!confirm(`Excluir a avaliação de ${dataBR(r.data_avaliacao)}? Essa ação não pode ser desfeita.`)) return;
  const { error } = await db.from('avaliacoes').delete().eq('id', r.id);
  if (error) { console.error(error); avisar('Não foi possível excluir.'); return; }
  if (editandoId === r.id) limparFormulario();
  avisar('Avaliação excluída.');
  await carregar();
}

async function carregar() {
  const { data, error } = await db
    .from('avaliacoes').select('*').eq('paciente_id', paciente.id).order('data_avaliacao', { ascending: true });
  if (error) { console.error(error); avisar('Não foi possível carregar o histórico.'); return; }
  avaliacoes = data;
  desenharHistorico();
}

// ---------- Cálculo ----------
function calcular(ent) {
  const sexo = sexoCodigo();
  const idade = Calculos.idadeEm(paciente.data_nascimento, ent.data || undefined);

  const imc = Calculos.imc(ent.peso, ent.alturaCm);
  const classificacao = Calculos.classificarImc(imc, idade);

  let gordura = null;
  let erroGordura = null;
  const avisos = [];
  if (ent.protocolo === 'manual') {
    if (ent.pgManual > 0) gordura = { percentual: ent.pgManual, soma: null, densidade: null };
    else erroGordura = 'Informe o % de gordura.';
  } else if (ent.protocolo) {
    const r = Calculos.percentualGordura(ent.protocolo, { sexo, idade, dobras: ent.dobras });
    if (r.ok) { gordura = r; avisos.push(...r.avisos); } else erroGordura = r.erro;
  }

  const pg = gordura ? gordura.percentual : null;
  const massaGorda = pg !== null && ent.peso > 0 ? (ent.peso * pg) / 100 : null;
  const mlg = massaGorda !== null ? ent.peso - massaGorda : null;
  const gasto = Calculos.gastoEnergetico({ sexo, idade, peso: ent.peso, alturaCm: ent.alturaCm, mlg });
  const rcq = ent.circ.cintura > 0 && ent.circ.quadril > 0 ? ent.circ.cintura / ent.circ.quadril : null;

  return { idade, imc, classificacao, gordura, erroGordura, avisos, massaGorda, mlg, gasto, rcq };
}

function entradaDeRegistro(r) {
  return {
    data: r.data_avaliacao,
    peso: r.peso,
    alturaCm: r.altura,
    dobras: r.dobras || {},
    circ: r.circunferencias || {},
    protocolo: r.protocolo || '',
    pgManual: r.percentual_gordura_manual,
    fator: r.fator_atividade,
  };
}

// ---------- Resultados ----------
function metrica(rotulo, valor, detalhe) {
  const caixa = el('div', 'metrica');
  caixa.append(el('span', 'metrica-rotulo', rotulo), el('strong', 'metrica-valor', valor));
  if (detalhe) caixa.append(el('span', 'metrica-detalhe', detalhe));
  return caixa;
}

function marcarLocais(ent) {
  const p = Calculos.PROTOCOLOS[ent.protocolo];
  const usados = p ? p.locais(sexoCodigo()) : [];
  Object.keys(Calculos.LOCAIS).forEach((k) => $('d-' + k).classList.toggle('usado', usados.includes(k)));
  $('campo-pg').hidden = ent.protocolo !== 'manual';
  if (p) {
    const nomes = usados.map((k) => Calculos.LOCAIS[k]).join(', ');
    $('dica-protocolo').textContent = `${p.nome} (${p.fonte}). Dobras usadas: ${nomes}.`;
  } else {
    $('dica-protocolo').textContent = '';
  }
}

function atualizarResultados() {
  const ent = lerFormulario();
  marcarLocais(ent);
  const r = calcular(ent);
  const area = $('resultados');
  area.replaceChildren();

  const resumo = el('div', 'resumo');
  resumo.append(
    metrica('IMC', r.imc !== null ? fmt(r.imc, 1) + ' kg/m²' : '—', r.classificacao),
    metrica('% de gordura', r.gordura ? fmt(r.gordura.percentual, 1) + '%' : '—',
      r.gordura && r.gordura.densidade ? `Densidade ${fmt(r.gordura.densidade, 4)} g/ml (Siri)` : null),
    metrica('Massa gorda', r.massaGorda !== null ? fmt(r.massaGorda, 1) + ' kg' : '—'),
    metrica('Massa livre de gordura', r.mlg !== null ? fmt(r.mlg, 1) + ' kg' : '—'),
    metrica('Relação cintura/quadril', r.rcq !== null ? fmt(r.rcq, 2) : '—')
  );
  area.append(resumo);

  if (r.erroGordura) area.append(el('p', 'nota', '% de gordura: ' + r.erroGordura));
  r.avisos.forEach((a) => area.append(el('p', 'aviso-calculo', a)));

  area.append(el('h3', null, 'Gasto energético (TMB estimada)'));
  const caixa = el('div', 'tabela-caixa');
  const tabela = el('table');
  const cab = el('tr');
  ['Equação', 'TMB (kcal/dia)', ent.fator > 0 ? `Gasto total × ${fmt(ent.fator, 2)}` : 'Gasto total', 'Observação']
    .forEach((t) => cab.append(el('th', null, t)));
  const thead = el('thead');
  thead.append(cab);
  const corpo = el('tbody');
  r.gasto.forEach((g) => {
    const tr = el('tr');
    tr.append(el('td', 'nome', g.nome));
    tr.append(el('td', null, g.valor !== null ? fmt(g.valor, 0) : '—'));
    tr.append(el('td', null, g.valor !== null && ent.fator > 0 ? fmt(g.valor * ent.fator, 0) : '—'));
    tr.append(el('td', 'obs', g.valor !== null ? (g.aviso || '') : g.motivo));
    corpo.append(tr);
  });
  tabela.append(thead, corpo);
  caixa.append(tabela);
  area.append(caixa);
}

// ---------- Histórico e gráficos ----------
function desenharHistorico() {
  const corpo = $('historico');
  corpo.replaceChildren();
  const pontosPeso = [];
  const pontosGordura = [];

  avaliacoes.forEach((reg) => {
    const r = calcular(entradaDeRegistro(reg));
    const tr = el('tr');
    tr.append(
      el('td', 'nome', dataBR(reg.data_avaliacao)),
      el('td', null, fmt(reg.peso, 1)),
      el('td', null, fmt(r.imc, 1)),
      el('td', null, r.gordura ? fmt(r.gordura.percentual, 1) + '%' : '—'),
      el('td', null, fmt(r.mlg, 1))
    );
    const acoes = el('td', 'acoes');
    const editar = el('button', 'btn btn-pequeno', 'Ver / editar');
    editar.addEventListener('click', () => preencher(reg));
    const apagar = el('button', 'btn btn-pequeno btn-perigo', 'Excluir');
    apagar.addEventListener('click', () => excluir(reg));
    acoes.append(editar, apagar);
    tr.append(acoes);
    corpo.append(tr);

    const t = Date.parse(reg.data_avaliacao);
    if (reg.peso > 0) pontosPeso.push({ t, y: reg.peso });
    if (r.gordura) pontosGordura.push({ t, y: r.gordura.percentual });
  });

  $('historico-vazio').hidden = avaliacoes.length > 0;

  const graficos = $('graficos');
  graficos.replaceChildren();
  if (avaliacoes.length) {
    graficos.append(grafico('Evolução do peso (kg)', pontosPeso), grafico('Evolução do % de gordura', pontosGordura));
  }
}

function svgEl(nome, atributos) {
  const e = document.createElementNS(NS_SVG, nome);
  Object.entries(atributos).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

function grafico(titulo, pontos) {
  const caixa = el('div', 'grafico');
  caixa.append(el('h3', null, titulo));
  if (pontos.length < 2) {
    caixa.append(el('p', 'nota', 'Registre pelo menos duas avaliações para ver a evolução.'));
    return caixa;
  }
  const W = 520, H = 200, esq = 48, dir = 16, topo = 16, base = 34;
  const ys = pontos.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const folga = (max - min) * 0.15;
  min -= folga; max += folga;
  const t0 = pontos[0].t;
  const t1 = pontos[pontos.length - 1].t;
  const X = (t) => esq + (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * (W - esq - dir));
  const Y = (v) => topo + (1 - (v - min) / (max - min)) * (H - topo - base);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': titulo, class: 'grafico-svg' });
  svg.append(svgEl('line', { x1: esq, y1: H - base, x2: W - dir, y2: H - base, class: 'eixo' }));
  svg.append(svgEl('line', { x1: esq, y1: topo, x2: esq, y2: H - base, class: 'eixo' }));
  const rotulo = (x, y, texto, ancora) => {
    const t = svgEl('text', { x, y, 'text-anchor': ancora, class: 'rotulo-grafico' });
    t.textContent = texto;
    svg.append(t);
  };
  rotulo(esq - 6, Y(max) + 4, fmt(max, 1), 'end');
  rotulo(esq - 6, Y(min) + 4, fmt(min, 1), 'end');
  rotulo(esq, H - 10, dataBR(new Date(t0).toISOString().slice(0, 10)), 'start');
  rotulo(W - dir, H - 10, dataBR(new Date(t1).toISOString().slice(0, 10)), 'end');

  svg.append(svgEl('polyline', { points: pontos.map((p) => `${X(p.t)},${Y(p.y)}`).join(' '), class: 'linha-grafico' }));
  pontos.forEach((p) => {
    svg.append(svgEl('circle', { cx: X(p.t), cy: Y(p.y), r: 4, class: 'ponto-grafico' }));
    rotulo(X(p.t), Y(p.y) - 9, fmt(p.y, 1), 'middle');
  });
  caixa.append(svg);
  return caixa;
}
