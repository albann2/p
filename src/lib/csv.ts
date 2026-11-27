import type { CandidateInput, CandidateStatus } from '../types'

/**
 * Parse un CSV (séparateur , ou ;) en objets CandidateInput.
 * En-têtes attendus (insensibles à la casse/accents/espaces) :
 *   firstname | prenom | first_name
 *   lastname  | nom    | last_name
 *   email, phone | telephone, birth_date | date_naissance,
 *   address | adresse, region, profession, motivation, observation,
 *   status | statut
 * Accepte aussi une colonne unique full_name | nom_complet (découpée).
 */
export function parseCsv(text: string): CandidateInput[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const sep = detectSeparator(clean)
  const rows = parseRows(clean, sep)
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => normalizeHeader(h))
  const idx = (...names: string[]) => headers.findIndex((h) => names.includes(h))

  const iFirst = idx('first_name', 'firstname', 'prenom')
  const iLast = idx('last_name', 'lastname', 'nom')
  const iFull = idx('full_name', 'nom_complet')
  const iEmail = idx('email')
  const iPhone = idx('phone', 'telephone')
  const iBirth = idx('birth_date', 'date_naissance', 'date de naissance')
  const iAddress = idx('address', 'adresse')
  const iRegion = idx('region')
  const iProfession = idx('profession')
  const iMotivation = idx('motivation')
  const iObservation = idx('observation')
  const iStatus = idx('status', 'statut')

  if (iFirst === -1 && iFull === -1) {
    throw new Error('Colonne "FirstName"/"LastName" (ou "full_name") introuvable dans le CSV.')
  }

  const out: CandidateInput[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    let first = at(iFirst, cells)
    let last = at(iLast, cells)
    if (iFirst === -1 || (!first && !last)) {
      const full = at(iFull, cells)
      if (full) {
        const [f, ...rest] = full.split(/\s+/)
        first = first || f
        last = last || rest.join(' ')
      }
    }
    if (!first && !last) continue
    const rawStatus = (cells[iStatus] ?? '').trim().toLowerCase()
    out.push({
      first_name: first,
      last_name: last,
      email: at(iEmail, cells) || null,
      phone: at(iPhone, cells) || null,
      birth_date: at(iBirth, cells) || null,
      address: at(iAddress, cells) || null,
      region: at(iRegion, cells) || null,
      profession: at(iProfession, cells) || null,
      motivation: at(iMotivation, cells) || null,
      observation: at(iObservation, cells),
      status: rawStatus === 'approved' ? 'approved' : rawStatus === 'rejected' ? 'rejected' : 'pending' as CandidateStatus
    })
  }
  return out
}

function at(i: number, cells: string[]): string {
  return i >= 0 ? (cells[i] ?? '').trim() : ''
}

function detectSeparator(text: string): ',' | ';' {
  const firstLine = text.split('\n')[0] ?? ''
  const commas = (firstLine.match(/,/g) ?? []).length
  const semis = (firstLine.match(/;/g) ?? []).length
  return semis > commas ? ';' : ','
}

function normalizeHeader(h: string): string {
  // normalise aussi les accents en plus des espaces/casse
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/** Parse les lignes CSV en gérant les guillemets. */
function parseRows(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      cur.push(field)
      field = ''
    } else if (ch === '\n') {
      cur.push(field)
      field = ''
      rows.push(cur)
      cur = []
    } else {
      field += ch
    }
  }
  cur.push(field)
  rows.push(cur)
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Ramène le contenu binaire à une forme acceptée par Blob(). */
function binaryPart(data: Uint8Array | ArrayBuffer): ArrayBuffer {
  // Le tampon d'un Uint8Array est par construction un ArrayBuffer en pratique ;
  // le typage générique de TS (ArrayBufferLike) exige un gabarit explicite.
  return (data instanceof Uint8Array ? data.buffer : data) as ArrayBuffer
}

export function downloadFile(
  content: string | Uint8Array | ArrayBuffer,
  filename: string,
  mime = 'text/csv;charset=utf-8'
): void {
  // Texte : BOM UTF-8 pour Excel. Binaire (.xlsx) : TOUJOURS envoyé comme données
  // binaires, jamais concaténé en chaîne ( éviter « [object ArrayBuffer] »).
  const payload =
    typeof content === 'string'
      ? new Blob(['\uFEFF' + content], { type: mime })
      : new Blob([binaryPart(content)], { type: mime })
  const url = URL.createObjectURL(payload)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}