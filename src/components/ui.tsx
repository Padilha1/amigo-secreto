import { useId, useState, type ReactNode } from 'react'

export function Snowflake({ className = '', size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      className={`pointer-events-none absolute text-gold ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" />
    </svg>
  )
}

export function GiftIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M12 8v13M3 12h18M12 8S9.5 3 7 4.5 8 8 12 8zM12 8s2.5-5 5-3.5S16 8 12 8z" />
    </svg>
  )
}

export function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

/** Etiquetas verdes "08/12 | 18h30", como no cartaz. */
export function DateTags({ date, time, size = 'md' }: { date: string | null; time: string | null; size?: 'md' | 'lg' }) {
  if (!date && !time) return null
  const text = size === 'lg' ? 'text-[28px] py-3' : 'text-[22px] py-2.5'
  const dot = <span className="size-2 rounded-full bg-cream" />
  return (
    <div className="flex flex-wrap gap-2.5">
      {date && (
        <div className={`tag-left flex items-center gap-2 bg-pine pl-8 pr-5 font-extrabold text-white ${text}`}>
          {dot}
          {date}
        </div>
      )}
      {time && (
        <div className={`tag-right flex items-center gap-2 bg-pine pl-5 pr-8 font-extrabold text-white ${text}`}>
          {time}
          {dot}
        </div>
      )}
    </div>
  )
}

export function GroupBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex rounded-full bg-pine px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-white">
      {name}
    </span>
  )
}

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-extrabold">
        {label}
      </label>
      {children}
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </div>
  )
}

export const inputClass =
  'h-[52px] w-full min-w-0 rounded-[14px] border-[1.5px] border-line-strong bg-paper px-4 text-base text-ink placeholder:text-[#8A7868] focus:border-pine focus:outline-none focus:ring-4 focus:ring-pine/15 disabled:opacity-60'

type Tone = 'pine' | 'berry'
const chipTone: Record<Tone, string> = {
  pine: 'bg-pine-soft text-pine-dark',
  berry: 'bg-berry-soft text-berry-dark',
}
const chipBtnTone: Record<Tone, string> = {
  pine: 'bg-pine-chip text-pine-dark',
  berry: 'bg-berry-chip text-berry-dark',
}

export function Chip({ children, tone, onRemove }: { children: string; tone: Tone; onRemove?: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full py-2 text-sm font-bold ${onRemove ? 'pl-3 pr-2' : 'px-3'} ${chipTone[tone]}`}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${children}`}
          className={`flex size-6 items-center justify-center rounded-full ${chipBtnTone[tone]}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  )
}

/** Lista de itens: digita, Enter ou "Adicionar" vira etiqueta. */
export function TagInput({
  label,
  values,
  onChange,
  tone,
  placeholder,
  icon,
  max = 10,
  disabled,
}: {
  label: ReactNode
  values: string[]
  onChange: (v: string[]) => void
  tone: Tone
  placeholder: string
  icon?: ReactNode
  max?: number
  disabled?: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const full = values.length >= max

  function add() {
    const v = draft.trim().slice(0, 80)
    if (!v) return
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase()) && !full) onChange([...values, v])
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        {icon}
        <label htmlFor={id} className="text-sm font-extrabold">
          {label}
        </label>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <Chip key={v} tone={tone} onRemove={disabled ? undefined : () => onChange(values.filter((x) => x !== v))}>
              {v}
            </Chip>
          ))}
        </div>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <input
            id={id}
            type="text"
            value={draft}
            maxLength={80}
            disabled={full}
            placeholder={full ? `Máximo de ${max} itens` : placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            onBlur={add}
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={add}
            disabled={full || !draft.trim()}
            className={
              tone === 'pine'
                ? 'h-[52px] shrink-0 rounded-[14px] bg-pine px-4 text-[15px] font-extrabold text-white disabled:opacity-50'
                : 'h-[52px] shrink-0 rounded-[14px] border-[1.5px] border-berry bg-paper px-4 text-[15px] font-extrabold text-berry disabled:opacity-50'
            }
          >
            Adicionar
          </button>
        </div>
      )}
    </div>
  )
}

export function PrimaryButton({ children, loading, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-berry px-6 text-[17px] font-extrabold text-white shadow-[0_8px_20px_rgba(179,32,42,.25)] transition hover:bg-berry-dark disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-[14px] border border-berry/30 bg-berry-soft px-4 py-3 text-sm font-semibold text-berry-dark">
      {children}
    </div>
  )
}

export function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-amber-line bg-amber-soft px-4 py-3.5">
      <svg className="mt-0.5 size-5 shrink-0 text-amber-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v5h1" />
      </svg>
      <p className="m-0 text-sm leading-relaxed text-amber-ink">{children}</p>
    </div>
  )
}

export function FullPageMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="m-0 font-display text-3xl font-extrabold text-berry">{title}</h1>
      {children && <div className="text-muted">{children}</div>}
    </div>
  )
}
