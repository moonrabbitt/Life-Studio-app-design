import { useCallback, useEffect, useState } from "react"
import { demoState, emptyState } from "./data"
import type { AppState } from "./types"

const STORAGE_KEY = "life-studio:v1"

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return demoState
    const value = JSON.parse(stored) as Partial<AppState>
    if (value.version !== 1 || !Array.isArray(value.plan)) return demoState
    return { ...demoState, ...value } as AppState
  } catch {
    return demoState
  }
}

export function useLifeStudioState() {
  const [state, setState] = useState<AppState>(loadState)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      setNotice(
        "This change is here for now, but your browser could not save it.",
      )
    }
  }, [state])

  const update = useCallback(
    (recipe: (current: AppState) => AppState, message?: string) => {
      setState(recipe)
      if (message) {
        setNotice(message)
        window.setTimeout(() => setNotice(""), 2800)
      }
    },
    [],
  )

  const reset = useCallback((kind: "demo" | "empty") => {
    setState(kind === "demo" ? demoState : { ...emptyState, onboarded: true })
    setNotice(
      kind === "demo" ? "Example studio restored." : "A fresh studio is ready.",
    )
  }, [])

  return { state, update, notice, setNotice, reset }
}
