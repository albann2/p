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

const EMPTY = '—'

function show(v: string | number | null | undefined): string | number {
  if (v === null || v === undefined) return EMPTY
  const s = String(v).trim()
  return s === '' ? EMPTY : v
}

function formatDate(raw: string | null): string {
  if (!raw) return EMPTY
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
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

  /** Observation du jury : modifiable par tout utilisateur connecté. */
  const [obsDraft, setObsDraft] = useState(candidate.observation ?? '')
  const [savedObservation, setSavedObservation] = useState(candidate.observation ?? '')
  const [obsSaving, setObsSaving] = useState(false)
  const [obsInfo, setObsInfo] = useState('')

  const locked = candidate.status !== 'pending'
  // L'utilisateur lambda verrouille un statut validé.
  // L'admin peut toujours revenir en arrière (remise en attente).
  const canEditStatus = isAdmin || !locked
  const obsDirty = obsDraft !== savedObservation

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

  async function persistObservation(): Promise<void> {
    if (!obsDirty) return
    setObsSaving(true)
    try {
      await onObservationSave(candidate.id, obsDraft)
      setSavedObservation(obsDraft)
      setObsInfo('Observation enregistrée.')
    } finally {
      setObsSaving(false)
    }
  }

  async function saveObservation() {
    if (!obsDirty) return
    setObsInfo('')
    try {
      await persistObservation()
    } catch (e) {
      setObsInfo('')
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement de l\'observation.')
    }
  }

  async function confirm() {
    if (!pendingConfirm) return
    setSaving(true)
    setError('')
    try {
      // L'observation saisie avant la décision part avec elle.
      await persistObservation()
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
        <h3>Identité</h3>
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
        <div className="form-row">
          <label>
            Sexe
            <input value={show(candidate.gender)} readOnly />
          </label>
          <label>
            Nationalité
            <input value={show(candidate.nationality)} readOnly />
          </label>
        </div>

        <h3>Contact</h3>
        <div className="form-row">
          <label>
            Téléphone
            <input value={show(candidate.phone)} readOnly />
          </label>
          <label>
            Email
            <input value={show(candidate.email)} readOnly />
          </label>
        </div>
        <label>
          Ville / Village
          <input value={show(candidate.city_village)} readOnly />
        </label>

        <h3>Études</h3>
        <div className="form-row">
          <label>
            Niveau
            <input value={show(candidate.level)} readOnly />
          </label>
          <label>
            Note (grade)
            <input value={show(candidate.grade)} readOnly />
          </label>
        </div>
        <label>
          Établissement
          <input value={show(candidate.school)} readOnly />
        </label>
        <div className="form-row">
          <label>
            Catégorie d'établissement
            <input value={show(candidate.school_category)} readOnly />
          </label>
          <label>
            Section
            <input value={show(candidate.school_section)} readOnly />
          </label>
        </div>
        <div className="form-row">
          <label>
            Filière
            <input value={show(candidate.study_field)} readOnly />
          </label>
          <label>
            Pays d'études
            <input value={show(candidate.country_of_study)} readOnly />
          </label>
        </div>

        <h3>Candidature</h3>
        <div className="form-row">
          <label>
            Date de soumission
            <input value={formatDate(candidate.submitted_at)} readOnly />
          </label>
          <label>
            Nombre de documents
            <input value={show(candidate.document_count)} readOnly />
          </label>
        </div>

        <label>
          Observation du jury {obsSaving && <span className="muted small">(enregistrement…)</span>}
          <textarea
            value={obsDraft}
            onChange={(e) => {
              setObsDraft(e.target.value)
              setObsInfo('')
            }}
            onBlur={() => void saveObservation()}
            rows={3}
            placeholder="À remplir avant d'approuver ou de rejeter : motif, remarque sur le dossier…"
          />
          {obsDirty && !obsSaving && (
            <span className="muted small">Modification non enregistrée (enregistrement à la sortie du champ).</span>
          )}
          {obsInfo && <span className="muted small">{obsInfo}</span>}
        </label>

        <div className="status-actions">
          <label>Statut de la candidature</label>
          <div className="status-buttons">
            <button
              type="button"
              className={status === 'approved' ? 'chip active approved' : 'chip approved'}
              disabled={!canEditStatus || saving || obsSaving || status === 'approved'}
              onClick={() => askConfirm('approved')}
            >
              ✓ Approuver
            </button>
            <button
              type="button"
              className={status === 'rejected' ? 'chip active rejected' : 'chip rejected'}
              disabled={!canEditStatus || saving || obsSaving || status === 'rejected'}
              onClick={() => askConfirm('rejected')}
            >
              ✗ Rejeter
            </button>
            {isAdmin && (
              <button
                type="button"
                className="chip pending"
                disabled={saving || obsSaving || status === 'pending'}
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
                : obsDirty
                  ? 'L\'observation saisie sera enregistrée avec la décision.'
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
