import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent } from 'react'
import { CheckIcon, Chip, ErrorBox, Field, PrimaryButton, Spinner, TagInput, inputClass } from '../components/ui'
import { drawDay, isDrawDue, isRegistrationOpen, shortDate } from '../lib/format'
import { groupsQuery, participantsQuery } from '../lib/queries'
import { errorMessage, supabase, supabaseConfigured } from '../lib/supabase'
import type { Group, Participant } from '../lib/types'

function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

export function Admin() {
  const session = useSession()

  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ['is-admin', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin')
      if (error) throw error
      return data as boolean
    },
  })

  if (!supabaseConfigured)
    return <Shell><ErrorBox>Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.</ErrorBox></Shell>
  if (session === undefined || (session && checking))
    return (
      <Shell>
        <div className="flex justify-center py-20 text-pine">
          <Spinner className="size-8" />
        </div>
      </Shell>
    )
  if (!session) return <Shell><Login /></Shell>
  if (!isAdmin)
    return (
      <Shell email={session.user.email}>
        <div className="mx-auto flex max-w-md flex-col gap-3 rounded-3xl border border-line bg-paper p-8">
          <h1 className="m-0 font-display text-2xl">Sem acesso</h1>
          <p className="m-0 text-muted">O e-mail {session.user.email} não está na lista de organizadores.</p>
        </div>
      </Shell>
    )

  return (
    <Shell email={session.user.email}>
      <Dashboard />
    </Shell>
  )
}

function Shell({ children, email }: { children: React.ReactNode; email?: string }) {
  return (
    <div className="min-h-dvh">
      <header className="bg-pine text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <span className="font-display text-[22px] font-extrabold">
            Amigo Secreto <span className="font-sans text-sm font-bold text-pine-chip">· painel</span>
          </span>
          {email && (
            <div className="flex items-center gap-3 text-sm text-pine-chip">
              <span className="hidden sm:inline">{email}</span>
              <button type="button" onClick={() => supabase.auth.signOut()} className="rounded-full border border-white/30 px-3 py-1.5 font-bold text-white">
                Sair
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const login = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      })
      if (error) throw error
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        login.mutate()
      }}
      className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-line bg-paper p-6 sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-3xl text-berry">Entrar</h1>
        <p className="m-0 text-muted">Enviamos um link de acesso para o seu e-mail.</p>
      </div>
      {login.isSuccess ? (
        <p className="m-0 rounded-[14px] bg-pine-soft px-4 py-3 font-bold text-pine-dark">Pronto! Abra o link que chegou em {email}.</p>
      ) : (
        <>
          <Field label="E-mail do organizador" htmlFor="admin-email">
            <input id="admin-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          {login.error && <ErrorBox>{errorMessage(login.error)}</ErrorBox>}
          <PrimaryButton type="submit" loading={login.isPending}>
            Receber link de acesso
          </PrimaryButton>
        </>
      )}
    </form>
  )
}

function Dashboard() {
  const { data: groups, isLoading } = useQuery(groupsQuery)
  const [groupId, setGroupId] = useState<string | null>(null)
  const group = groups?.find((g) => g.id === groupId) ?? groups?.[0]

  if (isLoading || !group)
    return (
      <div className="flex justify-center py-20 text-pine">
        <Spinner className="size-8" />
      </div>
    )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Grupo" className="flex gap-1.5 rounded-full bg-sand p-1">
          {groups!.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === group.id}
              onClick={() => setGroupId(g.id)}
              className={
                g.id === group.id
                  ? 'min-h-11 rounded-full bg-pine px-4.5 text-sm font-extrabold text-white'
                  : 'min-h-11 rounded-full px-4.5 text-sm font-bold text-ink-soft'
              }
            >
              {g.name}
            </button>
          ))}
        </div>
        <CopyLink slug={group.slug} />
      </div>
      <GroupPanel key={group.id} group={group} />
    </>
  )
}

function CopyLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/${slug}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-extrabold text-pine"
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
      </svg>
      {copied ? 'Link copiado!' : 'Copiar link de inscrição'}
    </button>
  )
}

