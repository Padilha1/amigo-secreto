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
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  return today <= g.registration_deadline
}
