-- Sorteio automático: as inscrições vão até o último minuto do dia do prazo (horário de Brasília).
-- A partir do dia seguinte, o primeiro acesso de qualquer pessoa faz o sorteio do grupo inteiro de uma vez
-- (ciclo único A→B→…→A). Assim nunca sobra ninguém, mesmo que cada pessoa "sorteie" em momentos diferentes.
-- Não existe mais presença: entram todos os inscritos.

-- ───────────────────────── Esquema ─────────────────────────

alter table public.participants drop column if exists present;
alter table public.participants add column if not exists revealed_at timestamptz;   -- última vez que viu quem tirou

-- marcado quando o par desta pessoa muda depois do sorteio (alguém saiu ou entrou)
alter table public.assignments add column if not exists changed_at timestamptz;

-- quem procurar quando algo der errado
alter table public.groups add column if not exists contacts text[] not null default '{}';
grant update (contacts) on public.groups to authenticated;

update public.groups set contacts = '{"Matheus Padilha","Lucas Oshiro","Bianca Machado"}'
where slug in ('acipg-jovem', 'acipg') and contacts = '{}';

-- remoção de participante passa a ser só pela função remove_participant (para religar os pares)
revoke delete on public.participants from authenticated;
drop policy if exists participants_admin_delete on public.participants;

-- ───────────────────────── Sorteio ─────────────────────────

-- O sorteio fica disponível no dia seguinte ao prazo de inscrição.
create or replace function public.draw_is_due(g public.groups)
returns boolean
language sql stable
as $$
  select g.drawn_at is null
     and g.registration_open
     and g.registration_deadline is not null
     and (now() at time zone 'America/Sao_Paulo')::date > g.registration_deadline;
$$;

