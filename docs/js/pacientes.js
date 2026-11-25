// Módulo de pacientes: listar, buscar, cadastrar, editar e excluir.

let pacientes = [];
let editandoId = null;

const $ = (id) => document.getElementById(id);
const janela = $("janela");

// ---------- Início ----------
(async function iniciar() {
  const sessao = await exigirLogin();
  if (!sessao) return;
  await carregar();
})();

$("btn-sair").addEventListener("click", sair);
$("btn-novo").addEventListener("click", () => abrirFormulario(null));
$("btn-cancelar").addEventListener("click", () => janela.close());
$("busca").addEventListener("input", desenhar);
$("filtro").addEventListener("change", desenhar);
$("form-paciente").addEventListener("submit", salvar);

// ---------- Dados ----------
async function carregar() {
  const { data, error } = await db.from("pacientes").select("*").order("nome");
  if (error) {
    avisar("Não foi possível carregar os pacientes. Verifique a conexão.");
    console.error(error);
    return;
  }
  pacientes = data;
  desenhar();
}

async function salvar(e) {
  e.preventDefault();
  $("erro").textContent = "";

  const nome = $("nome").value.trim();
  if (!nome) {
    $("erro").textContent = "Informe o nome do paciente.";
    return;
  }

  const dados = {
    nome,
    data_nascimento: $("data_nascimento").value || null,
    sexo: $("sexo").value || null,
    telefone: $("telefone").value.trim() || null,
    email: $("email").value.trim() || null,
    objetivo: $("objetivo").value.trim() || null,
    observacoes: $("observacoes").value.trim() || null,
    ativo: $("ativo").checked,
  };

  const botao = $("btn-salvar");
  botao.disabled = true;

  const resposta = editandoId
    ? await db.from("pacientes").update(dados).eq("id", editandoId)
    : await db.from("pacientes").insert(dados);

  botao.disabled = false;

  if (resposta.error) {
    $("erro").textContent = "Não foi possível salvar. Tente novamente.";
    console.error(resposta.error);
    return;
  }

  janela.close();
  avisar(editandoId ? "Paciente atualizado." : "Paciente cadastrado.");
  await carregar();
}

async function excluir(p) {
  if (!confirm(`Excluir o paciente "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
  const { error } = await db.from("pacientes").delete().eq("id", p.id);
  if (error) {
    avisar("Não foi possível excluir o paciente.");
    console.error(error);
    return;
  }
  avisar("Paciente excluído.");
  await carregar();
}

// ---------- Tela ----------
function abrirFormulario(p) {
  editandoId = p ? p.id : null;
  $("janela-titulo").textContent = p ? "Editar paciente" : "Novo paciente";
  $("erro").textContent = "";
  $("nome").value = p?.nome ?? "";
  $("data_nascimento").value = p?.data_nascimento ?? "";
  $("sexo").value = p?.sexo ?? "";
  $("telefone").value = p?.telefone ?? "";
  $("email").value = p?.email ?? "";
  $("objetivo").value = p?.objetivo ?? "";
  $("observacoes").value = p?.observacoes ?? "";
  $("ativo").checked = p ? p.ativo : true;
  janela.showModal();
  $("nome").focus();
}

function desenhar() {
  const termo = $("busca").value.trim().toLowerCase();
  const filtro = $("filtro").value;

  const visiveis = pacientes.filter((p) => {
    if (filtro === "ativos" && !p.ativo) return false;
    if (filtro === "inativos" && p.ativo) return false;
    if (!termo) return true;
    return [p.nome, p.telefone, p.email].some((v) => (v || "").toLowerCase().includes(termo));
  });

  const corpo = $("lista");
  corpo.replaceChildren();

  visiveis.forEach((p) => {
    const tr = document.createElement("tr");
    tr.append(
      celula(p.nome, "nome"),
      celula(calcularIdade(p.data_nascimento)),
      celula(p.telefone || "—"),
      celula(p.objetivo || "—"),
      celulaSituacao(p.ativo),
      celulaAcoes(p)
    );
    corpo.append(tr);
  });

  $("vazio").hidden = visiveis.length > 0;
  const n = visiveis.length;
  $("total").textContent = n === 1 ? "1 paciente" : `${n} pacientes`;
}

// Os textos entram sempre por textContent (nunca innerHTML) para evitar código malicioso.
function celula(texto, classe) {
  const td = document.createElement("td");
  td.textContent = texto;
  if (classe) td.className = classe;
  return td;
}

function celulaSituacao(ativo) {
  const td = document.createElement("td");
  const selo = document.createElement("span");
  selo.className = "selo" + (ativo ? "" : " inativo");
  selo.textContent = ativo ? "Ativo" : "Inativo";
  td.append(selo);
  return td;
}

function celulaAcoes(p) {
  const td = document.createElement("td");
  td.className = "acoes";
  const avaliar = document.createElement("a");
  avaliar.className = "btn btn-pequeno";
  avaliar.textContent = "Avaliações";
  avaliar.href = "avaliacoes.html?paciente=" + encodeURIComponent(p.id);
  const editar = document.createElement("button");
  editar.className = "btn btn-pequeno";
  editar.textContent = "Editar";
  editar.addEventListener("click", () => abrirFormulario(p));
  const apagar = document.createElement("button");
  apagar.className = "btn btn-pequeno btn-perigo";
  apagar.textContent = "Excluir";
  apagar.addEventListener("click", () => excluir(p));
  td.append(avaliar, editar, apagar);
  return td;
}

function calcularIdade(dataISO) {
  if (!dataISO) return "—";
  const [a, m, d] = dataISO.split("-").map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) idade--;
  return idade + " anos";
}

let temporizador;
function avisar(texto) {
  const el = $("aviso");
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (el.hidden = true), 3500);
}
