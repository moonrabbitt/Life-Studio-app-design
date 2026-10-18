import {
  AudioLines,
  CalendarPlus,
  Check,
  CloudOff,
  Feather,
  Map,
  MessageCircle,
  NotebookPen,
  Play,
  RefreshCw,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react"
import { nextUsefulAction } from "./training"
import type { AppState } from "./types"
import { Modal, today } from "./ui"
import type { SyncStatus } from "./useLifeStudioState"

type Sync = {
  status: SyncStatus
  lastSynced: number
  syncNow: () => Promise<void> | void
}

const syncText = (sync: Sync) => {
  if (sync.status === "off") return "Sync isn’t connected. Set it up in My space → Settings."
  if (sync.status === "syncing") return "Syncing…"
  if (sync.status === "offline") return "Offline. Changes will sync when you’re back online."
  if (sync.status === "locked") return "Passcode needed. Enter it in My space → Settings."
  if (sync.status === "error") return "Sync paused. Tap to try again."
  if (!sync.lastSynced) return "Synced"
  const minutes = Math.round((Date.now() - sync.lastSynced) / 60000)
  return minutes < 1 ? "Synced just now" : `Synced ${minutes} min ago`
}

// The ☰ menu: quick ways in, not settings. Settings live in My space.
export function QuickMenu({
  state,
  sync,
  onClose,
  onStudio,
  onLog,
  onAdd,
  onSpace,
  onVoiceNotes,
  onJourney,
  onStartNext,
}: {
  state: AppState
  sync: Sync
  onClose: () => void
  onStudio: () => void
  onLog: () => void
  onAdd: () => void
  onSpace: (space: "reflect" | "breathe" | "connect") => void
  onVoiceNotes: () => void
  onJourney: () => void
  onStartNext: (id: string) => void
}) {
  const next = nextUsefulAction(state.plan, today())
  const go = (action: () => void) => () => {
    onClose()
    action()
  }
  const tiles: { label: string; hint: string; icon: LucideIcon; onClick: () => void }[] = [
    { label: "Talk to Studio", hint: "Plan, move or ask", icon: MessageCircle, onClick: go(onStudio) },
    { label: "Log what I did", hint: "Quick note of an activity", icon: Check, onClick: go(onLog) },
    { label: "Add to plan", hint: "Something for today", icon: CalendarPlus, onClick: go(onAdd) },
    { label: "Journal", hint: "A few lines", icon: Feather, onClick: go(() => onSpace("reflect")) },
    { label: "Breathe", hint: "A quiet minute", icon: Wind, onClick: go(() => onSpace("breathe")) },
    { label: "Plan with a friend", hint: "Message, coffee, walk", icon: Users, onClick: go(() => onSpace("connect")) },
    { label: "Voice note", hint: "Private recording", icon: AudioLines, onClick: go(onVoiceNotes) },
    { label: "Your journey", hint: "Roadmap and story", icon: Map, onClick: go(onJourney) },
  ]
  return (
    <Modal title="Quick menu" eyebrow="Jump straight in" onClose={onClose}>
      <div className="quick-menu">
        {next && (next.item.status === "planned" || next.item.status === "proposed") && (
          <button type="button" className="quick-menu__next" onClick={go(() => onStartNext(next.item.id))}>
            <Play size={20} />
            <span>
              <small>{next.when === "today" ? "Next up" : "Coming up"}</small>
              <strong>Start {next.item.title}</strong>
            </span>
          </button>
        )}
        <div className="quick-menu__grid">
          {tiles.map(({ label, hint, icon: Icon, onClick }) => (
            <button type="button" key={label} onClick={onClick}>
              <Icon size={20} />
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`quick-menu__sync is-${sync.status}`}
          onClick={() => sync.syncNow()}
          disabled={sync.status === "syncing"}
        >
          {sync.status === "offline" || sync.status === "off" ? <CloudOff size={18} /> : <RefreshCw size={18} className={sync.status === "syncing" ? "is-spinning" : ""} />}
          <span>
            <strong>Sync now</strong>
            <small>{syncText(sync)}</small>
          </span>
        </button>
        <p className="quick-menu__note">
          <NotebookPen size={14} /> Settings, passcode and backups are in My space → Settings.
        </p>
      </div>
    </Modal>
  )
}
