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
const { data: admins } = await service.from('admins').select('email').limit(1)
const adminEmail = admins[0].email
const password = `local-test-${Math.random().toString(36).slice(2)}`
const { data: users } = await service.auth.admin.listUsers()
const existing = users.users.find((u) => u.email === adminEmail)
if (existing) await service.auth.admin.updateUserById(existing.id, { password })
else await service.auth.admin.createUser({ email: adminEmail, password, email_confirm: true })
const admin = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
await admin.auth.signInWithPassword({ email: adminEmail, password })
ok((await admin.rpc('is_admin')).data === true, 'admin reconhecido')

const notAdmin = await anon.rpc('perform_draw', { p_group_id: jovem.id })
ok(!!notAdmin.error, 'anônimo não consegue sortear pelo admin')

const { data: list } = await admin.from('participants').select('id,name,access_token').eq('group_id', jovem.id).order('name')
ok(list.length === 5, 'admin vê os 5 inscritos')
const idOf = (name) => list.find((p) => p.name === name).id

// ciclo válido: cada um dá e recebe exatamente uma vez, ninguém tira a si mesmo, um único ciclo
async function checkCycle(expected) {
  const { data: pairs } = await service.from('assignments').select('*').eq('group_id', jovem.id)
  const next = new Map(pairs.map((p) => [p.giver_id, p.receiver_id]))
  let cur = pairs[0]?.giver_id, steps = 0
  do { cur = next.get(cur); steps++ } while (cur && cur !== pairs[0].giver_id && steps <= pairs.length)
  return pairs.length === expected && new Set(pairs.map((p) => p.receiver_id)).size === expected &&
    pairs.every((p) => p.giver_id !== p.receiver_id) && steps === expected
}

// ainda no prazo: nada acontece
ok((await anon.rpc('open_draw', { p_group_slug: 'acipg-jovem' })).data === 'waiting', 'antes do fim do prazo o sorteio não abre')

// prazo vencido (ontem) → primeiro acesso sorteia; vários acessos simultâneos sorteiam uma vez só
const yesterday = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10)
await admin.from('groups').update({ registration_deadline: yesterday }).eq('id', jovem.id)
const lateSignup = await anon.rpc('register_participant', { p_group_slug: 'acipg-jovem', p_name: 'Atrasado', p_email: 'teste-atrasado@exemplo.com', p_wishes: [], p_dislikes: [] })
ok(lateSignup.error?.message.includes('fechadas'), 'depois do prazo não aceita inscrição')
const races = await Promise.all(list.map((p) => anon.rpc('get_my_entry', { p_token: p.access_token })))
ok(races.every((r) => !r.error && r.data.receiver), 'acessos simultâneos: todos recebem um par')
const { data: g1 } = await service.from('groups').select('drawn_at').eq('id', jovem.id).single()
ok(!!g1.drawn_at && (await checkCycle(5)), 'sorteio automático válido: 5 pares, sem repetição, ciclo único')
ok((await anon.rpc('open_draw', { p_group_slug: 'acipg-jovem' })).data === 'drawn', 'página do grupo vê o sorteio liberado')

let allValid = true
for (let round = 0; round < 20; round++) {
  const r = await admin.rpc('redo_draw', { p_group_id: jovem.id })
  if (r.error || !(await checkCycle(5))) { allValid = false; break }
}
ok(allValid, 'refazer sorteio 20x: sempre válido')
ok(!!(await anon.rpc('redo_draw', { p_group_id: jovem.id })).error, 'anônimo não refaz o sorteio')
ok(((await admin.from('assignments').select('*')).data ?? []).length === 0, 'nem o admin lê os pares pela API')

// revelar
const t1 = list.find((p) => p.name === 'Teste Um').access_token
await anon.rpc('mark_revealed', { p_token: t1 })
const { data: seen } = await admin.from('participants').select('revealed_at').eq('access_token', t1).single()
ok(!!seen.revealed_at, 'admin sabe quem já viu')
const lateEdit = await anon.rpc('update_my_entry', { p_token: t1, p_name: 'Teste Um', p_wishes: [], p_dislikes: [] })
ok(!!lateEdit.error, 'edição bloqueada após o sorteio')

