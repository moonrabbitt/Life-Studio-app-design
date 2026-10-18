import { Check, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { deleteVoiceNote, getVoiceNote, saveVoiceNote } from "./audioStore"
import { downloadVoice, getPasscode, removeVoice } from "./sync"
import type { AppState } from "./types"
import { Button, formatDate, IconButton } from "./ui"

type Update = (recipe: (current: AppState) => AppState, message?: string) => void

async function loadAudio(id: string) {
  const local = await getVoiceNote(id).catch(() => undefined)
  if (local) return local
  if (!getPasscode()) return undefined
  const remote = await downloadVoice(id).catch(() => undefined)
  if (remote) await saveVoiceNote(id, remote).catch(() => undefined)
  return remote
}

const length = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

// Every voice note: play, rename and delete.
export function VoiceNoteList({ state, update, limit }: { state: AppState; update: Update; limit?: number }) {
  const notes = state.voiceNotes ?? []
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [confirming, setConfirming] = useState<string | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  useEffect(() => () => { if (playing) URL.revokeObjectURL(playing.url) }, [playing])

  const play = async (id: string) => {
    if (playing?.id === id) {
      audio.current?.pause()
      setPlaying(null)
      return
    }
    const blob = await loadAudio(id)
    if (!blob) {
      setMissing(id)
      return
    }
    setMissing(null)
    setPlaying({ id, url: URL.createObjectURL(blob) })
  }

  if (!notes.length) return <p className="capture-disclaimer">No voice notes yet.</p>
  return (
    <ul className="voice-list">
      {(limit ? notes.slice(0, limit) : notes).map((note) => (
        <li key={note.id}>
          <div className="voice-list__row">
            <button type="button" className="voice-list__play" aria-label={playing?.id === note.id ? `Pause ${note.title}` : `Play ${note.title}`} onClick={() => play(note.id)}>
              {playing?.id === note.id ? <Pause size={16} /> : <Play size={16} />}
            </button>
            {renaming === note.id ? (
              <form
                className="voice-list__rename"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (name.trim())
                    update(
                      (current) => ({
                        ...current,
                        voiceNotes: (current.voiceNotes ?? []).map((item) => (item.id === note.id ? { ...item, title: name.trim() } : item)),
                      }),
                      "Renamed.",
                    )
                  setRenaming(null)
                }}
              >
                <input value={name} onChange={(event) => setName(event.target.value)} autoFocus aria-label="Voice note name" />
                <button type="submit" className="icon-button" aria-label="Save name">
                  <Check size={18} />
                </button>
              </form>
            ) : (
              <span className="voice-list__text">
                <strong>{note.title}</strong>
                <small>
                  {formatDate(note.createdAt.slice(0, 10), { weekday: "short", day: "numeric", month: "short" })} · {length(note.duration)}
                </small>
              </span>
            )}
            {renaming !== note.id && (
              <>
                <IconButton label={`Rename ${note.title}`} icon={Pencil} onClick={() => { setRenaming(note.id); setName(note.title) }} />
                <IconButton label={`Delete ${note.title}`} icon={Trash2} onClick={() => setConfirming(note.id)} />
              </>
            )}
          </div>
          {playing?.id === note.id && <audio ref={audio} src={playing.url} autoPlay controls onEnded={() => setPlaying(null)} />}
          {missing === note.id && <p className="capture-disclaimer">This recording isn’t on this device yet. Connect sync in Settings to fetch it.</p>}
          {confirming === note.id && (
            <div className="plan-edit__delete">
              <p>Delete “{note.title}”? The recording is removed from this device and from sync.</p>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  update(
                    (current) => ({ ...current, voiceNotes: (current.voiceNotes ?? []).filter((item) => item.id !== note.id) }),
                    "Voice note deleted.",
                  )
                  deleteVoiceNote(note.id).catch(() => undefined)
                  if (getPasscode()) removeVoice(note.id).catch(() => undefined)
                  setConfirming(null)
                }}
              >
                Delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                Keep
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
