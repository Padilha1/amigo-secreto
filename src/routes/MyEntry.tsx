import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import {
  CheckIcon,
  Chip,
  ContactBox,
  ErrorBox,
  Field,
  FullPageMessage,
  GiftIcon,
  GroupBadge,
  Snowflake,
  Spinner,
  TagInput,
  inputClass,
} from '../components/ui'
import { contactList, drawDay, money, shortDate, shortTime } from '../lib/format'
import { myEntryQuery } from '../lib/queries'
import { errorMessage, supabase } from '../lib/supabase'
import type { MyEntry as Entry } from '../lib/types'

export function MyEntry() {
  const { token } = useParams({ from: '/p/$token' })
  const { novo } = useSearch({ from: '/p/$token' })
  const { data: entry, isLoading, error } = useQuery(myEntryQuery(token))

  if (isLoading)
    return (
      <div className="flex min-h-dvh items-center justify-center text-pine">
        <Spinner className="size-8" />
      </div>
    )
  if (error || !entry)
    return (
      <FullPageMessage title="Link inválido">
        <p>Volte à página do seu grupo e entre com seu e-mail.</p>
        <Link to="/" className="font-bold text-pine">
          Ir para o início
        </Link>
      </FullPageMessage>
    )

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col gap-6 overflow-hidden px-6 pb-8 pt-12">
      <Snowflake className="right-5 top-6" size={40} />
      <Snowflake className="left-6 top-24 opacity-60" size={28} />
      {entry.group.drawn_at ? (
        entry.receiver ? (
          <Reveal entry={entry} token={token} />
        ) : (
          <NotInDraw entry={entry} />
        )
      ) : entry.draw_status === 'not_enough' ? (
        <NotEnough entry={entry} />
      ) : (
        <BeforeDraw entry={entry} token={token} isNew={!!novo} />
      )}
    </div>
  )
}

