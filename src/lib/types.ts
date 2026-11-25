export type Group = {
  id: string
  slug: string
  name: string
  event_date: string | null
  event_time: string | null
  location: string | null
  registration_deadline: string | null
  gift_limit: number | null
  registration_open: boolean
  drawn_at: string | null
  contacts: string[]
  sort_order: number
}

export type Participant = {
  id: string
  group_id: string
  name: string
  email: string
  wishes: string[]
  dislikes: string[]
  revealed_at: string | null
  created_at: string
}

export type MyEntry = {
  name: string
  email: string
  wishes: string[]
  dislikes: string[]
  revealed_at: string | null
  draw_status: DrawStatus
  group: Pick<Group, 'slug' | 'name' | 'event_date' | 'event_time' | 'location' | 'gift_limit' | 'drawn_at' | 'registration_deadline' | 'contacts'>
  receiver: { name: string; wishes: string[]; dislikes: string[]; changed: boolean } | null
}

/** drawn: sorteio feito · waiting: ainda no prazo · not_enough: prazo acabou com menos de 3 inscritos */
export type DrawStatus = 'drawn' | 'waiting' | 'not_enough'