-- Faz o sorteio de fato. Quem chama já travou a linha do grupo.
create or replace function public._draw(p_group_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  ids uuid[];
  n int;
begin
  select array_agg(id order by gen_random_uuid()) into ids
  from public.participants where group_id = p_group_id;

  n := coalesce(array_length(ids, 1), 0);
  if n < 3 then
    raise exception 'São necessários pelo menos 3 inscritos para sortear' using errcode = 'P0001';
  end if;

  delete from public.assignments where group_id = p_group_id;
  insert into public.assignments (group_id, giver_id, receiver_id)
  select p_group_id, ids[i], ids[(i % n) + 1]
  from generate_series(1, n) as i;

  update public.participants set revealed_at = null where group_id = p_group_id;
  update public.groups set drawn_at = now() where id = p_group_id;
  return n;
end;
$$;

-- Sorteia se já passou do prazo. Seguro com vários acessos ao mesmo tempo (trava o grupo).
-- Retorna: 'drawn' (sorteio feito), 'waiting' (ainda no prazo / grupo inativo) ou 'not_enough' (menos de 3).
create or replace function public._auto_draw(p_group_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  g public.groups;
begin
  select * into g from public.groups where id = p_group_id;
  if g.drawn_at is not null then return 'drawn'; end if;
  if not public.draw_is_due(g) then return 'waiting'; end if;

  select * into g from public.groups where id = p_group_id for update;
  if g.drawn_at is not null then return 'drawn'; end if;   -- outra pessoa sorteou enquanto esperávamos

  if (select count(*) from public.participants where group_id = p_group_id) < 3 then
    return 'not_enough';
  end if;
  perform public._draw(p_group_id);
  return 'drawn';
end;
$$;

-- Chamado pela página do grupo: libera o sorteio quando chega a hora.
create or replace function public.open_draw(p_group_slug text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.groups where slug = p_group_slug;
  if v_id is null then
    raise exception 'Grupo não encontrado' using errcode = 'P0002';
  end if;
  return public._auto_draw(v_id);
end;
$$;

-- ───────────────────────── Área da pessoa ─────────────────────────

drop function if exists public.get_my_entry(uuid);
create function public.get_my_entry(p_token uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_status text;
begin
  select group_id into v_group from public.participants where access_token = p_token;
  if v_group is null then return null; end if;

  v_status := public._auto_draw(v_group);

  return (
    select json_build_object(
      'name', p.name,
      'email', p.email,
      'wishes', p.wishes,
      'dislikes', p.dislikes,
      'revealed_at', p.revealed_at,
      'draw_status', v_status,
      'group', json_build_object(
        'slug', g.slug, 'name', g.name, 'event_date', g.event_date, 'event_time', g.event_time,
        'location', g.location, 'gift_limit', g.gift_limit, 'drawn_at', g.drawn_at,
        'registration_deadline', g.registration_deadline, 'contacts', g.contacts
      ),
      'receiver', (
        select json_build_object(
          'name', r.name, 'wishes', r.wishes, 'dislikes', r.dislikes,
          -- a pessoa já tinha visto um nome e depois o par mudou
          'changed', coalesce(a.changed_at > p.revealed_at, false)
        )
        from public.assignments a
        join public.participants r on r.id = a.receiver_id
        where a.giver_id = p.id
      )
    )
    from public.participants p
    join public.groups g on g.id = p.group_id
    where p.access_token = p_token
  );
end;
$$;

-- A pessoa abriu o presente: registra (o admin vê quem já viu, sem ver os pares).
create or replace function public.mark_revealed(p_token uuid)
returns void
language sql security definer set search_path = public
as $$
  update public.participants p set revealed_at = now()
  where p.access_token = p_token
    and exists (select 1 from public.assignments a where a.giver_id = p.id);
$$;

-- ───────────────────────── Admin ─────────────────────────

-- Sortear agora (antes do prazo, ou de novo depois de desfazer).
create or replace function public.perform_draw(p_group_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  perform 1 from public.groups where id = p_group_id for update;
  if exists (select 1 from public.groups where id = p_group_id and drawn_at is not null) then
    raise exception 'O sorteio deste grupo já foi feito' using errcode = 'P0001';
  end if;
  n := public._draw(p_group_id);
  update public.groups set registration_open = false where id = p_group_id;
  return n;
end;
$$;

-- Refazer: novo sorteio com todos os inscritos atuais (todo mundo pode tirar outra pessoa).
create or replace function public.redo_draw(p_group_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  perform 1 from public.groups where id = p_group_id for update;
  return public._draw(p_group_id);
end;
$$;

-- Desfazer: apaga os pares e reabre as inscrições (útil para adiar o sorteio).
create or replace function public.reset_draw(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  delete from public.assignments where group_id = p_group_id;
  update public.participants set revealed_at = null where group_id = p_group_id;
  update public.groups set drawn_at = null, registration_open = true where id = p_group_id;
end;
$$;

-- Incluir alguém (inclusive depois do prazo ou do sorteio).
-- Depois do sorteio, a pessoa entra no meio de um par sorteado A→B, que vira A→nova→B:
-- só A muda de amigo (e é avisado na tela dele); o resto continua igual.
create or replace function public.admin_add_participant(
  p_group_id uuid, p_name text, p_email text, p_wishes text[], p_dislikes text[]
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_token uuid;
  a public.assignments;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  perform 1 from public.groups where id = p_group_id for update;

  begin
    insert into public.participants (group_id, name, email, wishes, dislikes)
    values (p_group_id, trim(p_name), lower(trim(p_email)), public.clean_list(p_wishes), public.clean_list(p_dislikes))
    returning id, access_token into v_id, v_token;
  exception when unique_violation then
    raise exception 'Este e-mail já está inscrito neste grupo' using errcode = '23505';
  end;

  if exists (select 1 from public.groups where id = p_group_id and drawn_at is not null) then
    select * into a from public.assignments where group_id = p_group_id order by gen_random_uuid() limit 1;
    update public.assignments set receiver_id = v_id, changed_at = now()
      where group_id = p_group_id and giver_id = a.giver_id;
    insert into public.assignments (group_id, giver_id, receiver_id) values (p_group_id, v_id, a.receiver_id);
  end if;

  return v_token;
end;
$$;

-- Remover alguém. Depois do sorteio, religa o ciclo: quem tirava a pessoa removida passa a tirar
-- quem ela tirava (só essa pessoa muda de amigo e é avisada na tela).
create or replace function public.remove_participant(p_participant_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_giver uuid;
  v_receiver uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select group_id into v_group from public.participants where id = p_participant_id;
  if v_group is null then
    raise exception 'Participante não encontrado' using errcode = 'P0002';
  end if;
  perform 1 from public.groups where id = v_group for update;

  select giver_id into v_giver from public.assignments where receiver_id = p_participant_id;
  select receiver_id into v_receiver from public.assignments where giver_id = p_participant_id;

  if v_giver is not null and (select count(*) from public.participants where group_id = v_group) <= 3 then
    raise exception 'Com menos de 3 pessoas o sorteio perde o segredo. Desfaça o sorteio antes de remover.'
      using errcode = 'P0001';
  end if;

  delete from public.participants where id = p_participant_id;   -- apaga os 2 pares dela (cascade)

  if v_giver is not null and v_receiver is not null then
    insert into public.assignments (group_id, giver_id, receiver_id, changed_at)
    values (v_group, v_giver, v_receiver, now());
  end if;
end;
$$;

-- ───────────────────────── Permissões ─────────────────────────

revoke all on function public.draw_is_due(public.groups) from public;
revoke all on function public._draw(uuid) from public;
revoke all on function public._auto_draw(uuid) from public;
revoke all on function public.open_draw(text) from public;
revoke all on function public.get_my_entry(uuid) from public;
revoke all on function public.mark_revealed(uuid) from public;
revoke all on function public.perform_draw(uuid) from public;
revoke all on function public.redo_draw(uuid) from public;
revoke all on function public.reset_draw(uuid) from public;
revoke all on function public.admin_add_participant(uuid, text, text, text[], text[]) from public;
revoke all on function public.remove_participant(uuid) from public;

grant execute on function public.open_draw(text) to anon, authenticated;
grant execute on function public.get_my_entry(uuid) to anon, authenticated;
grant execute on function public.mark_revealed(uuid) to anon, authenticated;
grant execute on function public.perform_draw(uuid) to authenticated;
grant execute on function public.redo_draw(uuid) to authenticated;
grant execute on function public.reset_draw(uuid) to authenticated;
grant execute on function public.admin_add_participant(uuid, text, text, text[], text[]) to authenticated;
grant execute on function public.remove_participant(uuid) to authenticated;
