import type { CandidateInput, CandidateStatus } from '../types'

/**
 * Parse un CSV (séparateur , ou ;) en objets CandidateInput.
 *
 * En-têtes reconnus — exactement ceux du fichier d'origine (applications.csv) :
 *   Status, FirstName, LastName, Gender, Phone, Email, CountryOfStudy,
 *   Nationality, CityVillage, Level, School, SchoolCategory, SchoolSection,
 *   StudyField, Grade, DocumentCount, SubmittedAt
 * Les alias français restent acceptés : prénom, nom, téléphone, statut, etc.
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
  const iGender = idx('gender', 'sexe', 'genre')
  const iPhone = idx('phone', 'telephone', 'tel')
  const iEmail = idx('email', 'mail', 'courriel')
  const iCountryStudy = idx('country_of_study', 'countryofstudy', 'pays_etude', 'pays_d_etude')
  const iNationality = idx('nationality', 'nationalite')
  const iCity = idx('city_village', 'cityvillage', 'ville', 'ville_village')
  const iLevel = idx('level', 'niveau')
  const iSchool = idx('school', 'ecole', 'etablissement')
  const iSchoolCategory = idx('school_category', 'schoolcategory', 'categorie_ecole')
  const iSchoolSection = idx('school_section', 'schoolsection', 'section')
  const iStudyField = idx('study_field', 'studyfield', 'filiere')
  const iGrade = idx('grade', 'note', 'moyenne')
  const iDocCount = idx('document_count', 'documentcount', 'nombre_documents')
  const iSubmittedAt = idx('submitted_at', 'submittedat', 'date_soumission')
  const iObservation = idx('observation', 'observations', 'remarque')
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
    const rawStatus = at(iStatus, cells).toLowerCase()
    out.push({
      first_name: first,
      last_name: last,
      gender: nullable(iGender, cells),
      phone: nullable(iPhone, cells),
      email: nullable(iEmail, cells),
      country_of_study: nullable(iCountryStudy, cells),
      nationality: nullable(iNationality, cells),
      city_village: nullable(iCity, cells),
      level: nullable(iLevel, cells),
      school: nullable(iSchool, cells),
      school_category: nullable(iSchoolCategory, cells),
      school_section: nullable(iSchoolSection, cells),
      study_field: nullable(iStudyField, cells),
      grade: nullable(iGrade, cells),
      document_count: parseCount(at(iDocCount, cells)),
      submitted_at: parseDate(at(iSubmittedAt, cells)),
      observation: at(iObservation, cells),
      status:
        rawStatus === 'approved'
          ? 'approved'
          : rawStatus === 'rejected'
            ? 'rejected'
            : ('pending' as CandidateStatus)
    })
  }
  return out
}

function at(i: number, cells: string[]): string {
  return i >= 0 ? (cells[i] ?? '').trim() : ''
}

function nullable(i: number, cells: string[]): string | null {
  const v = at(i, cells)
  return v === '' ? null : v
}

/** « 2 » → 2 ; vide, « N/A » ou autre texte → null. */
function parseCount(raw: string): number | null {
  const digits = raw.match(/\d+/)
  return digits ? Number(digits[0]) : null
}

/**
 * « 11/22/2026, 5:20:58 PM » ou ISO → ISO 8601 ; illisible → null.
 * (Le fichier exporté depuis l'app utilise déjà de l'ISO.)
 */
function parseDate(raw: string): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
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
