import { useCallback, useEffect, useRef, useState } from "react"
import { getVoiceNote } from "./audioStore"
import { demoState, emptyState } from "./data"
import {
  getPasscode,
  pullState,
  pushState,
  setPasscode,
  SyncError,
  uploadVoice,
  type Remote,
} from "./sync"
import type { AppState } from "./types"

const STORAGE_KEY = "life-studio:v1"
const UPDATED_KEY = "life-studio:updatedAt"

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "locked" | "error"

function normalise(value: Partial<AppState> | null | undefined): AppState | null {
  if (!value || value.version !== 1 || !Array.isArray(value.plan)) return null
  return { ...demoState, ...value } as AppState
}

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return normalise(stored ? JSON.parse(stored) : null) ?? demoState
  } catch {
    return demoState
  }
}

function loadUpdatedAt() {
  try {
    return Number(localStorage.getItem(UPDATED_KEY)) || 0
  } catch {
    return 0
  }
}

export function useLifeStudioState() {
  const [state, setState] = useState<AppState>(loadState)
  const [notice, setNotice] = useState("")
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    getPasscode() ? "syncing" : "off",
  )
  const [syncMessage, setSyncMessage] = useState("")
  const [lastSynced, setLastSynced] = useState(0)
  const [changes, setChanges] = useState(0)
  const stateRef = useRef(state)
  const updatedAt = useRef(loadUpdatedAt())
  const syncing = useRef(false)
  const again = useRef(false)

  stateRef.current = state

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      setNotice(
        "This change is here for now, but your browser could not save it.",
      )
    }
  }, [state])

  const setUpdatedAt = (value: number) => {
    updatedAt.current = value
    try {
      localStorage.setItem(UPDATED_KEY, String(value))
    } catch {
      // Not fatal: the next sync will reconcile.
    }
  }

  const flash = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 2800)
  }, [])

  const commit = useCallback((recipe: (current: AppState) => AppState) => {
    setState(recipe)
    setUpdatedAt(Date.now())
    setChanges((value) => value + 1)
  }, [])

  const update = useCallback(
    (recipe: (current: AppState) => AppState, message?: string) => {
      commit(recipe)
      if (message) flash(message)
    },
    [commit, flash],
  )

  const adopt = (remote: Remote) => {
    const next = normalise(remote.state)
    if (!next) return
    stateRef.current = next
    setState(next)
    setUpdatedAt(remote.updatedAt)
  }

  const uploadPendingVoice = async () => {
    const pending = (stateRef.current.voiceNotes ?? []).filter(
      (note) => !note.uploaded,
    )
    const done: string[] = []
    for (const note of pending) {
      const blob = await getVoiceNote(note.id).catch(() => undefined)
      if (!blob) continue
      await uploadVoice(note.id, blob)
      done.push(note.id)
    }
    if (done.length)
      commit((current) => ({
        ...current,
        voiceNotes: current.voiceNotes.map((note) =>
          done.includes(note.id) ? { ...note, uploaded: true } : note,
        ),
      }))
  }

  const syncNow = useCallback(
    async (mode: "auto" | "load" | "upload" = "auto") => {
      if (!getPasscode()) {
        setSyncStatus("off")
        return
      }
      if (syncing.current) {
        again.current = true
        return
      }
      syncing.current = true
      setSyncStatus("syncing")
      try {
        if (mode === "upload") setUpdatedAt(Date.now())
        const remote = await pullState()
        const local = updatedAt.current
        const remoteWins =
          !!remote.state &&
          (mode === "load" || (mode === "auto" && remote.updatedAt > local))
        if (remoteWins) {
          adopt(remote)
        } else if (!remote.state || local > remote.updatedAt) {
          // A never-edited device pushes with the oldest possible time, so real edits elsewhere win.
          const stamp = local || 1
          setUpdatedAt(stamp)
          const newer = await pushState(stateRef.current, stamp)
          if (newer) adopt(newer)
        }
        await uploadPendingVoice()
        setSyncStatus("synced")
        setSyncMessage("")
        setLastSynced(Date.now())
      } catch (error) {
        const status = error instanceof SyncError ? error.status : -1
        setSyncStatus(
          status === 401 ? "locked" : status === 0 ? "offline" : "error",
        )
        setSyncMessage((error as Error).message)
      } finally {
        syncing.current = false
        if (again.current) {
          again.current = false
          window.setTimeout(() => syncNow(), 0)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit],
  )

  // Push shortly after local edits.
  useEffect(() => {
    if (!changes) return
    const timer = window.setTimeout(() => syncNow(), 1500)
    return () => window.clearTimeout(timer)
  }, [changes, syncNow])

  // Pull on open, when returning to the app, when back online, and every minute while open.
  useEffect(() => {
    syncNow()
    const onVisible = () => document.visibilityState === "visible" && syncNow()
    const onHidden = () => document.visibilityState === "hidden" && syncNow()
    const onOnline = () => syncNow()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") syncNow()
    }, 60000)
    document.addEventListener("visibilitychange", onVisible)
    document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("online", onOnline)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("online", onOnline)
    }
  }, [syncNow])

  const connect = useCallback(
    async (passcode: string, mode: "load" | "upload") => {
      setPasscode(passcode.trim())
      await syncNow(mode)
    },
    [syncNow],
  )

  const disconnect = useCallback(() => {
    setPasscode("")
    setSyncStatus("off")
    setSyncMessage("")
  }, [])

  const reset = useCallback(
    (kind: "demo" | "empty") => {
      commit(() =>
        kind === "demo" ? demoState : { ...emptyState, onboarded: true },
      )
      flash(
        kind === "demo"
          ? "Example studio restored."
          : "A fresh studio is ready.",
      )
    },
    [commit, flash],
  )

  return {
    state,
    update,
    notice,
    setNotice,
    reset,
    sync: {
      status: syncStatus,
      message: syncMessage,
      lastSynced,
      connect,
      disconnect,
      syncNow,
    },
  }
}