function GroupPanel({ group }: { group: Group }) {
  const { data: people = [], isLoading } = useQuery(participantsQuery(group.id))
  const seen = people.filter((p) => p.revealed_at).length
  const status = group.drawn_at
    ? 'Sorteado'
    : isDrawDue(group)
      ? 'Sorteio pendente'
      : isRegistrationOpen(group)
        ? 'Inscrições abertas'
        : group.event_date
          ? 'Inscrições fechadas'
          : 'Aguardando'

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Inscritos" value={people.length} />
        {group.drawn_at ? (
          <Stat label="Já sortearam" value={`${seen} de ${people.length}`} tone="pine" />
        ) : (
          <Stat label="Sorteio libera" value={drawDay(group.registration_deadline) ? `${drawDay(group.registration_deadline)} · 00h` : '—'} tone="pine" small />
        )}
        <Stat label="Status" value={status} tone="berry" small />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <Participants group={group} people={people} loading={isLoading} />
        </div>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <DrawCard group={group} people={people} />
          <SettingsCard group={group} />
        </aside>
      </div>
    </>
  )
}

function Stat({ label, value, tone, small }: { label: string; value: string | number; tone?: 'pine' | 'berry'; small?: boolean }) {
  const color = tone === 'pine' ? 'text-pine' : tone === 'berry' ? 'text-berry' : 'text-ink'
  return (
    <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-paper p-5">
      <span className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted">{label}</span>
      <span className={`font-extrabold ${color} ${small ? 'pt-2 text-[22px]' : 'text-4xl'}`}>{value}</span>
    </div>
  )
}

