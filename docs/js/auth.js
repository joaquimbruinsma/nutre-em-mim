// Funções de acesso usadas por todas as páginas internas.

// Se não houver login ativo, volta para a tela de entrada.
async function exigirLogin() {
  const { data } = await db.auth.getSession();
  if (!data.session) {
    window.location.replace("index.html");
    return null;
  }
  return data.session;
}

async function sair() {
  await db.auth.signOut();
  window.location.replace("index.html");
}