function Steps({ entry }: { entry: Entry }) {
  const g = entry.group
  const date = shortDate(g.event_date)
  const time = shortTime(g.event_time)
  const day = drawDay(g.registration_deadline)
  const steps = [
    {
      title: day ? `Sorteie em ${day}` : 'Sorteio on-line',
      text: day
        ? 'A partir de 00h, volte aqui (ou entre com seu e-mail na página do grupo) e sorteie seu amigo secreto.'
        : 'Quando o sorteio sair, entre com seu e-mail na página do grupo para ver quem tirou.',
    },
    g.gift_limit != null && { title: `Compre até ${money(g.gift_limit)}`, text: 'De preferência, de um conselheiro.' },
    date && {
      title: 'Troca de presentes',
      text: `Na reunião de ${date}${time ? ` às ${time}` : ''}${g.location ? ` · ${g.location}` : ''}.`,
    },
  ].filter(Boolean) as { title: string; text: string }[]

  return (
    <ol className="m-0 flex list-none flex-col rounded-[18px] border border-line bg-paper p-0">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3.5 border-b border-[#F0E6D8] px-4.5 py-4 last:border-b-0">
          <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-pine-soft text-sm font-extrabold text-pine">{i + 1}</span>
          <div className="flex flex-col gap-0.5">
            <strong className="text-[15px]">{s.title}</strong>
            <span className="text-sm text-muted">{s.text}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function BeforeDraw({ entry, token, isNew }: { entry: Entry; token: string; isNew: boolean }) {
  const qc = useQueryClient()
  const [name, setName] = useState(entry.name)
  const [wishes, setWishes] = useState(entry.wishes)
  const [dislikes, setDislikes] = useState(entry.dislikes)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(!isNew)

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('update_my_entry', { p_token: token, p_name: name, p_wishes: wishes, p_dislikes: dislikes })
      if (error) throw error
    },
    onSuccess: () => {
      setSaved(true)
      qc.invalidateQueries({ queryKey: ['my-entry', token] })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    save.mutate()
  }

  return (
    <>
      {isNew ? (
        <div className="flex flex-col items-center gap-4.5 text-center">
          <div className="flex size-24 items-center justify-center rounded-[28px] bg-pine text-white shadow-[0_12px_28px_rgba(30,94,58,.3)]">
            <CheckIcon className="size-11" />
          </div>
          <h1 className="m-0 font-display text-4xl font-extrabold leading-tight text-berry">Tudo certo, {entry.name.split(' ')[0]}!</h1>
          <p className="m-0 max-w-[300px] text-base leading-normal text-muted">
            Sua inscrição no Amigo Secreto da <strong className="text-pine">{entry.group.name}</strong> foi registrada.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            <GroupBadge name={entry.group.name} />
          </div>
          <h1 className="m-0 font-display text-[34px] font-extrabold leading-tight text-berry">Sua inscrição</h1>
          <p className="m-0 text-[15px] text-muted">
            Você pode editar suas sugestões até {entry.group.registration_deadline ? `${shortDate(entry.group.registration_deadline)} às 23h59` : 'o sorteio'}.
          </p>
        </div>
      )}

      {isNew && <Steps entry={entry} />}

      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Field label="Nome" htmlFor="nome">
            <input id="nome" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="E-mail" htmlFor="email" hint={`Para trocar o e-mail, fale com ${contactList(entry.group.contacts) || 'a organização'}.`}>
            <input id="email" value={entry.email} disabled className={inputClass} />
          </Field>
          <TagInput label="O que você gostaria de ganhar" icon={<GiftIcon className="size-5 text-pine" />} values={wishes} onChange={setWishes} tone="pine" placeholder="Ex.: caneca, planta…" />
          <TagInput
            label={
              <>
                O que você <span className="text-berry">não</span> quer ganhar
              </>
            }
            values={dislikes}
            onChange={setDislikes}
            tone="berry"
            placeholder="Ex.: bebida alcoólica…"
          />
          {save.error && <ErrorBox>{errorMessage(save.error)}</ErrorBox>}
          {saved && <p className="m-0 text-sm font-bold text-pine">Alterações salvas.</p>}
          <button type="submit" disabled={save.isPending} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-pine text-base font-extrabold text-white disabled:opacity-60">
            {save.isPending && <Spinner />}
            Salvar alterações
          </button>
        </form>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
          <button type="button" onClick={() => setEditing(true)} className="flex h-[54px] items-center justify-center rounded-2xl border-[1.5px] border-pine bg-paper text-base font-extrabold text-pine">
            Editar minhas sugestões
          </button>
          <p className="m-0 text-center text-[13px] text-muted">Dá para editar até o fim das inscrições{entry.group.registration_deadline ? ` (${shortDate(entry.group.registration_deadline)} às 23h59)` : ''}.</p>
        </div>
      )}
    </>
  )
}

