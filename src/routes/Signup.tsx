import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import {
  DateTags,
  ErrorBox,
  Field,
  FullPageMessage,
  GiftIcon,
  InfoBox,
  PrimaryButton,
  Snowflake,
  Spinner,
  TagInput,
  inputClass,
} from '../components/ui'
import { isRegistrationOpen, money, shortDate, shortTime } from '../lib/format'
import { groupQuery, rememberToken, rememberedToken } from '../lib/queries'
import { errorMessage, supabase } from '../lib/supabase'
import type { Group } from '../lib/types'

export function Rules({ group }: { group: Group }) {
  const date = shortDate(group.event_date)
  const time = shortTime(group.event_time)
  const items = [
    date && `Para participar, precisa estar presente na reunião do dia ${date}${time ? ` às ${time}` : ''}`,
    group.location && `Local: ${group.location}`,
    'O sorteio é feito on-line; para ver quem tirou, entre aqui com seu e-mail',
    'Cada um pode inserir sugestões de presentes que gostaria de ganhar',
    group.gift_limit != null && `Valor do presente: até ${money(group.gift_limit)}`,
    'Busque produtos/serviços dos conselheiros',
    group.registration_deadline && `Inscrições até ${shortDate(group.registration_deadline)}`,
  ].filter(Boolean) as string[]

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 text-base leading-relaxed lg:text-[17px]">
      {items.map((t) => (
        <li key={t} className="flex gap-3">
          <span className="mt-2.5 size-2 shrink-0 rounded-full bg-pine" />
          {t}
        </li>
      ))}
    </ul>
  )
}

export function Signup() {
  const { slug } = useParams({ from: '/$slug' })
  const { data: group, isLoading } = useQuery(groupQuery(slug))

  if (isLoading)
    return (
      <div className="flex min-h-dvh items-center justify-center text-pine">
        <Spinner className="size-8" />
      </div>
    )
  if (!group)
    return (
      <FullPageMessage title="Grupo não encontrado">
        <Link to="/" className="font-bold text-pine">
          Voltar ao início
        </Link>
      </FullPageMessage>
    )

  const open = isRegistrationOpen(group)
  const existing = rememberedToken(group.slug)

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Snowflake className="right-[6%] top-10 hidden lg:block" size={64} />
      <Snowflake className="bottom-16 left-[3%] hidden lg:block" size={48} />

      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2 pt-4 lg:px-8 lg:pt-6">
        <Link
          to="/"
          aria-label="Voltar"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-ink"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="text-lg font-extrabold uppercase tracking-[0.04em] text-pine">{group.name}</span>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-16 pt-4 lg:flex-row lg:items-start lg:gap-12 lg:px-8 lg:pt-8">
        <section className="flex min-w-0 flex-col gap-6 lg:flex-1 lg:pt-4">
          <h1 className="m-0 font-display text-[40px] font-extrabold leading-none text-berry lg:text-[80px]">Amigo Secreto</h1>
          <DateTags date={shortDate(group.event_date)} time={shortTime(group.event_time)} size="lg" />
          <div className="hidden flex-col gap-3.5 lg:flex">
            <h2 className="m-0 text-[15px] font-extrabold uppercase tracking-[0.12em] text-berry">Regras e orientações</h2>
            <Rules group={group} />
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-6 lg:flex-1">
          {group.drawn_at ? (
            <EmailLogin group={group} existing={existing} title="O sorteio foi feito!" text="Entre com o e-mail que você usou na inscrição para ver quem tirou." primary />
          ) : open && !existing ? (
            <>
              <SignupForm group={group} />
              <EmailLogin group={group} existing={null} title="Já se inscreveu?" text="Entre com seu e-mail para ver ou editar suas sugestões." />
            </>
          ) : open ? (
            <EmailLogin group={group} existing={existing} title="Você já se inscreveu" text="Veja ou edite suas sugestões até o sorteio." primary />
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-3xl border border-line bg-paper p-6 lg:p-8">
                <h2 className="m-0 font-display text-2xl">Inscrições fechadas</h2>
                <p className="m-0 text-muted">
                  {group.event_date ? 'O prazo de inscrição terminou.' : 'As inscrições deste grupo ainda não abriram. Volte em breve!'}
                </p>
              </div>
              {group.event_date && (
                <EmailLogin group={group} existing={existing} title="Já se inscreveu?" text="Entre com seu e-mail para ver suas sugestões." />
              )}
            </>
          )}
        </div>

        <section className="flex flex-col gap-3.5 lg:hidden">
          <h2 className="m-0 text-[13px] font-extrabold uppercase tracking-[0.12em] text-berry">Regras e orientações</h2>
          <Rules group={group} />
        </section>
      </main>
    </div>
  )
}

