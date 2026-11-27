export const SHARED_PASSWORD = 'Candidate2026!'
export const ADMIN_EMAIL = 'alanhappi37@gmail.com'

export interface Session {
  role: 'admin' | 'user'
  email?: string
}

const KEY = 'prix_session'

export function loginShared(password: string): Session | null {
  if (password !== SHARED_PASSWORD) return null
  const s: Session = { role: 'user' }
  localStorage.setItem(KEY, JSON.stringify(s))
  return s
}

export function loginAdmin(email: string, password: string): Session | null {
  if (password !== SHARED_PASSWORD) return null
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) return null
  const s: Session = { role: 'admin', email: ADMIN_EMAIL }
  localStorage.setItem(KEY, JSON.stringify(s))
  return s
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function logout(): void {
  localStorage.removeItem(KEY)
}