// alguém sai depois do sorteio: quem tirava a pessoa passa a tirar o amigo dela
const t1id = idOf('Teste Um')
const { data: before } = await service.from('assignments').select('*').eq('group_id', jovem.id)
const victim = before.find((p) => p.giver_id === t1id).receiver_id  // a pessoa que Teste Um tirou sai
const victimReceiver = before.find((p) => p.giver_id === victim).receiver_id
const rm = await admin.rpc('remove_participant', { p_participant_id: victim })
ok(!rm.error && (await checkCycle(4)), `remover depois do sorteio religa o ciclo (4 pares)${rm.error ? ': ' + rm.error.message : ''}`)
const { data: after1 } = await anon.rpc('get_my_entry', { p_token: t1 })
const newName = list.find((p) => p.id === victimReceiver).name
ok(after1.receiver.name === newName && after1.receiver.changed === true, `quem já tinha visto é avisado da troca (agora: ${newName})`)

// alguém entra depois do sorteio
const add = await admin.rpc('admin_add_participant', { p_group_id: jovem.id, p_name: 'Teste Novo', p_email: 'teste-novo@exemplo.com', p_wishes: ['Livro'], p_dislikes: [] })
ok(!add.error && (await checkCycle(5)), `incluir depois do sorteio mantém o ciclo (5 pares)${add.error ? ': ' + add.error.message : ''}`)
const { data: novo } = await anon.rpc('get_my_entry', { p_token: add.data })
ok(!!novo?.receiver, 'quem entrou depois já tem par')
ok(!!(await anon.rpc('admin_add_participant', { p_group_id: jovem.id, p_name: 'X X', p_email: 'x@x.com', p_wishes: [], p_dislikes: [] })).error, 'anônimo não inclui ninguém')

// não deixa cair para menos de 3
const { data: rest } = await admin.from('participants').select('id').eq('group_id', jovem.id)
await admin.rpc('remove_participant', { p_participant_id: rest[0].id })
await admin.rpc('remove_participant', { p_participant_id: rest[1].id })
const tooFew = await admin.rpc('remove_participant', { p_participant_id: rest[2].id })
ok(tooFew.error?.message.includes('menos de 3') && (await checkCycle(3)), 'não remove se sobrarem menos de 3 (ciclo de 3 continua)')

// poucos inscritos no fim do prazo: não sorteia e avisa
await admin.rpc('reset_draw', { p_group_id: jovem.id })
await admin.rpc('remove_participant', { p_participant_id: rest[2].id })
const { data: g3 } = await service.from('groups').select('drawn_at, registration_open').eq('id', jovem.id).single()
ok(!g3.drawn_at && g3.registration_open, 'desfazer apaga os pares e reabre o grupo')
ok((await anon.rpc('open_draw', { p_group_slug: 'acipg-jovem' })).data === 'not_enough', 'menos de 3 inscritos: não sorteia e avisa')
const { data: lonely } = await anon.rpc('get_my_entry', { p_token: (await admin.from('participants').select('access_token').eq('group_id', jovem.id).limit(1).single()).data.access_token })
ok(lonely.draw_status === 'not_enough' && lonely.group.contacts.includes('Lucas Oshiro'), 'pessoa vê o aviso e os contatos')

const anonUpdate = await anon.from('groups').update({ location: 'hack' }).eq('id', acipg.id).select()
ok(!anonUpdate.data?.length, 'anônimo não altera grupo')
const loc = await admin.from('groups').update({ location: 'Sede teste' }).eq('id', acipg.id).select()
ok(loc.data?.[0]?.location === 'Sede teste', 'admin altera local do grupo')

// limpeza: volta ao estado inicial
await admin.rpc('reset_draw', { p_group_id: jovem.id })
await service.from('participants').delete().like('email', 'teste%@exemplo.com')
await service.from('groups').update({ registration_open: true, location: null, registration_deadline: '2026-12-01' }).eq('id', jovem.id)
await service.from('groups').update({ location: null }).eq('id', acipg.id)

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo')
process.exit(failures ? 1 : 0)
