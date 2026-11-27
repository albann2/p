import { useState } from 'react'
import type { Candidate, CandidateStatus } from '../types'
import { StatusBadge } from './CandidateList'

interface Props {
  candidate: Candidate
  isAdmin: boolean
  onBack: () => void
  onStatusChange: (id: string, status: CandidateStatus) => Promise<void>
  onObservationSave: (id: string, observation: string) => Promise<void>
}

export default function CandidateDetail({
  candidate,
  isAdmin,
  onBack,
  onStatusChange,
  onObservationSave
}: Props) {
  const [status, setStatus] = useState<CandidateStatus>(candidate.status)
  const [pendingConfirm, setPendingConfirm] = useState<CandidateStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [obsDraft, setObsDraft] = useState(candidate.observation ?? '')
  const [obsSaving, setObsSaving] = useState(false)
  const [obsInfo, setObsInfo] = useState('')

  const locked = candidate.status !== 'pending'
  // L'utilisateur lambda verrouille un statut validé.
  // L'admin peut toujours revenir en arrière (remise en attente).
  const canEditStatus = isAdmin || !locked

  function askConfirm(next: CandidateStatus) {
    if (!canEditStatus) {
      setError('Le statut a déjà été validé : il ne peut plus être modifié.')
      return
    }
    setPendingConfirm(next)
  }

  function confirmLabel(next: CandidateStatus): string {
    if (next === 'pending') return 'remettre en attente'
    return next === 'approved' ? 'approuver' : 'rejeter'
  }

  async function confirm() {
    if (!pendingConfirm) return
    setSaving(true)
    setError('')
    try {
      await onStatusChange(candidate.id, pendingConfirm)
      setStatus(pendingConfirm)
      setInfo(
        pendingConfirm === 'approved'
          ? 'Candidature approuvée.'
          : pendingConfirm === 'rejected'
            ? 'Candidature rejetée.'
            : 'Candidat remis en attente.'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.')
    } finally {
      setSaving(false)
      setPendingConfirm(null)
    }
  }

  async function saveObservation() {
    if (obsDraft === (candidate.observation ?? '')) return
    setObsSaving(true)
    setObsInfo('')
    try {
      await onObservationSave(candidate.id, obsDraft)
      setObsInfo('Observation enregistrée.')
    } catch (e) {
      setObsInfo('')
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement de l\'observation.')
    } finally {
      setObsSaving(false)
    }
  }

  return (
    <div className="card">
      <button type="button" className="link back" onClick={onBack} aria-label="Retour">
        <span className="back-icon">←</span> Retour à la liste
      </button>
      <h2>
        {candidate.first_name} {candidate.last_name}
      </h2>
      <div className="detail-head">
        <StatusBadge status={status} />
        {info && <span className="badge ok">{info}</span>}
      </div>

      <form className="detail-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-row">
          <label>
            Prénom
            <input value={candidate.first_name} readOnly />
          </label>
          <label>
            Nom
            <input value={candidate.last_name} readOnly />
          </label>
        </div>
        <label>
          Email
          <input value={candidate.email ?? ''} readOnly />
        </label>
        <label>
          Téléphone
          <input value={candidate.phone ?? ''} readOnly />
        </label>
        <label>
          Date de naissance
          <input value={candidate.birth_date ?? ''} readOnly />
        </label>
        <label>
          Adresse
          <input value={candidate.address ?? ''} readOnly />
        </label>
        <label>
          Région
          <input value={candidate.region ?? ''} readOnly />
        </label>
        <label>
          Profession
          <input value={candidate.profession ?? ''} readOnly />
        </label>
        <label>
          Motivation
          <textarea value={candidate.motivation ?? ''} readOnly rows={4} />
        </label>

        {isAdmin && (
          <label>
            Observation {obsSaving && <span className="muted small">(enregistrement…)</span>}
            <textarea
              value={obsDraft}
              onChange={(e) => setObsDraft(e.target.value)}
              onBlur={saveObservation}
              rows={3}
              placeholder="Observation réservée à l'admin…"
            />
            {obsInfo && <span className="muted small">{obsInfo}</span>}
          </label>
        )}

        <div className="status-actions">
          <label>Statut de la candidature</label>
          <div className="status-buttons">
            <button
              type="button"
              className={status === 'approved' ? 'chip active approved' : 'chip approved'}
              disabled={!canEditStatus || saving || status === 'approved'}
              onClick={() => askConfirm('approved')}
            >
              ✓ Approuver
            </button>
            <button
              type="button"
              className={status === 'rejected' ? 'chip active rejected' : 'chip rejected'}
              disabled={!canEditStatus || saving || status === 'rejected'}
              onClick={() => askConfirm('rejected')}
            >
              ✗ Rejeter
            </button>
            {isAdmin && (
              <button
                type="button"
                className="chip pending"
                disabled={saving || status === 'pending'}
                onClick={() => askConfirm('pending')}
              >
                ↺ Remettre en attente
              </button>
            )}
          </div>
          {locked && !isAdmin && (
            <p className="muted small">
              Statut validé définitivement : aucune modification possible.
            </p>
          )}
          {isAdmin && locked && (
            <p className="muted small">
              Statut validé — en tant qu'administrateur, vous pouvez le remettre en attente.
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </form>

      {pendingConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Confirmer le nouveau statut</h3>
            <p>
              Voulez-vous {confirmLabel(pendingConfirm)} la candidature de{' '}
              <strong>
                {candidate.first_name} {candidate.last_name}
              </strong>&nbsp;?
            </p>
            <p className="muted small">
              {pendingConfirm === 'pending'
                ? 'Le statut repassera à « En attente ».'
                : 'Cette action est définitive.'}
            </p>
            <div className="modal-actions">
              <button type="button" onClick={() => setPendingConfirm(null)} disabled={saving}>
                Annuler
              </button>
              <button type="button" className="primary" onClick={confirm} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Oui, valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