function Reveal({ entry, token }: { entry: Entry; token: string }) {
  const firstTime = !entry.revealed_at
  const [phase, setPhase] = useState<'closed' | 'drawing' | 'open'>('closed')
  const r = entry.receiver!

  function open() {
    supabase.rpc('mark_revealed', { p_token: token }).then(() => {})
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return setPhase('open')
    setPhase('drawing')
    setTimeout(() => setPhase('open'), 1400)
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div>
          <GroupBadge name={entry.group.name} />
        </div>
        <p className="m-0 mt-2 text-[15px] text-muted">Olá, {entry.name.split(' ')[0]}. O sorteio está liberado!</p>
      </div>

      {r.changed && phase !== 'open' && (
        <ContactBox contacts={entry.group.contacts}>
          <strong>Seu amigo secreto mudou.</strong> Alguém saiu ou entrou no grupo depois do sorteio, então o nome que você viu antes não vale mais. Abra o
          presente para ver o novo. Dúvidas?
        </ContactBox>
      )}

      {phase !== 'open' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
          <h1 className="m-0 font-display text-4xl font-extrabold leading-tight text-berry">
            {phase === 'drawing' ? 'Sorteando…' : firstTime ? 'Sorteie seu amigo secreto' : 'Quem você tirou?'}
          </h1>
          <button
            type="button"
            onClick={open}
            disabled={phase === 'drawing'}
            aria-label={firstTime ? 'Sortear meu amigo secreto' : 'Abrir presente e ver quem tirei'}
            className={`size-[200px] cursor-pointer border-0 bg-transparent p-0 transition hover:scale-105 active:scale-95 ${phase === 'drawing' ? 'animate-gift-shake' : ''}`}
          >
            <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
              <rect x="30" y="80" width="140" height="100" rx="10" fill="#B3202A" />
              <rect x="22" y="58" width="156" height="34" rx="8" fill="#C8333C" />
              <rect x="90" y="58" width="20" height="122" fill="#C9A24B" />
              <path d="M100 58c-10-22-38-32-44-16-5 14 22 18 44 16zM100 58c10-22 38-32 44-16 5 14-22 18-44 16z" fill="none" stroke="#C9A24B" strokeWidth="8" strokeLinejoin="round" />
            </svg>
          </button>
          {phase === 'closed' && (
            <>
              <button
                type="button"
                onClick={open}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-berry text-base font-extrabold text-white shadow-[0_8px_20px_rgba(179,32,42,.25)]"
              >
                {firstTime ? 'Sortear meu amigo secreto' : r.changed ? 'Ver o novo nome' : 'Ver de novo'}
              </button>
              <p className="m-0 text-sm text-muted">Confira sem ninguém por perto!</p>
            </>
          )}
        </div>
      ) : (
        <div className="animate-pop-in flex flex-col gap-4.5">
          <div className="flex flex-col gap-1.5 rounded-[22px] bg-pine p-5.5 text-white">
            <span className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-pine-chip">Você tirou</span>
            <h1 className="m-0 font-display text-[38px] font-extrabold leading-tight">{r.name}</h1>
            {entry.group.gift_limit != null && <span className="text-sm text-pine-chip">Presente de até {money(entry.group.gift_limit)}</span>}
          </div>

          <div className="flex flex-col gap-3 rounded-[18px] border border-line bg-paper p-4.5">
            <h2 className="m-0 text-[15px] font-extrabold text-pine">Gostaria de ganhar</h2>
            {r.wishes.length ? (
              <div className="flex flex-wrap gap-2">
                {r.wishes.map((w) => (
                  <Chip key={w} tone="pine">
                    {w}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="m-0 text-sm text-muted">Sem sugestões — use a criatividade!</p>
            )}
          </div>

          {r.dislikes.length > 0 && (
            <div className="flex flex-col gap-3 rounded-[18px] border border-line bg-paper p-4.5">
              <h2 className="m-0 text-[15px] font-extrabold text-berry">Prefere não ganhar</h2>
              <div className="flex flex-wrap gap-2">
                {r.dislikes.map((w) => (
                  <Chip key={w} tone="berry">
                    {w}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPhase('closed')}
            className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-line-strong bg-transparent text-[15px] font-extrabold text-ink-soft"
          >
            Esconder
          </button>
          {entry.group.contacts.length > 0 && (
            <p className="m-0 text-center text-[13px] text-muted">
              Alguma dúvida? Fale com {contactList(entry.group.contacts)}.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function NotInDraw({ entry }: { entry: Entry }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div>
        <GroupBadge name={entry.group.name} />
      </div>
      <h1 className="m-0 font-display text-[34px] font-extrabold leading-tight text-berry">Você ainda não tem um amigo secreto</h1>
      <p className="m-0 text-muted">Sua inscrição não entrou neste sorteio. A organização consegue te incluir sem refazer o sorteio dos outros.</p>
      <ContactBox contacts={entry.group.contacts} />
    </div>
  )
}

function NotEnough({ entry }: { entry: Entry }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div>
        <GroupBadge name={entry.group.name} />
      </div>
      <h1 className="m-0 font-display text-[34px] font-extrabold leading-tight text-berry">O sorteio não pôde ser feito</h1>
      <p className="m-0 text-muted">As inscrições terminaram com menos de 3 pessoas, e assim não dá para sortear sem alguém tirar a si mesmo.</p>
      <ContactBox contacts={entry.group.contacts} />
    </div>
  )
}