function EmailLogin({
  group,
  existing,
  title,
  text,
  primary,
}: {
  group: Group
  existing: string | null
  title: string
  text: string
  primary?: boolean
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const find = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('find_entry', { p_group_slug: group.slug, p_email: email })
      if (error) throw error
      if (!data) throw new Error(`Não encontramos esse e-mail nas inscrições da ${group.name}.`)
      return data as string
    },
    onSuccess: (token) => {
      rememberToken(group.slug, token)
      navigate({ to: '/p/$token', params: { token } })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        find.mutate()
      }}
      className={`flex flex-col gap-4 rounded-3xl border bg-paper p-5 sm:p-8 ${primary ? 'border-pine shadow-[0_20px_50px_rgba(43,29,22,.08)]' : 'border-line'}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className={`m-0 font-display ${primary ? 'text-[28px] text-berry' : 'text-2xl text-ink'}`}>{title}</h2>
        <p className="m-0 text-[15px] text-muted">{text}</p>
      </div>
      {existing && (
        <Link
          to="/p/$token"
          params={{ token: existing }}
          className="flex h-14 items-center justify-center rounded-2xl bg-pine text-base font-extrabold text-white no-underline"
        >
          {group.drawn_at ? 'Ver quem eu tirei' : 'Ver minha inscrição'}
        </Link>
      )}
      <div className="flex gap-2">
        <label htmlFor={`login-${group.slug}`} className="sr-only">
          E-mail
        </label>
        <input
          id={`login-${group.slug}`}
          type="email"
          required
          autoComplete="email"
          placeholder={existing ? 'Ou entre com outro e-mail' : 'voce@empresa.com.br'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          disabled={find.isPending}
          className="flex h-[52px] shrink-0 items-center gap-2 rounded-[14px] border-[1.5px] border-pine bg-paper px-5 text-[15px] font-extrabold text-pine disabled:opacity-60"
        >
          {find.isPending && <Spinner />}
          Entrar
        </button>
      </div>
      {find.error && <ErrorBox>{errorMessage(find.error)}</ErrorBox>}
    </form>
  )
}

function SignupForm({ group }: { group: Group }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [wishes, setWishes] = useState<string[]>([])
  const [dislikes, setDislikes] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('register_participant', {
        p_group_slug: group.slug,
        p_name: name,
        p_email: email,
        p_wishes: wishes,
        p_dislikes: dislikes,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (token) => {
      rememberToken(group.slug, token)
      navigate({ to: '/p/$token', params: { token }, search: { novo: true } })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  const date = shortDate(group.event_date)
  const time = shortTime(group.event_time)

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 rounded-3xl border border-line bg-paper p-5 shadow-[0_20px_50px_rgba(43,29,22,.08)] sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-display text-[28px] text-ink">Faça sua inscrição</h2>
        <p className="m-0 text-[15px] text-muted">Suas sugestões ajudam quem te tirar a acertar no presente.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="sm:flex-1">
          <Field label="Nome completo" htmlFor="nome">
            <input id="nome" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="sm:flex-1">
          <Field label="E-mail" htmlFor="email" hint="Você vai usar este e-mail para ver quem tirou.">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="voce@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="h-px bg-line" />

      <TagInput
        label="O que você gostaria de ganhar"
        icon={<GiftIcon className="size-5 text-pine" />}
        values={wishes}
        onChange={setWishes}
        tone="pine"
        placeholder="Ex.: caneca, planta, vale-massagem…"
      />
      <TagInput
        label={
          <>
            O que você <span className="text-berry">não</span> quer ganhar
          </>
        }
        icon={
          <svg className="size-5 text-berry" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M5.6 5.6l12.8 12.8" />
          </svg>
        }
        values={dislikes}
        onChange={setDislikes}
        tone="berry"
        placeholder="Ex.: bebida alcoólica, roupa…"
      />

      {group.gift_limit != null && (
        <InfoBox>
          Presente de até <strong>{money(group.gift_limit)}</strong>.
          {date && (
            <>
              {' '}Para participar, é preciso estar na reunião de{' '}
              <strong>
                {date}
                {time && ` às ${time}`}
              </strong>
              {group.location && <> ({group.location})</>}.
            </>
          )}
        </InfoBox>
      )}

      {date && (
        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            required
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-pine"
          />
          Confirmo que estarei na reunião de {date}
          {time && ` às ${time}`}.
        </label>
      )}

      {mutation.error && <ErrorBox>{errorMessage(mutation.error)}</ErrorBox>}

      <PrimaryButton type="submit" loading={mutation.isPending}>
        Confirmar inscrição
      </PrimaryButton>
    </form>
  )
}
