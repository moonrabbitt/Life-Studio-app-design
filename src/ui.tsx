import { X, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { localDate } from "./ai"

export const today = () => localDate()
export const uid = () => crypto.randomUUID()
export const formatDate = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat(
    "en-GB",
    options ?? { day: "numeric", month: "short" },
  ).format(new Date(`${value}T12:00:00`))

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
