// Teste de ponta a ponta contra o Supabase LOCAL (npx supabase start).
// Uso: node scripts/test-db.mjs   — apaga os inscritos de teste ao final.
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
)
if (!env.API_URL?.includes('127.0.0.1')) throw new Error('Só roda contra o Supabase local')

const anon = createClient(env.API_URL, env.ANON_KEY)
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY)
let failures = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) failures++
}

const { data: groups } = await anon.from('groups').select('*').order('sort_order')
ok(groups.length === 2, 'público vê os 2 grupos')
const jovem = groups.find((g) => g.slug === 'acipg-jovem')
const acipg = groups.find((g) => g.slug === 'acipg')

// inscrições
const tokens = []
for (let i = 1; i <= 5; i++) {
  const { data, error } = await anon.rpc('register_participant', {
    p_group_slug: 'acipg-jovem', p_name: `Teste ${i}`, p_email: `TESTE${i}@exemplo.com`,
    p_wishes: [' Livro ', 'Livro', '', 'Café'], p_dislikes: ['Meias'],
  })
  ok(!error && data, `inscrição ${i}${error ? ': ' + error.message : ''}`)
  tokens.push(data)
}
const dup = await anon.rpc('register_participant', { p_group_slug: 'acipg-jovem', p_name: 'Outra Pessoa', p_email: 'teste1@exemplo.com', p_wishes: [], p_dislikes: [] })
ok(dup.error?.message.includes('já está inscrito'), 'e-mail duplicado no mesmo grupo é recusado')
const closed = await anon.rpc('register_participant', { p_group_slug: 'acipg', p_name: 'Fulano', p_email: 'a@b.com', p_wishes: [], p_dislikes: [] })
ok(closed.error?.message.includes('fechadas'), 'ACIPG (fechado) recusa inscrição')

const { data: leak } = await anon.from('participants').select('*')
ok(leak.length === 0, 'anônimo não lê a lista de participantes')
const { data: pairsLeak } = await anon.from('assignments').select('*')
ok((pairsLeak ?? []).length === 0, 'anônimo não lê os pares')

const { data: me } = await anon.rpc('get_my_entry', { p_token: tokens[0] })
ok(me.name === 'Teste 1' && me.email === 'teste1@exemplo.com', 'link pessoal mostra a inscrição (e-mail em minúsculas)')
ok(JSON.stringify(me.wishes) === '["Livro","Café"]', `listas limpas: ${JSON.stringify(me.wishes)}`)
ok(me.receiver === null, 'antes do sorteio não há par')

const found = await anon.rpc('find_entry', { p_group_slug: 'acipg-jovem', p_email: '  Teste1@Exemplo.com ' })
ok(found.data === tokens[0], 'entrar com o e-mail (ignora maiúsculas/espaços)')
const wrongGroup = await anon.rpc('find_entry', { p_group_slug: 'acipg', p_email: 'teste1@exemplo.com' })
ok(wrongGroup.data === null, 'e-mail de um grupo não entra no outro')
const unknown = await anon.rpc('find_entry', { p_group_slug: 'acipg-jovem', p_email: 'ninguem@exemplo.com' })
ok(unknown.data === null && !unknown.error, 'e-mail não inscrito não encontra nada')

const upd = await anon.rpc('update_my_entry', { p_token: tokens[0], p_name: 'Teste Um', p_wishes: ['Planta'], p_dislikes: [] })
ok(!upd.error, 'edição pelo link pessoal')

// admin
const adminEmail = 'padilha.matheus@hotmail.com'
const password = `local-test-${Math.random().toString(36).slice(2)}`
const { data: users } = await service.auth.admin.listUsers()
const existing = users.users.find((u) => u.email === adminEmail)
if (existing) await service.auth.admin.updateUserById(existing.id, { password })
else await service.auth.admin.createUser({ email: adminEmail, password, email_confirm: true })
const admin = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
await admin.auth.signInWithPassword({ email: adminEmail, password })
ok((await admin.rpc('is_admin')).data === true, 'admin reconhecido')

const notAdmin = await anon.rpc('perform_draw', { p_group_id: jovem.id })
ok(!!notAdmin.error, 'anônimo não consegue sortear')

const { data: list } = await admin.from('participants').select('id,name').eq('group_id', jovem.id).order('name', { ascending: false })
ok(list.length === 5, 'admin vê os 5 inscritos')

const few = await admin.rpc('perform_draw', { p_group_id: jovem.id })
ok(few.error?.message.includes('pelo menos 3'), 'sorteio exige 3 presentes')

// 4 presentes, 1 ausente
const absent = list.find((p) => p.name === 'Teste 5').id
await admin.from('participants').update({ present: true }).in('id', list.filter((p) => p.id !== absent).map((p) => p.id))
const adminPairs = await admin.from('assignments').select('*')

for (let round = 0; round < 20; round++) {
  if (round > 0) await admin.rpc('reset_draw', { p_group_id: jovem.id })
  const draw = await admin.rpc('perform_draw', { p_group_id: jovem.id })
  if (draw.error) { ok(false, `sorteio: ${draw.error.message}`); break }
  const { data: pairs } = await service.from('assignments').select('*').eq('group_id', jovem.id)
  const givers = new Set(pairs.map((p) => p.giver_id))
  const receivers = new Set(pairs.map((p) => p.receiver_id))
  const valid =
    pairs.length === 4 && givers.size === 4 && receivers.size === 4 &&
    pairs.every((p) => p.giver_id !== p.receiver_id) && !givers.has(absent) && !receivers.has(absent)
  if (!valid || round === 19) ok(valid, `sorteio válido em ${round + 1} rodadas (4 pares, sem repetição, ausente fora)`)
  if (!valid) break
}
ok((adminPairs.data ?? []).length === 0, 'nem o admin lê os pares pela API')

const again = await admin.rpc('perform_draw', { p_group_id: jovem.id })
ok(again.error?.message.includes('já foi feito'), 'não sorteia duas vezes')

const { data: reveal } = await anon.rpc('get_my_entry', { p_token: tokens[0] })
ok(reveal.receiver?.name?.startsWith('Teste'), `revelação pelo link: tirou ${reveal.receiver?.name}`)
const lateEdit = await anon.rpc('update_my_entry', { p_token: tokens[0], p_name: 'X', p_wishes: [], p_dislikes: [] })
ok(!!lateEdit.error, 'edição bloqueada após o sorteio')
const { data: g2 } = await anon.from('groups').select('registration_open, drawn_at').eq('id', jovem.id).single()
ok(!g2.registration_open && g2.drawn_at, 'inscrições fecham após o sorteio')

const anonUpdate = await anon.from('groups').update({ location: 'hack' }).eq('id', acipg.id).select()
ok(!anonUpdate.data?.length, 'anônimo não altera grupo')
const loc = await admin.from('groups').update({ location: 'Sede teste' }).eq('id', acipg.id).select()
ok(loc.data?.[0]?.location === 'Sede teste', 'admin altera local do grupo')

// limpeza: volta ao estado inicial
await admin.rpc('reset_draw', { p_group_id: jovem.id })
await service.from('participants').delete().like('email', 'teste%@exemplo.com')
await service.from('groups').update({ registration_open: true, location: null }).eq('id', jovem.id)
await service.from('groups').update({ location: null }).eq('id', acipg.id)

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo')
process.exit(failures ? 1 : 0)
