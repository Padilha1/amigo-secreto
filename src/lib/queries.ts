import { queryOptions } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { DrawStatus, Group, MyEntry, Participant } from './types'

export const groupsQuery = queryOptions({
  queryKey: ['groups'],
  queryFn: async () => {
    const { data, error } = await supabase.from('groups').select('*').order('sort_order')
    if (error) throw error
    return data as Group[]
  },
})

export const groupQuery = (slug: string) =>
  queryOptions({
    queryKey: ['groups', slug],
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('*').eq('slug', slug).maybeSingle()
      if (error) throw error
      return data as Group | null
    },
  })

export const myEntryQuery = (token: string) =>
  queryOptions({
    queryKey: ['my-entry', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_entry', { p_token: token })
      if (error) throw error
      return data as MyEntry | null
    },
    // enquanto o sorteio não sai, confere de minuto em minuto (quem deixou a página aberta vê na hora)
    refetchInterval: (q) => (q.state.data && !q.state.data.group.drawn_at ? 60_000 : false),
  })

/** Libera o sorteio automático quando o prazo acaba. */
export const drawStatusQuery = (slug: string, enabled: boolean) =>
  queryOptions({
    queryKey: ['draw-status', slug],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('open_draw', { p_group_slug: slug })
      if (error) throw error
      return data as DrawStatus
    },
  })

export const participantsQuery = (groupId: string) =>
  queryOptions({
    queryKey: ['participants', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('id, group_id, name, email, wishes, dislikes, revealed_at, created_at')
        .eq('group_id', groupId)
        .order('name')
      if (error) throw error
      return data as Participant[]
    },
  })

/** Guarda os links pessoais deste aparelho, para a pessoa voltar depois. */
const KEY = 'amigo-secreto:tokens'
export function rememberToken(slug: string, token: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    all[slug] = token
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* sem storage: tudo bem, dá para entrar com o e-mail */
  }
}
export function rememberedToken(slug: string): string | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')[slug] ?? null
  } catch {
    return null
  }
}