function Participants({ group, people, loading }: { group: Group; people: Participant[]; loading: boolean }) {
  const qc = useQueryClient()
  const drawn = !!group.drawn_at

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('remove_participant', { p_participant_id: id })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['participants', group.id] }),
  })

  function confirmRemove(p: Participant) {
    const msg = drawn
      ? `Remover ${p.name}? O sorteio continua valendo: quem tirou ${p.name.split(' ')[0]} passa a tirar quem ${p.name.split(' ')[0]} tinha tirado, e verá um aviso na tela. Isso não pode ser desfeito.`
      : `Remover ${p.name} do grupo ${group.name}? Isso não pode ser desfeito.`
    if (confirm(msg)) remove.mutate(p.id)
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4.5">
        <h2 className="m-0 text-[17px] font-extrabold">Participantes</h2>
        <span className="text-sm text-muted">{drawn ? 'Os pares ficam ocultos; aqui você vê só quem já sorteou.' : 'Todos os inscritos entram no sorteio.'}</span>
      </div>

      {remove.error && (
        <div className="px-5 pt-4">
          <ErrorBox>{errorMessage(remove.error)}</ErrorBox>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-pine">
          <Spinner className="size-7" />
        </div>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <strong className="text-[17px]">Nenhum inscrito ainda</strong>
          <span className="max-w-[340px] text-sm text-muted">Compartilhe o link de inscrição quando as datas estiverem configuradas.</span>
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {people.map((p) => (
            <li key={p.id} className="border-b border-[#F0E6D8] last:border-b-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 flex-[1_1_220px] flex-col">
                    <span className="truncate text-[15px] font-extrabold">{p.name}</span>
                    <span className="truncate text-sm text-muted">{p.email}</span>
                  </div>
                  <span className="text-[13px] text-muted">{p.wishes.length} sugestões</span>
                  {drawn &&
                    (p.revealed_at ? (
                      <span className="rounded-full bg-pine-soft px-3 py-1.5 text-xs font-extrabold text-pine">Já sorteou</span>
                    ) : (
                      <span className="rounded-full bg-sand px-3 py-1.5 text-xs font-bold text-muted">Ainda não viu</span>
                    ))}
                </summary>
                <div className="flex flex-col gap-3 bg-cream/60 px-5 pb-4 pt-2">
                  <div className="flex flex-wrap gap-2">
                    {p.wishes.map((w) => (
                      <Chip key={w} tone="pine">{w}</Chip>
                    ))}
                    {p.dislikes.map((w) => (
                      <Chip key={w} tone="berry">{`Não: ${w}`}</Chip>
                    ))}
                    {!p.wishes.length && !p.dislikes.length && <span className="text-sm text-muted">Sem sugestões.</span>}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <button type="button" onClick={() => confirmRemove(p)} className="min-h-11 font-extrabold text-berry">
                      Remover inscrição
                    </button>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <AddParticipant group={group} />
    </section>
  )
}

/** Para quem perdeu o prazo ou errou o e-mail: entra sem refazer o sorteio dos outros. */
function AddParticipant({ group }: { group: Group }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_add_participant', {
        p_group_id: group.id,
        p_name: name,
        p_email: email,
        p_wishes: [],
        p_dislikes: [],
      })
      if (error) throw error
    },
    onSuccess: () => {
      setName('')
      setEmail('')
      qc.invalidateQueries({ queryKey: ['participants', group.id] })
    },
  })

  return (
    <details className="border-t border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center px-5 text-sm font-extrabold text-pine [&::-webkit-details-marker]:hidden">
        + Incluir pessoa {group.drawn_at ? '(depois do sorteio)' : ''}
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!group.drawn_at || confirm(`Incluir ${name} no sorteio já feito? Uma pessoa sorteada ao acaso passa a tirar ${name.split(' ')[0]} (e verá um aviso), e ${name.split(' ')[0]} fica com quem essa pessoa tinha tirado.`))
            add.mutate()
        }}
        className="flex flex-col gap-3 px-5 pb-5"
      >
        <p className="m-0 text-sm text-muted">
          Para quem perdeu o prazo ou se inscreveu com o e-mail errado. Funciona mesmo com as inscrições fechadas. A pessoa entra depois com este e-mail e pode
          {group.drawn_at ? ' sortear na hora.' : ' completar as sugestões.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input required minLength={2} placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} sm:flex-1`} aria-label="Nome" />
          <input required type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} sm:flex-1`} aria-label="E-mail" />
        </div>
        {add.error && <ErrorBox>{errorMessage(add.error)}</ErrorBox>}
        {add.isSuccess && <p className="m-0 text-sm font-bold text-pine">Incluída.</p>}
        <button type="submit" disabled={add.isPending} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-pine font-extrabold text-white disabled:opacity-60">
          {add.isPending && <Spinner />}
          Incluir
        </button>
      </form>
    </details>
  )
}

function DrawCard({ group, people }: { group: Group; people: Participant[] }) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['groups'] })
    qc.invalidateQueries({ queryKey: ['participants', group.id] })
  }
  const rpc = (fn: 'perform_draw' | 'redo_draw' | 'reset_draw') =>
    useMutation({
      mutationFn: async () => {
        const { error } = await supabase.rpc(fn, { p_group_id: group.id })
        if (error) throw error
      },
      onSettled: refresh,
    })
  const draw = rpc('perform_draw')
  const redo = rpc('redo_draw')
  const reset = rpc('reset_draw')

  const n = people.length
  const day = drawDay(group.registration_deadline)
  const err = draw.error ?? redo.error ?? reset.error
  const seen = people.filter((p) => p.revealed_at).length

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border-[1.5px] border-berry bg-paper p-6">
      <h2 className="m-0 font-display text-[26px] text-berry">Sorteio</h2>
      {err && <ErrorBox>{errorMessage(err)}</ErrorBox>}

      {!group.drawn_at ? (
        <>
          <ul className="m-0 flex flex-col gap-2.5 pl-4.5 text-sm leading-relaxed text-ink-soft">
            <li>
              {day ? (
                <>
                  Sai sozinho em <strong>{day} às 00h</strong>, no primeiro acesso de qualquer inscrito, com todos os inscritos.
                </>
              ) : (
                'Defina o prazo de inscrição para o sorteio sair sozinho.'
              )}
            </li>
            <li>É feito de uma vez para o grupo todo: ninguém tira a si mesmo e ninguém fica sem amigo.</li>
            <li>Com menos de 3 inscritos não sorteia; as pessoas veem os contatos da organização.</li>
          </ul>
          <button
            type="button"
            disabled={n < 3 || draw.isPending}
            onClick={() => {
              if (confirm(`Sortear agora entre os ${n} inscritos de ${group.name}? As inscrições serão fechadas.`)) draw.mutate()
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-berry font-extrabold text-berry disabled:opacity-50"
          >
            {draw.isPending && <Spinner />}
            Sortear agora ({n})
          </button>
          {n < 3 && <span className="text-[13px] text-muted">Mínimo de 3 inscritos.</span>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-[14px] bg-pine-soft p-4">
            <CheckIcon className="size-7 shrink-0 text-pine" />
            <span className="text-[15px] font-bold text-pine-dark">
              Sorteio feito: {n} pares. {seen} de {n} já sortearam.
            </span>
          </div>
          <p className="m-0 text-sm leading-relaxed text-muted">
            Os pares ficam ocultos até para o organizador. Se alguém sair ou entrar, use "Remover" ou "Incluir pessoa": só uma pessoa muda de amigo e é avisada.
          </p>
          <button
            type="button"
            disabled={redo.isPending}
            onClick={() => {
              if (confirm(`Refazer o sorteio inteiro? Todos podem tirar outra pessoa${seen ? `, inclusive os ${seen} que já viram` : ''}. Use só se algo deu muito errado.`))
                redo.mutate()
            }}
            className="h-12 rounded-xl border-[1.5px] border-line-strong font-extrabold text-ink-soft"
          >
            Refazer sorteio
          </button>
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => {
              if (confirm('Desfazer o sorteio e reabrir as inscrições? Os pares serão apagados. Se o prazo já passou, mude a data "Inscrições até" antes, senão o sorteio sai de novo no próximo acesso.'))
                reset.mutate()
            }}
            className="min-h-11 text-sm font-extrabold text-berry"
          >
            Desfazer e reabrir inscrições
          </button>
        </>
      )}
    </section>
  )
}

function SettingsCard({ group }: { group: Group }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: group.name,
    event_date: group.event_date ?? '',
    event_time: group.event_time?.slice(0, 5) ?? '',
    location: group.location ?? '',
    registration_deadline: group.registration_deadline ?? '',
    gift_limit: group.gift_limit?.toString() ?? '',
    registration_open: group.registration_open,
    contacts: group.contacts,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('groups')
        .update({
          name: form.name.trim(),
          event_date: form.event_date || null,
          event_time: form.event_time || null,
          location: form.location.trim() || null,
          registration_deadline: form.registration_deadline || null,
          gift_limit: form.gift_limit ? Number(form.gift_limit.replace(',', '.')) : null,
          registration_open: form.registration_open,
          contacts: form.contacts,
        })
        .eq('id', group.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const ids = (k: string) => `${group.id}-${k}`

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[20px] border border-line bg-paper p-6">
      <h2 className="m-0 text-[17px] font-extrabold">Datas, local e contatos</h2>
      <Field label="Nome do grupo" htmlFor={ids('name')}>
        <input id={ids('name')} required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data da reunião" htmlFor={ids('date')}>
          <input id={ids('date')} type="date" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Horário" htmlFor={ids('time')}>
          <input id={ids('time')} type="time" value={form.event_time} onChange={(e) => set('event_time', e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Local" htmlFor={ids('location')}>
        <input id={ids('location')} placeholder="Ex.: Sede da ACIPG" value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inscrições até" htmlFor={ids('deadline')}>
          <input id={ids('deadline')} type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Valor máx. (R$)" htmlFor={ids('limit')}>
          <input id={ids('limit')} inputMode="decimal" placeholder="50" value={form.gift_limit} onChange={(e) => set('gift_limit', e.target.value)} className={inputClass} />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
        <input
          type="checkbox"
          checked={form.registration_open}
          disabled={!!group.drawn_at}
          onChange={(e) => set('registration_open', e.target.checked)}
          className="size-5 accent-pine"
        />
        Grupo ativo
        {form.registration_deadline && form.registration_open && (
          <span className="font-normal text-muted">(inscrições até {shortDate(form.registration_deadline)} às 23h59)</span>
        )}
      </label>
      <TagInput
        label="Contatos da organização"
        values={form.contacts}
        onChange={(v) => set('contacts', v)}
        tone="pine"
        placeholder="Ex.: Matheus Padilha"
      />
      <p className="-mt-2 m-0 text-[13px] text-muted">Aparecem para os participantes quando algo dá errado (e-mail não encontrado, poucos inscritos, par alterado).</p>
      {save.error && <ErrorBox>{errorMessage(save.error)}</ErrorBox>}
      {save.isSuccess && <p className="m-0 text-sm font-bold text-pine">Salvo.</p>}
      <button type="submit" disabled={save.isPending} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-pine font-extrabold text-white disabled:opacity-60">
        {save.isPending && <Spinner />}
        Salvar
      </button>
    </form>
  )
}
