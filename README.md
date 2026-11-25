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

- As inscrições vão até o fim do dia do prazo (**23h59, horário de Brasília**).
- A partir das **00h do dia seguinte**, o primeiro acesso de qualquer inscrito faz o sorteio do grupo todo de uma vez.
  Quem estiver com a página aberta vê a tela mudar sozinha. Quem não estiver entra com o e-mail da inscrição, que precisa ser igual ao cadastrado.
- O sorteio forma um ciclo único (A→B→C→…→A) com **todos os inscritos**. Assim ninguém tira a si mesmo, ninguém é tirado duas vezes
  e ninguém fica sobrando, mesmo que cada pessoa clique em "Sortear" em horários diferentes.
  O botão "Sortear meu amigo secreto" só revela o nome que já estava reservado.
- Os pares ficam numa tabela que nem o admin consegue ler pela API.

> **Atenção:** entrar com o e-mail não verifica se a pessoa é dona dele. Quem souber o e-mail de alguém
> consegue ver quem essa pessoa tirou. Foi uma escolha consciente para manter simples.

## O que pode dar errado (e o que acontece)

Sempre que algo foge da regra, a pessoa vê os **contatos da organização** (editáveis no admin, em "Datas, local e contatos").

| Situação | O que o sistema faz | O que a organização faz |
|---|---|---|
| Sobrar alguém sem amigo / alguém tirar a si mesmo | Não acontece: o sorteio é feito de uma vez, em ciclo único | — |
| Várias pessoas abrindo à meia-noite ao mesmo tempo | O banco trava o grupo e sorteia uma vez só | — |
| E-mail digitado não bate | Mostra "não encontramos" + contatos | Confere o e-mail no admin e passa para a pessoa |
| Pessoa se inscreveu com e-mail errado | Igual acima | Remove e inclui de novo com o e-mail certo (ou só informa o e-mail cadastrado) |
| Perdeu o prazo de inscrição | Inscrição fechada; mostra contatos | Admin › **Incluir pessoa**: entra no meio de um par (A→nova→B). Só A muda de amigo e vê um aviso |
| Alguém desiste depois do sorteio | — | Admin › **Remover**: quem tirava essa pessoa passa a tirar quem ela tinha tirado. Só uma pessoa muda e vê o aviso "Seu amigo secreto mudou" |
| Menos de 3 inscritos no fim do prazo | Não sorteia; mostra "não pôde ser feito" + contatos | Inclui mais gente e usa **Sortear agora**, ou estende o prazo |
| Remover deixaria menos de 3 pessoas | Bloqueia (senão o segredo acaba) | **Desfazer e reabrir inscrições** |
| Algo deu muito errado | — | **Refazer sorteio** (todos podem tirar outra pessoa, inclusive quem já viu) |
| Quer adiar o sorteio | — | Muda "Inscrições até" para a nova data. Se já sorteou, **Desfazer e reabrir** depois de mudar a data |
| Alguém não viu o resultado | — | O admin mostra "Já sorteou" / "Ainda não viu" por pessoa (sem revelar os pares) |

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
3. `npm run db:push` (aplica as migrations). Sem a CLI: cole cada arquivo de `supabase/migrations/` no SQL Editor, em ordem.
4. Authentication › URL Configuration: **Site URL** = URL do Netlify; adicione `https://SEU-SITE.netlify.app/admin` em Redirect URLs.

### 2. Netlify
Importe o repositório. Build e redirects já estão no `netlify.toml`. Em Site settings › Environment variables:
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Operação

1. No `/admin`, aba do grupo: confira datas, local, prazo e contatos.
2. Divulgue o link (ou o QR code em `qrcode/`).
3. No dia seguinte ao prazo, o sorteio sai sozinho. Acompanhe no admin quem já sorteou.
4. Exceções: veja a tabela acima.

Para adicionar outro organizador" abaixo)
- Testes do banco (sorteio, permissões, entrar com e-mail): `npm run test:db`

## Produção

### 1. Supabase
1. Crie o projeto em <https://supabase.com>.
2. `npx supabase login` e `npx supabase link --project-ref SEU_REF`
3. `npm run db:push` (aplica as migrations). Sem a CLI: cole cada arquivo de `supabase/migrations/` no SQL Editor, em ordem.
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
