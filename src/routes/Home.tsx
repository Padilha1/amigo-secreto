import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { DateTags, GiftIcon, Snowflake, Spinner } from '../components/ui'
import { isRegistrationOpen, money, shortDate, shortTime } from '../lib/format'
import { groupsQuery } from '../lib/queries'
import type { Group } from '../lib/types'

function statusOf(g: Group) {
  if (g.drawn_at) return { label: 'Sorteado', hint: 'Entre com seu e-mail para ver quem tirou', open: true }
  if (isRegistrationOpen(g))
    return { label: 'Aberto', hint: g.registration_deadline ? `Inscrições até ${shortDate(g.registration_deadline)}` : 'Inscrições abertas', open: true }
  if (!g.event_date) return { label: 'Em breve', hint: 'Aguardando confirmação', open: false }
  return { label: 'Encerrado', hint: 'Inscrições encerradas', open: false }
}

export function Home() {
  const { data: groups, isLoading, error } = useQuery(groupsQuery)
  const featured = groups?.find((g) => isRegistrationOpen(g)) ?? groups?.[0]

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col gap-7 overflow-hidden px-6 pb-8 pt-14">
      <Snowflake className="right-5 top-5" size={44} />
      <Snowflake className="-left-2.5 top-32 opacity-60" size={34} />

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="m-0 text-[13px] font-extrabold uppercase tracking-[0.16em] text-pine">Natal {new Date().getFullYear()}</p>
        <h1 className="m-0 font-display text-[46px] font-extrabold leading-none text-berry">Amigo Secreto</h1>
      </div>

      {featured && (
        <div className="flex justify-center">
          <DateTags date={shortDate(featured.event_date)} time={shortTime(featured.event_time)} />
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        <h2 className="m-0 text-base font-extrabold">Escolha seu grupo</h2>
        {isLoading && (
          <div className="flex justify-center py-8 text-pine">
            <Spinner className="size-7" />
          </div>
        )}
        {error && <p className="text-sm text-berry">Não foi possível carregar os grupos.</p>}
        {groups?.map((g) => {
          const s = statusOf(g)
          return s.open ? (
            <Link
              key={g.id}
              to="/$slug"
              params={{ slug: g.slug }}
              className="flex items-center gap-3.5 rounded-[18px] border-[1.5px] border-pine bg-paper p-4.5 text-inherit no-underline shadow-[0_6px_18px_rgba(43,29,22,.08)] transition hover:-translate-y-0.5"
            >
              <div className="flex size-13 shrink-0 items-center justify-center rounded-[14px] bg-pine text-white">
                <GiftIcon className="size-6.5" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-lg font-extrabold text-pine">{g.name}</span>
                <span className="text-[13px] text-muted">{s.hint}</span>
              </div>
              <span className="shrink-0 rounded-full bg-pine-soft px-2.5 py-1 text-xs font-extrabold text-pine">{s.label}</span>
            </Link>
          ) : (
            <div key={g.id} className="flex items-center gap-3.5 rounded-[18px] border-[1.5px] border-dashed border-[#CDBBA6] bg-[#F4ECE0] p-4.5">
              <div className="flex size-13 shrink-0 items-center justify-center rounded-[14px] bg-[#E6D9C8] text-muted">
                <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-lg font-extrabold text-ink-soft">{g.name}</span>
                <span className="text-[13px] text-muted">{s.hint}</span>
              </div>
              <span className="shrink-0 rounded-full bg-[#E6D9C8] px-2.5 py-1 text-xs font-extrabold text-ink-soft">{s.label}</span>
            </div>
          )
        })}
      </div>

      {featured && (
        <ul className="m-0 mt-auto flex list-none flex-col gap-2.5 rounded-2xl border border-line bg-paper px-4.5 py-4 text-sm">
          {featured.gift_limit != null && (
            <li className="flex items-center gap-2.5">
              <span className="size-2 shrink-0 rounded-full bg-berry" />
              Presente de até <strong>{money(featured.gift_limit)}</strong>
            </li>
          )}
          <li className="flex items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full bg-berry" />
            Sorteio on-line na reunião
          </li>
          <li className="flex items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full bg-berry" />
            Prefira produtos/serviços dos conselheiros
          </li>
        </ul>
      )}
    </div>
  )
}
