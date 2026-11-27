import { useCallback, useEffect, useRef, useState } from 'react'
import type { Candidate, CandidateStatus } from './types'
import { getSession, logout } from './lib/auth'
import {
  fetchCandidatesPage,
  updateCandidate,
  normalizeForSearch,
  PAGE_SIZE
} from './lib/api'
import {
  cacheCandidates,
  getCachedCandidates,
  getOfflineEnabled,
  setOfflineEnabled,
  queueStatusChange,
  updateCachedCandidate,
  getPendingChanges,
  clearAllLocalData
} from './lib/offlineDb'
import { syncPendingChanges, refreshCacheFromServer } from './lib/sync'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import Login from './components/Login'
import CandidateList from './components/CandidateList'
import CandidateDetail from './components/CandidateDetail'
import Tutorial from './components/Tutorial'
import AdminPanel from './components/AdminPanel'

type View = { name: 'list' } | { name: 'detail'; candidate: Candidate } | { name: 'admin' }

export default function App() {
  const [session, setSession] = useState(() => getSession())
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ name: 'list' })
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialSeen] = useState(() => localStorage.getItem('prix_tutorial_seen') === '1')
  const [offlineEnabled, setOfflineEnabledState] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [toast, setToast] = useState('')
  const searchRef = useRef(search)
  searchRef.current = search

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 4000)
  }

  /** Charge une page selon recherche + filtre statut. */
  const loadPage = useCallback(
    async (page: number, s: string, append: boolean) => {
      setLoading(true)
      try {
        if (navigator.onLine) {
          const { rows, total } = await fetchCandidatesPage(page, s, statusFilter)
          setTotal(total)
          setCandidates((prev) => (append ? [...prev, ...rows] : rows))
          if (!append && page === 0 && !s) void cacheCandidates(rows)
        } else {
          const cached = await getCachedCandidates()
          const q = normalizeForSearch(s)
          const filtered = q
            ? cached.filter((c) =>
              normalizeForSearch(`${c.first_name} ${c.last_name}`).includes(q)
            )
            : cached
          setTotal(filtered.length)
          setCandidates(
            statusFilter === 'all'
              ? filtered
              : filtered.filter((c) => c.status === statusFilter)
          )
        }
        const p = await getPendingChanges()
        setPendingCount(p.length)
      } catch {
        const cached = await getCachedCandidates()
        setTotal(cached.length)
        setCandidates(cached)
      } finally {
        setLoading(false)
      }
    },
    [statusFilter]
  )

  // Chargement initial
  useEffect(() => {
    if (session) void loadPage(0, search, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Recherche + filtre statut (déjà débouncée par le composant liste)
  useEffect(() => {
    if (!session) return
    if (view.name !== 'list') return
    void loadPage(0, search, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter])

  useEffect(() => {
    void getOfflineEnabled().then(setOfflineEnabledState)
  }, [])

  // Synchronisation automatique au retour de la connexion
  useEffect(() => {
    const onOnline = async () => {
      setOnline(true)
      const res = await syncPendingChanges()
      if (res.sent > 0) {
        showToast(`${res.sent} modification(s) synchronisée(s) avec la base.`)
      }
      void loadPage(0, searchRef.current, false)
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadPage])

  // Périodique : tente une synchro toutes les 60 s si en ligne
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (navigator.onLine && (await getPendingChanges()).length > 0) {
        const res = await syncPendingChanges()
        if (res.sent > 0) showToast(`${res.sent} modification(s) synchronisée(s).`)
        void loadPage(0, searchRef.current, false)
      }
    }, 60_000)
    return () => window.clearInterval(id)
  }, [loadPage])

  async function handleEnableOffline() {
    await setOfflineEnabled(true)
    setOfflineEnabledState(true)
    const rows = await getCachedCandidates()
    await cacheCandidates(rows)
    showToast(
      navigator.serviceWorker?.controller
        ? 'Mode hors connexion activé : l\'app est installable sur votre appareil.'
        : 'Mode hors connexion activé. Utilisez « Installer » ou « Ajouter à l\'écran d\'accueil » dans votre navigateur.'
    )
  }

  async function handleStatusChange(id: string, status: CandidateStatus) {
    if (navigator.onLine && isSupabaseConfigured) {
      try {
        await updateCandidate(id, { status })
        showToast('Statut enregistré.')
      } catch {
        await queueStatusChange({ candidateId: id, status, savedAt: new Date().toISOString() })
        await updateCachedCandidate(id, { status })
        showToast('Modification enregistrée localement, sera synchronisée.')
      }
    } else {
      await queueStatusChange({ candidateId: id, status, savedAt: new Date().toISOString() })
      await updateCachedCandidate(id, { status })
      showToast('Hors connexion : modification enregistrée localement, sera synchronisée.')
    }
    await updateCachedCandidate(id, { status })
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
    const p = await getPendingChanges()
    setPendingCount(p.length)
  }

  async function handleObservationSave(id: string, observation: string) {
    if (navigator.onLine && isSupabaseConfigured) {
      await updateCandidate(id, { observation })
      await updateCachedCandidate(id, { observation })
      showToast('Observation enregistrée.')
    } else {
      await updateCachedCandidate(id, { observation })
      showToast('Hors connexion : observation enregistrée localement, sera synchronisée.')
    }
    setView((v) =>
      v.name === 'detail' && v.candidate.id === id
        ? { name: 'detail', candidate: { ...v.candidate, observation } }
        : v
    )
  }

  if (!session) {
    return <Login onLogin={setSession} />
  }

  const isAdmin = session.role === 'admin'
  const hasMore = candidates.length < total && total > PAGE_SIZE

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Prix — Candidats</span>
        <span className={`badge ${online ? 'ok' : 'warn'}`}>
          {online ? 'En ligne' : 'Hors connexion'}
        </span>
        {pendingCount > 0 && (
          <span className="badge warn">{pendingCount} modif. en attente de synchro</span>
        )}
        <span style={{ flex: 1 }} />
        {isAdmin && (
          <button
            type="button"
            className={view.name === 'admin' ? 'chip active' : 'chip'}
            onClick={() => setView(view.name === 'admin' ? { name: 'list' } : { name: 'admin' })}
          >
            Admin
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            logout()
            setSession(null)
            setView({ name: 'list' })
          }}
        >
          Déconnexion
        </button>
      </header>

      <main>
        {!isAdmin && !showTutorial && !tutorialSeen && (
          <Tutorial
            onDone={() => {
              localStorage.setItem('prix_tutorial_seen', '1')
              setShowTutorial(true)
              void refreshCacheFromServer()
            }}
          />
        )}

        {view.name === 'list' && (
          <CandidateList
            candidates={candidates}
            total={total}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            hasMore={hasMore}
            onLoadMore={() => void loadPage(Math.floor(candidates.length / PAGE_SIZE), search, true)}
            offlineReady={candidates.length > 0}
            onOpenCandidate={(c) => setView({ name: 'detail', candidate: c })}
            onEnableOffline={handleEnableOffline}
            offlineEnabled={offlineEnabled}
          />
        )}

        {view.name === 'detail' && (
          <CandidateDetail
            candidate={view.candidate}
            isAdmin={isAdmin}
            onBack={() => setView({ name: 'list' })}
            onStatusChange={handleStatusChange}
            onObservationSave={handleObservationSave}
          />
        )}

        {view.name === 'admin' && isAdmin && (
          <AdminPanel
            onDataChanged={async () => {
              await clearAllLocalData()
              void loadPage(0, search, false)
            }}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
