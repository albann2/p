import { useEffect, useState } from 'react'
import type { Candidate } from '../types'
import { PAGE_SIZE } from '../lib/api'

interface Props {
  candidates: Candidate[]
  total: number
  loading: boolean
  search: string
  onSearchChange: (v: string) => void
  statusFilter: 'all' | 'pending' | 'approved' | 'rejected'
  onStatusFilterChange: (v: 'all' | 'pending' | 'approved' | 'rejected') => void
  onLoadMore: () => void
  hasMore: boolean
  offlineReady: boolean
  onOpenCandidate: (c: Candidate) => void
  onEnableOffline: () => void
  offlineEnabled: boolean
}

export default function CandidateList({
  candidates,
  total,
  loading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onLoadMore,
  hasMore,
  offlineReady,
  onOpenCandidate,
  onEnableOffline,
  offlineEnabled
}: Props) {
  const [localQuery, setLocalQuery] = useState(search)

  // débounce : envoie la recherche au serveur 300 ms après la dernière frappe
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (localQuery !== search) onSearchChange(localQuery)
    }, 300)
    return () => window.clearTimeout(t)
  }, [localQuery, search, onSearchChange])

  const filtered = candidates.filter((c) => statusFilter === 'all' || c.status === statusFilter)
  const shown = filtered.length

  if (loading && candidates.length === 0) return <p className="muted center">Chargement…</p>

  return (
    <div>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Rechercher (insensible aux accents) : MBO, DIALLO, Babaïra…"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as typeof statusFilter)}
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvés</option>
          <option value="rejected">Rejetés</option>
        </select>
      </div>

      {search && (
        <p className="muted small">
          Recherche «&nbsp;{search}&nbsp;» sur l'intégralité des {total} candidats.
        </p>
      )}

      <div className="offline-banner">
        {offlineEnabled ? (
          <span className="badge ok">✓ Disponible hors connexion</span>
        ) : (
          <button type="button" className="link" onClick={onEnableOffline}>
            📥 Activer le mode hors connexion (installe l'app sur l'appareil)
          </button>
        )}
        {offlineReady && <span className="muted small"> · données en cache locale</span>}
      </div>

      {filtered.length === 0 ? (
        <p className="muted center">
          {search
            ? 'Aucun résultat pour cette recherche — essayez sans accents.'
            : 'Aucun candidat.'}
        </p>
      ) : (
        <>
          <ul className="candidate-list">
            {filtered.map((c) => (
              <li key={c.id}>
                <button type="button" className="candidate-row" onClick={() => onOpenCandidate(c)}>
                  <span className="name">
                    {c.first_name} {c.last_name}
                  </span>
                  <StatusBadge status={c.status} />
                </button>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div style={{ textAlign: 'center', margin: '14px 0' }}>
              <button type="button" onClick={onLoadMore} disabled={loading}>
                {loading ? 'Chargement…' : `Afficher plus (${shown} affichés / ${total})`}
              </button>
            </div>
          ) : (
            <p className="muted small" style={{ textAlign: 'center' }}>
              {shown} affiché(s) sur {total} candidat(s).
            </p>
          )}
        </>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: Candidate['status'] }) {
  const label = status === 'pending' ? 'En attente' : status === 'approved' ? 'Approuvé' : 'Rejeté'
  return <span className={`badge ${status}`}>{label}</span>
}
