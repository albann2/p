import { useState } from 'react'
import { loginShared, loginAdmin } from '../lib/auth'

interface Props {
  onLogin: (session: { role: 'admin' | 'user'; email?: string }) => void
}

export default function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<'user' | 'admin'>('user')
  const [password, setPassword] = useState<string>('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'user') {
      const s = loginShared(password)
      if (s) onLogin(s)
      else setError('Mot de passe incorrect.')
    } else {
      const s = loginAdmin(email, password)
      if (s) onLogin(s)
      else setError('Email ou mot de passe incorrect.')
    }
  }

  return (
    <div className="card login-card">
      <h1>Prix — Candidats</h1>
      <p className="muted">Espace de consultation et de gestion des candidats.</p>

      <div className="tabs">
        <button
          type="button"
          className={mode === 'user' ? 'tab active' : 'tab'}
          onClick={() => setMode('user')}
        >
          Accès simple
        </button>
        <button
          type="button"
          className={mode === 'admin' ? 'tab active' : 'tab'}
          onClick={() => setMode('admin')}
        >
          Administrateur
        </button>
      </div>

      <form onSubmit={submit}>
        {mode === 'admin' && (
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
            />
          </label>
        )}
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">
          Se connecter
        </button>
      </form>
    </div>
  )
}
