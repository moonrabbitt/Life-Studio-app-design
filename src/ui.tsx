import { X, type LucideIcon } from "lucide-react"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { localDate } from "./ai"
import type { AppState } from "./types"

// Delete something with a few seconds to undo (provided by App).
type Remove = (recipe: (current: AppState) => AppState, message: string) => void
export const RemoveContext = createContext<Remove>(() => {})
export const useRemove = () => useContext(RemoveContext)

export const today = () => localDate()
export const uid = () => crypto.randomUUID()
export const formatDate = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
) => {
  // A bad date shows as blank rather than crashing the whole screen.
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", options ?? { day: "numeric", month: "short" }).format(date)
}

export function Button({
  children,
  onClick,
  variant = "primary",
  icon: Icon,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost" | "danger"
  icon?: LucideIcon
  type?: "button" | "submit"
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      className={`button button--${variant} ${className}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon size={18} strokeWidth={1.8} />}
      <span>{children}</span>
    </button>
  )
}

export function IconButton({
  label,
  icon: Icon,
  onClick,
  active,
}: {
  label: string
  icon: LucideIcon
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "is-active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={20} strokeWidth={1.8} />
    </button>
  )
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const dialogRef = useRef<HTMLElement>(null)
  // Keep the latest onClose without re-running the focus setup on every parent render.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), audio[controls], [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
    const initialFocus =
      dialogRef.current?.querySelector<HTMLElement>("[autofocus]") ??
      focusable()[0]
    initialFocus?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current()
        return
      }
      if (event.key !== "Tab") return
      const elements = focusable()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => closeRef.current()}
    >
      <section
        ref={dialogRef}
        className={`modal ${wide ? "modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__handle" />
        <header className="modal__header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <IconButton icon={X} label="Close" onClick={() => closeRef.current()} />
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  )
}

// A picture that falls back (or hides) if the file isn't there yet.
export function Art({
  src,
  fallback,
  className,
  alt = "",
}: {
  src: string
  fallback?: string
  className?: string
  alt?: string
}) {
  const [current, setCurrent] = useState(src)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  return (
    <img
      src={current}
      alt={alt}
      className={className}
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback)
        else setHidden(true)
      }}
    />
  )
}

const SWIPED_KEY = "life-studio:swiped"

// A one-time tip on touch screens, until you've swiped once.
export function SwipeHint({ text = "Tip: swipe left on something to delete it." }: { text?: string }) {
  const [seen] = useState(() => {
    try {
      return localStorage.getItem(SWIPED_KEY) === "1"
    } catch {
      return false
    }
  })
  return seen ? null : <p className="swipe-hint">{text}</p>
}

export type SwipeAction = {
  label: string
  icon?: LucideIcon
  tone?: "danger" | "neutral"
  onClick: () => void
}

// Swipe left to reveal actions (like Delete) so lists stay uncluttered.
// On devices with a mouse, a small handle appears on hover/focus instead.
export function SwipeRow({
  children,
  actions,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode
  actions: SwipeAction[]
  className?: string
  as?: "div" | "li"
}) {
  const width = actions.length * 86
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number; id: number } | null>(null)
  const moved = useRef(false)
  const root = useRef<HTMLDivElement & HTMLLIElement>(null)
  const open = offset !== 0

  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(SWIPED_KEY, "1")
    } catch {
      // Private mode: the tip just keeps showing.
    }
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOffset(0)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  return (
    <Tag ref={root} className={`swipe ${open ? "is-open" : ""} ${dragging ? "is-dragging" : ""} ${className}`}>
      <div className="swipe__actions" style={{ width }} aria-hidden={!open}>
        {actions.map(({ label, icon: Icon, tone = "neutral", onClick }) => (
          <button
            type="button"
            key={label}
            className={`swipe__action is-${tone}`}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOffset(0)
              onClick()
            }}
          >
            {Icon && <Icon size={18} />}
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div
        className={`swipe__content ${dragging ? "is-dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return
          start.current = { x: event.clientX, y: event.clientY, base: offset, id: event.pointerId }
          moved.current = false
        }}
        onPointerMove={(event) => {
          const s = start.current
          if (!s || s.id !== event.pointerId) return
          const dx = event.clientX - s.x
          const dy = event.clientY - s.y
          if (!dragging) {
            if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) {
              if (Math.abs(dy) > 12) start.current = null
              return
            }
            setDragging(true)
            moved.current = true
            ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
          }
          setOffset(Math.max(-width - 24, Math.min(0, s.base + dx)))
        }}
        onPointerUp={() => {
          if (dragging) setOffset((value) => (value < -width / 2 ? -width : 0))
          setDragging(false)
          start.current = null
        }}
        onPointerCancel={() => {
          setDragging(false)
          setOffset((value) => (value < -width / 2 ? -width : 0))
          start.current = null
        }}
        onClickCapture={(event) => {
          // A swipe shouldn't also count as a tap on the item.
          if (moved.current) {
            event.preventDefault()
            event.stopPropagation()
            moved.current = false
          } else if (open) {
            event.preventDefault()
            event.stopPropagation()
            setOffset(0)
          }
        }}
      >
        {children}
      </div>
      <button
        type="button"
        className="swipe__handle"
        aria-label={open ? "Hide actions" : "Show delete and other actions"}
        onClick={() => setOffset(open ? 0 : -width)}
      >
        <span aria-hidden="true">{open ? "›" : "‹"}</span>
      </button>
    </Tag>
  )
}
