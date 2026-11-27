import type { Candidate, CandidateStatus } from '../types'
import { supabase, isSupabaseConfigured } from './supabase'
import {
  cacheCandidates,
  getPendingChanges,
  removePendingChange
} from './offlineDb'
import { fetchAllCandidates } from './api'

/**
 * Envoie les changements de statut mis en file d'attente hors ligne,
 * puis rafraîchit le cache local depuis Supabase.
 */
export async function syncPendingChanges(): Promise<{ sent: number; failed: number }> {
  if (!isSupabaseConfigured) return { sent: 0, failed: 0 }

  const pending = await getPendingChanges()
  let sent = 0
  let failed = 0

  for (const change of pending) {
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ status: change.status, updated_at: new Date().toISOString() })
        .eq('id', change.candidateId)
      if (error) throw error
      await removePendingChange(change.candidateId)
      sent++
    } catch {
      failed++
    }
  }

  try {
    const rows = await fetchAllCandidates()
    await cacheCandidates(rows)
  } catch {
    // reste sur le cache local existant
  }
  return { sent, failed }
}

export async function refreshCacheFromServer(): Promise<void> {
  try {
    const rows = await fetchAllCandidates()
    const pending = await getPendingChanges()
    const byId = new Map(pending.map((p) => [p.candidateId, p]))
    const merged = rows.map((r) => {
      const p = byId.get(r.id)
      return p ? { ...r, status: p.status as CandidateStatus } : r
    })
    await cacheCandidates(merged)
  } catch {
    // hors ligne : on garde le cache
  }
}
