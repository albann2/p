export type CandidateStatus = 'pending' | 'approved' | 'rejected'

/**
 * Un candidat reprend EXACTEMENT les colonnes du fichier CSV d'origine
 * (applications.csv), plus `observation` rempli par le jury.
 * Correspondance colonne CSV -> champ :
 *   Status -> status | FirstName -> first_name | LastName -> last_name
 *   Gender -> gender | Phone -> phone | Email -> email
 *   CountryOfStudy -> country_of_study | Nationality -> nationality
 *   CityVillage -> city_village | Level -> level | School -> school
 *   SchoolCategory -> school_category | SchoolSection -> school_section
 *   StudyField -> study_field | Grade -> grade
 *   DocumentCount -> document_count | SubmittedAt -> submitted_at
 */
export interface Candidate {
  id: string
  status: CandidateStatus
  first_name: string
  last_name: string
  gender: string | null
  phone: string | null
  email: string | null
  country_of_study: string | null
  nationality: string | null
  city_village: string | null
  level: string | null
  school: string | null
  school_category: string | null
  school_section: string | null
  study_field: string | null
  grade: string | null
  document_count: number | null
  submitted_at: string | null
  /** Observation du jury, saisie avant la décision. */
  observation: string
  created_at: string | null
  updated_at: string | null
}

/** Ligne complète à insérer (import CSV) : nom et prénom obligatoires. */
export type CandidateInput = Partial<
  Omit<Candidate, 'id' | 'created_at' | 'updated_at'>
> & {
  first_name: string
  last_name: string
}

/** Modification partielle (statut, observation…). */
export type CandidatePatch = Partial<Omit<Candidate, 'id' | 'created_at' | 'updated_at'>>

export interface AppUser {
  role: 'admin' | 'user'
  email?: string
}

export interface AppSettings {
  tutorialSeen: boolean
  offlineEnabled: boolean
  lastSyncAt: string | null
}
