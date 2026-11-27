import { useState } from 'react'

const STEPS: { title: string; text: string }[] = [
  {
    title: '1 · Rechercher le nom du candidat',
    text: "Utilisez la barre de recherche en haut de la liste pour taper le nom du candidat. La liste se filtre automatiquement."
  },
  {
    title: '2 · Vérifier les informations du candidat',
    text: "Cliquez sur son nom pour ouvrir sa fiche complète. Vérifiez que les informations sont conformes. Si elles ne le sont pas, demandez-lui de remplir une fiche physique comme un nouveau candidat."
  },
  {
    title: '3 · Auditionner le candidat',
    text: "Procédez à l'audition du candidat avant toute décision."
  },
  {
    title: '4 · Choisir le nouveau statut',
    text: "Sur la fiche, cliquez sur « Approuver » ou « Rejeter ». Ce choix n'est appliqué qu'après confirmation."
  },
  {
    title: '5 · Confirmer avec « Oui »',
    text: "Une boîte de dialogue s'ouvre : choisissez « Oui, valider » pour enregistrer le nouveau statut. Le statut devient alors définitif."
  }
]

export default function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="modal-backdrop">
      <div className="modal tutorial">
        <h2>Bienvenue — voici le fonctionnement</h2>
        <div className="tutorial-step">
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </div>
        <div className="dots">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'dot active' : 'dot'} />
          ))}
        </div>
        <div className="modal-actions">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)}>
              Précédent
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => (last ? onDone() : setStep(step + 1))}
          >
            {last ? 'Commencer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}
