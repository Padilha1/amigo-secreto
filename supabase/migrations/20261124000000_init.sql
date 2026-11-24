-- Amigo Secreto ACIPG / ACIPG Jovem
-- Cada grupo é isolado: participantes e sorteio pertencem a um único grupo.

create extension if not exists pgcrypto;

-- ───────────────────────── Tabelas ─────────────────────────

create table public.admins (
  email text primary key check (email = lower(email))
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  event_date date,                 -- dia da reunião/sorteio
  event_time time,                 -- horário (horário de Brasília)
  location text,                   -- local da reunião
  registration_deadline date,      -- último dia de inscrição (inclusive)
  gift_limit numeric(10,2),        -- valor máximo do presente
  registration_open boolean not null default false,
  drawn_at timestamptz,            -- preenchido quando o sorteio é feito
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  wishes text[] not null default '{}',
  dislikes text[] not null default '{}',
  present boolean not null default false,
  -- acesso da pessoa (obtido digitando o e-mail): editar sugestões e ver quem tirou
  access_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (group_id, email)
);
create index participants_group_idx on public.participants(group_id);

create table public.assignments (
  group_id uuid not null references public.groups(id) on delete cascade,
  giver_id uuid not null references public.participants(id) on delete cascade,
  receiver_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, giver_id),
  unique (group_id, receiver_id),          -- ninguém é tirado duas vezes
  check (giver_id <> receiver_id)          -- ninguém tira a si mesmo
);

-- ───────────────────────── Helpers ─────────────────────────

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.registration_is_open(g public.groups)
returns boolean
language sql stable
as $$
  select g.registration_open
     and g.drawn_at is null
     and (g.registration_deadline is null
          or (now() at time zone 'America/Sao_Paulo')::date <= g.registration_deadline);
$$;

-- limpa listas: tira espaços, vazios, duplicados; no máximo 10 itens de 80 caracteres
create or replace function public.clean_list(items text[])
returns text[]
language sql immutable
as $$
  select coalesce(array_agg(item order by first_pos), '{}')
  from (
    select left(trim(x), 80) as item, min(ord) as first_pos
    from unnest(coalesce(items, '{}')) with ordinality as t(x, ord)
    where trim(x) <> ''
    group by left(trim(x), 80)
    order by min(ord)
    limit 10
  ) s;
$$;

-- ───────────────────────── RLS ─────────────────────────

alter table public.admins enable row level security;
alter table public.groups enable row level security;
alter table public.participants enable row level security;
alter table public.assignments enable row level security;

-- grupos: leitura pública (datas, local, regras); escrita só admin
create policy groups_read on public.groups for select using (true);
create policy groups_admin_write on public.groups for update
  using (public.is_admin()) with check (public.is_admin());

-- participantes: só admin lê/edita/remove direto. O público usa as funções abaixo.
create policy participants_admin_select on public.participants for select using (public.is_admin());
create policy participants_admin_update on public.participants for update
  using (public.is_admin()) with check (public.is_admin());
create policy participants_admin_delete on public.participants for delete using (public.is_admin());

-- pares: ninguém lê pela API (nem o admin). Só via get_my_entry(token).
-- admins: admin pode ver a lista
create policy admins_read on public.admins for select using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.groups to anon, authenticated;
grant update (name, event_date, event_time, location, registration_deadline, gift_limit, registration_open)
  on public.groups to authenticated;
grant select, delete on public.participants to authenticated;
grant update (name, email, wishes, dislikes, present) on public.participants to authenticated;
grant select on public.admins to authenticated;

-- ───────────────────────── Funções públicas ─────────────────────────

