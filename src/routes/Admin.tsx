import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent } from 'react'
import { CheckIcon, Chip, ErrorBox, Field, PrimaryButton, Spinner, inputClass } from '../components/ui'
import { isRegistrationOpen, shortDate } from '../lib/format'
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
  const presentCount = people.filter((p) => p.present).length
  const status = group.drawn_at ? 'Sorteado' : isRegistrationOpen(group) ? 'Inscrições abertas' : group.event_date ? 'Inscrições fechadas' : 'Aguardando'

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Inscritos" value={people.length} />
        <Stat label="Presentes" value={presentCount} tone="pine" />
        <Stat label="Status" value={status} tone="berry" small />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <Participants group={group} people={people} loading={isLoading} />
        </div>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <DrawCard group={group} presentCount={presentCount} people={people} />
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
  const key = participantsQuery(group.id).queryKey
  const locked = !!group.drawn_at

  const update = useMutation({
    mutationFn: async ({ ids, present }: { ids: string[]; present: boolean }) => {
      const { error } = await supabase.from('participants').update({ present }).in('id', ids)
      if (error) throw error
    },
    onMutate: async ({ ids, present }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old: Participant[] = []) => old.map((p) => (ids.includes(p.id) ? { ...p, present } : p)))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('participants').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return (
    <section className="overflow-hidden rounded-[20px] border border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4.5">
        <h2 className="m-0 text-[17px] font-extrabold">Participantes</h2>
        {!locked && people.length > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">Marque quem está na reunião</span>
            <button
              type="button"
              onClick={() => update.mutate({ ids: people.map((p) => p.id), present: presentAll(people) ? false : true })}
              className="min-h-11 font-extrabold text-pine"
            >
              {presentAll(people) ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
        )}
      </div>

      {(update.error || remove.error) && (
        <div className="px-5 pt-4">
          <ErrorBox>{errorMessage(update.error ?? remove.error)}</ErrorBox>
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
                  {locked ? (
                    p.present ? (
                      <span className="rounded-full bg-pine-soft px-3 py-1.5 text-xs font-extrabold text-pine">No sorteio</span>
                    ) : (
                      <span className="rounded-full bg-sand px-3 py-1.5 text-xs font-bold text-muted">Fora do sorteio</span>
                    )
                  ) : (
                    <button
                      type="button"
                      aria-pressed={p.present}
                      onClick={(e) => {
                        e.preventDefault()
                        update.mutate({ ids: [p.id], present: !p.present })
                      }}
                      className={
                        p.present
                          ? 'h-10 w-28 rounded-full bg-pine text-sm font-extrabold text-white'
                          : 'h-10 w-28 rounded-full border-[1.5px] border-line-strong text-sm font-bold text-muted'
                      }
                    >
                      {p.present ? 'Presente' : 'Ausente'}
                    </button>
                  )}
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
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover ${p.name} do grupo ${group.name}? Isso não pode ser desfeito.`)) remove.mutate(p.id)
                        }}
                        className="min-h-11 font-extrabold text-berry"
                      >
                        Remover inscrição
                      </button>
                    )}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const presentAll = (people: Participant[]) => people.length > 0 && people.every((p) => p.present)

function DrawCard({ group, presentCount, people }: { group: Group; presentCount: number; people: Participant[] }) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['groups'] })
    qc.invalidateQueries({ queryKey: ['participants', group.id] })
  }

  const draw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('perform_draw', { p_group_id: group.id })
      if (error) throw error
    },
    onSettled: refresh,
  })

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reset_draw', { p_group_id: group.id })
      if (error) throw error
    },
    onSettled: refresh,
  })

  const cantDraw = presentCount < 3
  const err = draw.error ?? reset.error

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border-[1.5px] border-berry bg-paper p-6">
      <h2 className="m-0 font-display text-[26px] text-berry">Sorteio</h2>
      {err && <ErrorBox>{errorMessage(err)}</ErrorBox>}

      {!group.drawn_at ? (
        <>
          <ul className="m-0 flex flex-col gap-2.5 pl-4.5 text-sm leading-relaxed text-ink-soft">
            <li>Só entra quem está marcado como presente.</li>
            <li>Ninguém tira a si mesmo, e cada pessoa é tirada uma única vez.</li>
            <li>Depois, cada um entra com o próprio e-mail na página do grupo para ver quem tirou.</li>
          </ul>
          <PrimaryButton
            type="button"
            disabled={cantDraw}
            loading={draw.isPending}
            onClick={() => {
              if (confirm(`Sortear entre ${presentCount} presentes de ${group.name}? As inscrições serão fechadas.`)) draw.mutate()
            }}
          >
            Realizar sorteio ({presentCount})
          </PrimaryButton>
          {cantDraw && <span className="text-[13px] text-muted">Mínimo de 3 presentes.</span>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-[14px] bg-pine-soft p-4">
            <CheckIcon className="size-7 shrink-0 text-pine" />
            <span className="text-[15px] font-bold text-pine-dark">
              Sorteio feito: {people.filter((p) => p.present).length} pares.
            </span>
          </div>
          <p className="m-0 text-sm leading-relaxed text-muted">Os pares ficam ocultos até para o organizador. Cada pessoa vê o seu entrando com o e-mail na página do grupo.</p>
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => {
              if (confirm('Desfazer o sorteio? Os pares atuais serão apagados e será preciso sortear de novo.')) reset.mutate()
            }}
            className="h-12 rounded-xl border-[1.5px] border-line-strong font-extrabold text-ink-soft"
          >
            Desfazer sorteio
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
      <h2 className="m-0 text-[17px] font-extrabold">Datas e local</h2>
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
        Inscrições abertas
        {form.registration_deadline && form.registration_open && (
          <span className="font-normal text-muted">(até {shortDate(form.registration_deadline)})</span>
        )}
      </label>
      {save.error && <ErrorBox>{errorMessage(save.error)}</ErrorBox>}
      {save.isSuccess && <p className="m-0 text-sm font-bold text-pine">Salvo.</p>}
      <button type="submit" disabled={save.isPending} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-pine font-extrabold text-white disabled:opacity-60">
        {save.isPending && <Spinner />}
        Salvar
      </button>
    </form>
  )
}
