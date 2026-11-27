import type { Candidate, CandidateInput } from '../types'
import { supabase, isSupabaseConfigured } from './supabase'
import { downloadFile } from './csv'

const TABLE = 'candidates'
export const PAGE_SIZE = 200
/** Taille de page pour l'export complet (PostgREST : 1000 max par requête). */
const EXPORT_PAGE_SIZE = 1000

function rangeFor(page: number) {
  return { from: page * PAGE_SIZE, to: (page + 1) * PAGE_SIZE - 1 }
}

/** Récupère une page de candidats, tri alphabétique par nom puis prénom. */
export async function fetchCandidatesPage(
  page: number,
  search?: string,
  status?: 'all' | 'pending' | 'approved' | 'rejected'
): Promise<{ rows: Candidate[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 }

  let query = supabase.from(TABLE).select('*', { count: 'exact' })
  const s = (search ?? '').trim()
  if (s) {
    // search_norm (sans accents, lowercase) est calculé côté base :
    // un pattern "contient" fonctionne sur l'intégralité des lignes.
    query = query.ilike('search_norm', `%${normalizeForSearch(s)}%`)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  query = query
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true })
    // Tiebreaker stable : sans lui, les pages peuvent sauter/dupliquer
    // des lignes quand plusieurs last_name sont identiques (order non déterministe).
    .order('id', { ascending: true })
    .range(rangeFor(page).from, rangeFor(page).to)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: (data ?? []) as Candidate[], total: count ?? 0 }
}

/** Récupère l'intégralité des candidats (tous les pages concaténées). */
export async function fetchAllCandidates(search?: string): Promise<Candidate[]> {
  const all: Candidate[] = []
  let from = 0
  let attemptsLeft = 3
  for (;;) {
    let query = supabase.from(TABLE).select('*')
    const s = (search ?? '').trim()
    if (s) query = query.ilike('search_norm', `%${normalizeForSearch(s)}%`)
    query = query
      .order('last_name', { ascending: true, nullsFirst: false })
      .order('first_name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + EXPORT_PAGE_SIZE - 1)
    try {
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as Candidate[]
      all.push(...rows)
      attemptsLeft = 3
      if (rows.length < EXPORT_PAGE_SIZE) break
      from += EXPORT_PAGE_SIZE
      if (from > 400000) break // garde-fou : 400 000 lignes max
      // Petite pause entre les requêtes : éviter le « too many requests »
      // de l'API quand la base dépasse plusieurs milliers de lignes.
      await new Promise((r) => setTimeout(r, 120))
    } catch (err) {
      attemptsLeft -= 1
      if (attemptsLeft <= 0) throw err
      // nouvelle tentative avec délai croissant (erreur réseau ou 429)
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  return all
}

export async function fetchCandidateById(id: string): Promise<Candidate | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Candidate) ?? null
}

export async function updateCandidate(
  id: string,
  patch: CandidateInput
): Promise<Candidate> {
  if (!isSupabaseConfigured) throw new Error('Supabase non configuré')
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Candidate
}

export async function replaceAllCandidates(rows: CandidateInput[]): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase non configuré : impossible de charger les données.')
  }
  await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // insertion par lots de 500 (limite raisonnable par requête)
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase.from(TABLE).insert(batch)
    if (error) throw error
  }
}

export async function deleteAllCandidates(): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase non configuré : impossible de supprimer les données.')
  }
  const { error } = await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}

/**
 * Télécharge toutes les données au format Excel .xlsx natif :
 * chaque champ est une vraie colonne, sans séparateur à configurer.
 * Import dynamique : la bibliothèque est chargée seulement au clic.
 */
export async function downloadXlsxFromDb(): Promise<Uint8Array> {
  const rows = await fetchAllCandidates()
  if (rows.length === 0) return new Uint8Array(0)
  const XLSX = await import('xlsx')
  const data = rows.map((r) => ({
    FirstName: r.first_name,
    LastName: r.last_name,
    email: r.email ?? '',
    phone: r.phone ?? '',
    birth_date: r.birth_date ?? '',
    address: r.address ?? '',
    region: r.region ?? '',
    profession: r.profession ?? '',
    motivation: r.motivation ?? '',
    observation: r.observation ?? '',
    status: r.status
  }))
  const ws = XLSX.utils.json_to_sheet(data, {
    header: ['FirstName', 'LastName', 'email', 'phone', 'birth_date', 'address', 'region', 'profession', 'motivation', 'observation', 'status']
  })
  ws['!cols'] = [
    { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 12 },
    { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 40 }, { wch: 24 }, { wch: 10 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Candidats')
  // 'array' peut renvoyer Uint8Array ou ArrayBuffer selon la version :
  // on normalise en Uint8Array pour que le Blob soit toujours binaire.
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer)
}

/** Écrit le .xlsx sur le disque via le navigateur. */
export async function exportXlsxToBrowser(): Promise<void> {
  const buf = await downloadXlsxFromDb()
  if (buf.byteLength === 0) throw new Error('Aucune donnée à télécharger.')
  downloadFile(
    buf,
    `candidats-${new Date().toISOString().slice(0, 10)}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

/** Recherche insensible aux accents/casse, côté client. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .toLowerCase()
    .trim()
}