-- Inscrição. Retorna o token de acesso da pessoa.
create or replace function public.register_participant(
  p_group_slug text, p_name text, p_email text, p_wishes text[], p_dislikes text[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  g public.groups;
  v_token uuid;
begin
  select * into g from public.groups where slug = p_group_slug;
  if not found then
    raise exception 'Grupo não encontrado' using errcode = 'P0002';
  end if;
  if not public.registration_is_open(g) then
    raise exception 'As inscrições deste grupo estão fechadas' using errcode = 'P0001';
  end if;

  insert into public.participants (group_id, name, email, wishes, dislikes)
  values (g.id, trim(p_name), lower(trim(p_email)), public.clean_list(p_wishes), public.clean_list(p_dislikes))
  returning access_token into v_token;

  return v_token;
exception
  when unique_violation then
    raise exception 'Este e-mail já está inscrito neste grupo' using errcode = '23505';
end;
$$;

-- Área da pessoa: dados da inscrição e, depois do sorteio, quem tirou.
create or replace function public.get_my_entry(p_token uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'name', p.name,
    'email', p.email,
    'wishes', p.wishes,
    'dislikes', p.dislikes,
    'group', json_build_object(
      'slug', g.slug, 'name', g.name, 'event_date', g.event_date, 'event_time', g.event_time,
      'location', g.location, 'gift_limit', g.gift_limit, 'drawn_at', g.drawn_at
    ),
    'receiver', (
      select json_build_object('name', r.name, 'wishes', r.wishes, 'dislikes', r.dislikes)
      from public.assignments a
      join public.participants r on r.id = a.receiver_id
      where a.giver_id = p.id
    )
  )
  from public.participants p
  join public.groups g on g.id = p.group_id
  where p.access_token = p_token;
$$;

-- "Entrar com o e-mail": devolve o token de acesso da pessoa naquele grupo (ou null).
-- Sem verificação de posse do e-mail, por decisão do projeto.
create or replace function public.find_entry(p_group_slug text, p_email text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select p.access_token
  from public.participants p
  join public.groups g on g.id = p.group_id
  where g.slug = p_group_slug and p.email = lower(trim(p_email));
$$;

-- Editar sugestões (até o sorteio).
create or replace function public.update_my_entry(p_token uuid, p_name text, p_wishes text[], p_dislikes text[])
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_drawn timestamptz;
begin
  select g.drawn_at into v_drawn
  from public.participants p join public.groups g on g.id = p.group_id
  where p.access_token = p_token;
  if not found then
    raise exception 'Inscrição não encontrada' using errcode = 'P0002';
  end if;
  if v_drawn is not null then
    raise exception 'O sorteio já foi feito; não dá mais para editar' using errcode = 'P0001';
  end if;

  update public.participants
     set name = trim(p_name),
         wishes = public.clean_list(p_wishes),
         dislikes = public.clean_list(p_dislikes)
   where access_token = p_token;
end;
$$;

-- ───────────────────────── Funções do admin ─────────────────────────

-- Sorteio: embaralha os presentes e forma um único ciclo (A→B→C→…→A).
-- Assim ninguém tira a si mesmo e cada pessoa é tirada exatamente uma vez.
create or replace function public.perform_draw(p_group_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  ids uuid[];
  n int;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  perform 1 from public.groups where id = p_group_id for update;
  if exists (select 1 from public.groups where id = p_group_id and drawn_at is not null) then
    raise exception 'O sorteio deste grupo já foi feito' using errcode = 'P0001';
  end if;

  select array_agg(id order by gen_random_uuid()) into ids
  from public.participants
  where group_id = p_group_id and present;

  n := coalesce(array_length(ids, 1), 0);
  if n < 3 then
    raise exception 'São necessários pelo menos 3 participantes presentes' using errcode = 'P0001';
  end if;

  insert into public.assignments (group_id, giver_id, receiver_id)
  select p_group_id, ids[i], ids[(i % n) + 1]
  from generate_series(1, n) as i;

  update public.groups set drawn_at = now(), registration_open = false where id = p_group_id;
  return n;
end;
$$;

-- Desfaz o sorteio (ex.: alguém esquecido). Os pares antigos são apagados.
create or replace function public.reset_draw(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  delete from public.assignments where group_id = p_group_id;
  update public.groups set drawn_at = null where id = p_group_id;
end;
$$;

revoke all on function public.register_participant(text, text, text, text[], text[]) from public;
revoke all on function public.get_my_entry(uuid) from public;
revoke all on function public.find_entry(text, text) from public;
grant execute on function public.find_entry(text, text) to anon, authenticated;
revoke all on function public.update_my_entry(uuid, text, text[], text[]) from public;
revoke all on function public.perform_draw(uuid) from public;
revoke all on function public.reset_draw(uuid) from public;
grant execute on function public.register_participant(text, text, text, text[], text[]) to anon, authenticated;
grant execute on function public.get_my_entry(uuid) to anon, authenticated;
grant execute on function public.update_my_entry(uuid, text, text[], text[]) to anon, authenticated;
grant execute on function public.perform_draw(uuid) to authenticated;
grant execute on function public.reset_draw(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ───────────────────────── Dados iniciais ─────────────────────────

insert into public.admins (email) values ('padilha.matheus@hotmail.com');

insert into public.groups
  (slug, name, event_date, event_time, location, registration_deadline, gift_limit, registration_open, sort_order)
values
  ('acipg-jovem', 'ACIPG Jovem', '2026-12-08', '18:30', null, '2026-12-01', 50, true, 1),
  ('acipg', 'ACIPG', null, null, null, null, 50, false, 2);
