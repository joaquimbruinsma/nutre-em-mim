# Nutre em Mim — versão web (HTML + GitHub Pages + Supabase)

Etapa 1: login + cadastro de pacientes.

## Estrutura
```
nutre-em-mim-web/
├── docs/                 ← o site (é esta pasta que o GitHub Pages publica)
│   ├── index.html        (login)
│   ├── pacientes.html
│   ├── css/estilo.css
│   └── js/  config.js · auth.js · pacientes.js
├── database/schema.sql   (tabela + regras de segurança do Supabase)
└── README.md
```

## Passo a passo

### 1. Supabase (banco de dados e login)
1. Crie uma conta em supabase.com e clique em **New project**. Anote a senha do banco. Escolha a região mais próxima (de preferência a de São Paulo, se aparecer).
2. No menu, abra **SQL Editor**, cole o conteúdo de `database/schema.sql` e clique em **Run**.
3. Abra **Authentication > Users > Add user**, crie o e-mail e a senha da nutricionista e marque **Auto Confirm User**.
4. Em **Authentication > Sign In / Providers**, desative **Allow new users to sign up**.
5. Em **Project Settings > API**, copie a **Project URL** e a chave pública **anon** (se só aparecer a "publishable", veja a aba "Legacy API Keys").

### 2. Configurar o site (no VS Code)
1. Abra a pasta `nutre-em-mim-web` no VS Code.
2. Abra `docs/js/config.js` e cole a URL e a chave nos dois lugares indicados. Salve.
3. Teste antes de publicar: clique com o botão direito em `docs/index.html` > **Open with Live Server**.

### 3. GitHub (guardar e publicar o código)
1. Crie uma conta em github.com e **ative a verificação em duas etapas**.
2. Clique em **New repository**, nomeie como `nutre-em-mim` e deixe **Public**.
3. Na página do repositório, clique em **Add file > Upload files**, arraste o conteúdo da pasta (inclusive a pasta `docs`) e clique em **Commit changes**.

### 4. Ligar o GitHub Pages
1. No repositório, vá em **Settings > Pages**.
2. Em **Source**, escolha **Deploy from a branch**. Em **Branch**, escolha `main` e a pasta **/docs**. Clique em **Save**.
3. Espere cerca de 1 a 2 minutos. O endereço será `https://SEU-USUARIO.github.io/nutre-em-mim/`.

### 5. Ajuste final no Supabase
Em **Authentication > URL Configuration**, coloque o endereço do GitHub Pages em **Site URL**.

## Cuidados importantes
- O repositório é **público**: ali ficam só o código e a chave pública `anon`. **Nunca coloque** a chave `service_role`, dados de pacientes, backups ou planilhas.
- A proteção dos dados vem das regras (RLS) do `schema.sql`. Não as desative.
- Ative a verificação em duas etapas no Supabase, no GitHub e no Google.
- O plano gratuito do Supabase pausa o projeto após cerca de uma semana sem uso e não faz backup automático. Para uso real com pacientes, considere o plano Pro e/ou backups periódicos.
- Para testar, use apenas pacientes fictícios.
