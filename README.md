# Prix — Candidats (PWA + Supabase)

Application web progressive (installable, consultable **hors connexion**) pour consulter la liste
des candidats à un prix et mettre à jour leur statut (`pending` → `approved` / `rejected`).

## Fonctionnalités

- **Connexion simple** : mot de passe commun `Candidate2026!` pour les utilisateurs lambda.
- **Accès admin** : onglet « Administrateur » à l'écran de connexion — email
  `alanhappi37@gmail.com` + le même mot de passe. L'admin peut :
  - charger les données depuis un **fichier CSV** (remplacement total) ;
  - **supprimer toutes les données** (avec confirmation) ;
  - **télécharger** les données actuelles en **Excel (.xlsx)** — chaque champ dans sa
    propre colonne, quel que soit le réglage régional (aucun séparateur à configurer).
- **Utilisateurs lambda** : liste des candidats + **barre de recherche** (+ filtre de statut),
  bouton « Activer le mode hors connexion » (installe l'app sur l'appareil).
- **Fiche candidat** (clic sur un nom) : toutes les infos du CSV en lecture seule ;
  le **statut** est modifiable (avec confirmation « Oui, valider ») et le **jury peut saisir
  une observation** (enregistrée à la sortie du champ, et avec la décision).
- **Statut verrouillé** après validation (bloqué côté base par trigger SQL ET côté client).
- **Tutoriel** en 5 étapes affiché après la première connexion (les 5 points du processus).
- **Mode hors connexion** : les candidats sont mis en cache dans IndexedDB ; les changements de
  statut faits sans réseau sont mis en file d'attente puis **envoyés automatiquement au retour
  de la connexion**.

## 1. Connecter Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Ouvrez **SQL Editor** → collez le contenu de `supabase/schema.sql` → **Run**.
   Cela crée la table `candidates`, le verrou de statut et les règles d'accès.
3. Dans **Project Settings → API**, copiez :
   - `Project URL` ;
   - `anon public` key.
4. Créez un fichier `.env` à la racine (voir `.env.example`) :

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

5. Relancez `npm run dev` — l'app est connectée.

## 2. Format du CSV d'import

Séparateur `,` ou `;` reconnu automatiquement. Les colonnes sont **exactement celles du
fichier d'origine** (`applications.csv`) :

```
Status,FirstName,LastName,Gender,Phone,Email,CountryOfStudy,Nationality,
CityVillage,Level,School,SchoolCategory,SchoolSection,StudyField,Grade,
DocumentCount,SubmittedAt
```

- `Status` : `pending` (défaut), `approved` ou `rejected`.
- `SubmittedAt` : format du fichier (`11/22/2026, 5:20:58 PM`) ou ISO.
- Colonnes absentes = valeurs vides. Alias français acceptés (`prénom`, `nom`, `téléphone`, `statut`…).
- Une colonne `Observation` facultative est conservée si elle est présente.

> ⚠️ L'import remplace **toutes** les données : les observations déjà saisies par le jury
> sont perdues, sauf si vous exportez d'abord (bouton `.xlsx`), complétez la colonne
> `Observation`, puis réimportez.

## 3. Développement

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build production (génère dist/ + service worker)
npm run preview    # sert le build — nécessaire pour tester le mode hors connexion
```

## 4. Tester le mode hors connexion

1. Lancez `npm run build && npm run preview`.
2. Ouvrez l'app, connectez-vous, cliquez « Activer le mode hors connexion ».
3. Installez l'app (icône « Installer » dans la barre d'adresse, ou
   « Ajouter à l'écran d'accueil » sur mobile).
4. Coupez le réseau (DevTools → Network → Offline) : la liste reste consultable depuis le
   cache, et les changements de statut sont mis en attente.
5. Rétablissez le réseau : les modifications partent automatiquement vers Supabase.

## Sécurité — note importante

L'app est protégée par un mot de passe côté client (comme demandé). La base Supabase, elle,
est accessible via la clé `anon` : n'importe qui possédant cette clé peut lire/écrire la table.
C'est un choix acceptable pour un usage interne, mais si vous voulez une vraie sécurité serveur,
il faudra passer par Supabase Auth (l'admin en utilisateur, une policy pour les autres) — je peux
le mettre en place sur demande.
