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
  sort_order: number
}

export type Participant = {
  id: string
  group_id: string
  name: string
  email: string
  wishes: string[]
  dislikes: string[]
  present: boolean
  created_at: string
}

export type MyEntry = {
  name: string
  email: string
  wishes: string[]
  dislikes: string[]
  group: Pick<Group, 'slug' | 'name' | 'event_date' | 'event_time' | 'location' | 'gift_limit' | 'drawn_at'>
  receiver: { name: string; wishes: string[]; dislikes: string[] } | null
}
