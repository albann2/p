// Test : génère le .xlsx exactement comme downloadXlsxFromDb() puis le RELIT pour vérifier les colonnes.
import fs from 'node:fs'
const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
const vars = {}
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) vars[m[1]] = m[2].trim()
}
const ws = (await import('ws')).default ?? (await import('ws'))
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(vars.VITE_SUPABASE_URL, vars.VITE_SUPABASE_ANON_KEY, { realtime: { transport: ws } })
const XLSX = await import('xlsx')

// 40 lignes réelles, y compris celles avec des champs riches (motivation, #NOM?)
const { data } = await supabase.from('candidates').select('*').order('id').limit(40)
if (!data) throw new Error('pas de données')

const rows = data.map((r) => ({
  FirstName: r.first_name, LastName: r.last_name, email: r.email ?? '', phone: r.phone ?? '',
  birth_date: r.birth_date ?? '', address: r.address ?? '', region: r.region ?? '',
  profession: r.profession ?? '', motivation: r.motivation ?? '', observation: r.observation ?? '', status: r.status
}))
const sheet = XLSX.utils.json_to_sheet(rows, {
  header: ['FirstName', 'LastName', 'email', 'phone', 'birth_date', 'address', 'region', 'profession', 'motivation', 'observation', 'status']
})
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, sheet, 'Candidats')
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
fs.writeFileSync(new URL('../test-export.xlsx', import.meta.url), buf)
console.log('taille xlsx :', buf.length, 'octets')

// relecture du fichier écrit
const back = XLSX.read(fs.readFileSync(new URL('../test-export.xlsx', import.meta.url)))
const s = back.Sheets['Candidats']
const grid = XLSX.utils.sheet_to_json(s, { header: 1 })
console.log('relit :', grid.length, 'lignes ;', grid[0].length, 'colonnes')
console.log('entêtes :', grid[0].join(' | '))
console.log('ligne 2  :', JSON.stringify(grid[1]))
const expected = ['FirstName', 'LastName', 'email', 'phone', 'birth_date', 'address', 'region', 'profession', 'motivation', 'observation', 'status']
const ok = Array.isArray(grid[0]) && grid[0].join('|') === expected.join('|')
console.log(ok ? 'COLONNES CONFORMES ✅' : 'COLONNES ❌')
process.exit(ok ? 0 : 1)
