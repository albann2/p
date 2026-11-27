import { useRef, useState } from 'react'
import { parseCsv } from '../lib/csv'
import { replaceAllCandidates, deleteAllCandidates, exportXlsxToBrowser } from '../lib/api'
import type { Candidate } from '../types'

interface Props {
  onDataChanged: () => void
}

export default function AdminPanel({ onDataChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length === 0) throw new Error('Aucune ligne valide trouvée dans le CSV.')
      await replaceAllCandidates(rows)
      setMessage(`${rows.length} candidat(s) chargé(s) avec succès.`)
      onDataChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du CSV.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAll() {
    setBusy(true)
    setError('')
    try {
      await deleteAllCandidates()
      setMessage('Toutes les données ont été supprimées.')
      onDataChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.')
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  async function handleDownload() {
    setBusy(true)
    setError('')
    try {
      await exportXlsxToBrowser()
      setMessage('Fichier Excel (.xlsx) téléchargé : chaque champ est dans sa propre colonne.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du téléchargement.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Administration</h2>
      <p className="muted">
        Charger les données (CSV), tout supprimer ou télécharger les données actuelles.
      </p>

      <div className="admin-actions">
        <section>
          <h3>1 · Charger les données</h3>
          <p className="muted small">
            CSV avec les en-têtes d'origine&nbsp;: Status, FirstName, LastName, Gender, Phone,
            Email, CountryOfStudy, Nationality, CityVillage, Level, School, SchoolCategory,
            SchoolSection, StudyField, Grade, DocumentCount, SubmittedAt (les alias français
            prénom / nom / téléphone / statut restent acceptés). Le remplacement est total&nbsp;:
            les observations déjà saisies par le jury sont effacées, sauf si votre fichier
            contient une colonne <em>Observation</em> remplie.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button type="button" className="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            📤 Importer un fichier CSV
          </button>
        </section>

        <section>
          <h3>2 · Télécharger les données</h3>
          <p className="muted small">
            Fichier Excel (.xlsx) : chaque champ arrive directement dans sa propre colonne,
            quel que soit le réglage régional (aucun séparateur à configurer).
          </p>
          <button type="button" onClick={handleDownload} disabled={busy}>
            📥 Télécharger en Excel (.xlsx)
          </button>
        </section>

        <section>
          <h3>3 · Supprimer toutes les données</h3>
          {!confirmDelete ? (
            <button type="button" className="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              🗑️ Supprimer toutes les données
            </button>
          ) : (
            <div className="modal-inline">
              <span>Confirmer la suppression totale&nbsp;?</span>
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>
                Annuler
              </button>
              <button type="button" className="danger" onClick={handleDeleteAll} disabled={busy}>
                Oui, tout supprimer
              </button>
            </div>
          )}
        </section>
      </div>

      {busy && <p className="muted">Opération en cours…</p>}
      {message && <p className="badge ok">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
