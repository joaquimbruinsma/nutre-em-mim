// Alimentos próprios: cadastro de alimentos que não estão na TACO (valores por 100 g).
'use strict';

const $ = (id) => document.getElementById(id);
// [chave, rótulo, máximo]
const CAMPOS = [
  ['kcal', 'Energia (kcal)', 900], ['prot', 'Proteínas (g)', 100], ['carb', 'Carboidratos (g)', 100],
  ['lip', 'Lipídios (g)', 100], ['fibra', 'Fibra alimentar (g)', 100], ['sat', 'Gorduras saturadas (g)', 100],
  ['col', 'Colesterol (mg)', 100000], ['ca', 'Cálcio (mg)', 100000], ['fe', 'Ferro (mg)', 100000],
  ['na', 'Sódio (mg)', 100000], ['k', 'Potássio (mg)', 100000], ['vitc', 'Vitamina C (mg)', 100000],
];
const janela = $('janela');
let alimentos = [];
let editandoId = null;
let temporizador;

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}
function num(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function fmt(v) { return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); }
function avisar(texto) {
  const e = $('aviso');
  e.textContent = texto;
  e.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (e.hidden = true), 3500);
}

(async function iniciar() {
  const sessao = await exigirLogin();
  if (!sessao) return;
  $('btn-sair').addEventListener('click', sair);

  CAMPOS.forEach(([k, rotulo]) => {
    const campo = el('div', 'campo');
    const label = el('label', null, rotulo);
    label.htmlFor = 'n-' + k;
    const input = document.createElement('input');
    input.type = 'text'; input.inputMode = 'decimal'; input.id = 'n-' + k;
    campo.append(label, input);
    $('grade-nutrientes').append(campo);
  });

  $('btn-novo').addEventListener('click', () => abrir(null));
  $('btn-cancelar').addEventListener('click', () => janela.close());
  $('busca').addEventListener('input', desenhar);
  $('form-alimento').addEventListener('submit', salvar);
  await carregar();
})();

async function carregar() {
  const { data, error } = await db.from('alimentos_proprios').select('*').order('nome');
  if (error) {
    console.error(error);
    $('erro-pagina').textContent = 'Não foi possível carregar. Confira se o SQL do plano alimentar foi executado no Supabase.';
    return;
  }
  $('erro-pagina').textContent = '';
  alimentos = data;
  desenhar();
}

function desenhar() {
  const termo = $('busca').value.trim().toLowerCase();
  const corpo = $('lista');
  corpo.replaceChildren();
  const visiveis = alimentos.filter((a) => !termo || a.nome.toLowerCase().includes(termo));
  visiveis.forEach((a) => {
    const tr = el('tr');
    const kcal = a.nutrientes && typeof a.nutrientes.kcal === 'number' ? fmt(a.nutrientes.kcal) + ' kcal' : '—';
    tr.append(el('td', 'nome', a.nome), el('td', null, a.categoria || '—'), el('td', null, kcal), el('td', null, a.fonte || '—'));
    const acoes = el('td', 'acoes');
    const editar = el('button', 'btn btn-pequeno', 'Editar');
    editar.addEventListener('click', () => abrir(a));
    const apagar = el('button', 'btn btn-pequeno btn-perigo', 'Excluir');
    apagar.addEventListener('click', () => excluir(a));
    acoes.append(editar, apagar);
    tr.append(acoes);
    corpo.append(tr);
  });
  $('vazio').hidden = visiveis.length > 0;
}

function abrir(a) {
  editandoId = a ? a.id : null;
  $('janela-titulo').textContent = a ? 'Editar alimento' : 'Novo alimento';
  $('erro').textContent = '';
  $('a-nome').value = a ? a.nome : '';
  $('a-categoria').value = a && a.categoria ? a.categoria : '';
  $('a-fonte').value = a && a.fonte ? a.fonte : '';
  CAMPOS.forEach(([k]) => {
    const v = a && a.nutrientes ? a.nutrientes[k] : null;
    $('n-' + k).value = typeof v === 'number' ? String(v).replace('.', ',') : '';
  });
  janela.showModal();
  $('a-nome').focus();
}

async function salvar(e) {
  e.preventDefault();
  $('erro').textContent = '';
  const nome = $('a-nome').value.trim();
  if (!nome) { $('erro').textContent = 'Informe o nome do alimento.'; return; }

  const nutrientes = {};
  for (const [k, rotulo, max] of CAMPOS) {
    const v = num($('n-' + k).value);
    if (v === null) continue;
    if (Number.isNaN(v) || v < 0 || v > max) { $('erro').textContent = `${rotulo}: informe um valor entre 0 e ${max}.`; return; }
    nutrientes[k] = v;
  }
  if (typeof nutrientes.kcal !== 'number') { $('erro').textContent = 'Informe a energia (kcal por 100 g).'; return; }

  // Aviso (não bloqueia) se a energia destoa muito do que os macronutrientes indicam.
  const est = 4 * (nutrientes.prot || 0) + 9 * (nutrientes.lip || 0) + 4 * (nutrientes.carb || 0);
  if (est > 0 && nutrientes.kcal > 20 && Math.abs(est - nutrientes.kcal) / nutrientes.kcal > 0.3) {
    if (!confirm(`A energia informada (${fmt(nutrientes.kcal)} kcal) difere bastante do calculado pelos macronutrientes (cerca de ${fmt(est)} kcal). Salvar assim mesmo?`)) return;
  }

  const dados = {
    nome: nome.slice(0, 150),
    categoria: $('a-categoria').value.trim() || null,
    fonte: $('a-fonte').value.trim() || null,
    nutrientes,
  };
  $('btn-salvar').disabled = true;
  const resposta = editandoId
    ? await db.from('alimentos_proprios').update(dados).eq('id', editandoId)
    : await db.from('alimentos_proprios').insert(dados);
  $('btn-salvar').disabled = false;
  if (resposta.error) {
    console.error(resposta.error);
    $('erro').textContent = 'Não foi possível salvar. Tente novamente.';
    return;
  }
  janela.close();
  avisar(editandoId ? 'Alimento atualizado.' : 'Alimento cadastrado.');
  await carregar();
}

async function excluir(a) {
  if (!confirm(`Excluir "${a.nome}"? Planos que usam este alimento vão avisar que ele não foi encontrado.`)) return;
  const { error } = await db.from('alimentos_proprios').delete().eq('id', a.id);
  if (error) { console.error(error); avisar('Não foi possível excluir.'); return; }
  avisar('Alimento excluído.');
  await carregar();
}
