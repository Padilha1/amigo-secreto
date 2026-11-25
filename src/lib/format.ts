import type { Group } from './types'

/** '2026-12-08' → '08/12' */
export function shortDate(d: string | null | undefined) {
  if (!d) return null
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

/** '18:30:00' → '18h30' */
export function shortTime(t: string | null | undefined) {
  if (!t) return null
  const [h, m] = t.split(':')
  return m === '00' ? `${h}h` : `${h}h${m}`
}

export function money(v: number | null | undefined) {
  if (v == null) return null
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Mesma regra do banco (registration_is_open), só para a interface. */
export function isRegistrationOpen(g: Group) {
  if (!g.registration_open || g.drawn_at) return false
  if (!g.registration_deadline) return true
  return todaySP() <= g.registration_deadline
}

/** Data de hoje em Brasília, 'AAAA-MM-DD'. */
export function todaySP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** O prazo acabou e o sorteio ainda não foi feito (mesma regra do banco: draw_is_due). */
export function isDrawDue(g: Pick<Group, 'registration_open' | 'drawn_at' | 'registration_deadline'>) {
  return !g.drawn_at && g.registration_open && !!g.registration_deadline && todaySP() > g.registration_deadline
}

/** Dia seguinte ao prazo: '2026-12-01' → '02/12'. */
export function drawDay(deadline: string | null | undefined) {
  if (!deadline) return null
  const d = new Date(`${deadline}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return shortDate(d.toISOString().slice(0, 10))
}

/** Milissegundos até a meia-noite (Brasília, UTC-3) que encerra o prazo. */
export function msUntilDrawOpens(deadline: string | null | undefined) {
  if (!deadline) return null
  return new Date(`${deadline}T23:59:59.999-03:00`).getTime() + 1 - Date.now()
}

/** 'Matheus Padilha', 'Lucas Oshiro' ou 'Bianca Machado' */
export function contactList(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} ou ${names[names.length - 1]}`
}
