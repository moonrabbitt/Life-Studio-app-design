import type { AppState } from "./types"

const PASSCODE_KEY = "life-studio:passcode"

export function getPasscode() {
  try {
    return localStorage.getItem(PASSCODE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function setPasscode(value: string) {
  try {
    if (value) localStorage.setItem(PASSCODE_KEY, value)
    else localStorage.removeItem(PASSCODE_KEY)
  } catch {
    // Private browsing: the passcode lasts for this visit only.
  }
}

export const authHeaders = (): Record<string, string> => ({
  "x-studio-passcode": getPasscode(),
})

export class SyncError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request(path: string, init: RequestInit = {}) {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { ...authHeaders(), ...init.headers },
    })
  } catch {
    throw new SyncError(0, "You are offline. Changes will sync later.")
  }
  if (!response.ok && response.status !== 409) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string
    }
    throw new SyncError(
      response.status,
      data.error ||
        (response.status === 404
          ? "Sync is not deployed here yet."
          : "Studio could not sync right now."),
    )
  }
  return response
}

export type Remote = { state: AppState | null; updatedAt: number }

export async function pullState(): Promise<Remote> {
  return (await request("/api/sync")).json()
}

// Returns null when saved, or the newer remote copy if another device won.
export async function pushState(
  state: AppState,
  updatedAt: number,
): Promise<Remote | null> {
  const response = await request("/api/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, updatedAt }),
  })
  return response.status === 409 ? response.json() : null
}

export async function uploadVoice(id: string, blob: Blob) {
  await request(`/api/voice?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  })
}

export async function downloadVoice(id: string) {
  return (await request(`/api/voice?id=${encodeURIComponent(id)}`)).blob()
}
