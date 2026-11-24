# Amigo Secreto · ACIPG / ACIPG Jovem

Inscrição (nome, e-mail, o que quer e o que não quer ganhar), sorteio sem repetição e revelação entrando com o e-mail.
Cada grupo (ACIPG e ACIPG Jovem) tem suas próprias datas, local, inscritos e sorteio — nada se mistura.

**Stack:** Vite + React + TanStack Router/Query + Tailwind v4 no front (Netlify) · Supabase (Postgres + RLS, Auth) no back.
Não há servidor Node próprio: as regras ficam no banco (funções SQL + RLS). O app não envia e-mails; só o login do admin usa o link mágico do Supabase.

## Rotas

| Rota | O que é |
|---|---|
| `/` | Escolha do grupo |
| `/acipg-jovem`, `/acipg` | Inscrição do grupo (link para divulgar) e "entrar com o e-mail" |
| `/p/:token` | Área da pessoa: edita sugestões até o sorteio; depois revela quem tirou |
| `/admin` | Painel do organizador (login por link mágico) |

## Como funciona o sorteio

`perform_draw` (SQL) embaralha **só os participantes marcados como presentes** e forma um ciclo único
A→B→C→…→A. Isso garante que ninguém tira a si mesmo e que cada pessoa é tirada exatamente uma vez
(além de `check` e `unique` no banco). Os pares ficam numa tabela que nem o admin consegue ler pela API;
cada pessoa vê o seu digitando o e-mail da inscrição na página do grupo.

> **Atenção:** entrar com o e-mail não verifica se a pessoa é dona dele. Quem souber o e-mail de alguém
> consegue ver quem essa pessoa tirou. Foi uma escolha consciente para manter simples.

## Rodar localmente

Requer Docker.

```bash
npm install
npx supabase start          # sobe Postgres/Auth/Functions e aplica a migration
cp .env.example .env.local  # cole a API URL e a anon key que o comando acima mostrou
npm run dev
```

- E-mails de login local aparecem no Inbucket/Mailpit: <http://127.0.0.1:54324>
- Admin: e-mails na tabela `admins` (veja "Para adicionar outro organizador" abaixo)
- Testes do banco (sorteio, permissões, entrar com e-mail): `npm run test:db`

## Produção

### 1. Supabase
1. Crie o projeto em <https://supabase.com>.
2. `npx supabase login` e `npx supabase link --project-ref SEU_REF`
3. `npm run db:push` (aplica a migration com os dois grupos e o admin)
4. Authentication › URL Configuration: **Site URL** = URL do Netlify; adicione `https://SEU-SITE.netlify.app/admin` em Redirect URLs.

### 2. Netlify
Importe o repositório. Build e redirects já estão no `netlify.toml`. Em Site settings › Environment variables:
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Operação no dia

1. No `/admin`, aba do grupo: confira datas/local (card **Datas e local**).
2. Na reunião, marque quem está **Presente** (ou "Marcar todos" e desmarque os ausentes).
3. **Realizar sorteio** → fecha inscrições e sorteia.
4. Cada um abre o link do grupo e entra com o e-mail para ver quem tirou. Se precisar refazer: **Desfazer sorteio**.

Para adicionar outro organizador: `insert into admins (email) values ('email@exemplo.com');` no SQL Editor.
