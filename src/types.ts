export type CandidateStatus = 'pending' | 'approved' | 'rejected'

export interface Candidate {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  address: string | null
  region: string | null
  profession: string | null
  motivation: string | null
  observation: string
  status: CandidateStatus
  created_at: string | null
  updated_at: string | null
}

export type CandidateInput = Partial<
  Omit<Candidate, 'id' | 'created_at' | 'updated_at' | 'first_name' | 'last_name'> & {
    first_name: string
    last_name: string
  }
>

export interface AppUser {
  role: 'admin' | 'user'
  email?: string
}

export interface AppSettings {
  tutorialSeen: boolean
  offlineEnabled: boolean
  lastSyncAt: string | null
}
