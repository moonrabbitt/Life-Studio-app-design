// Browser speech-to-text (Web Speech API): free, no AI model or key needed.
// Safari uses Apple's recogniser and Chrome uses Google's.

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type Recognition = {
  onstart?: (() => void) | null
  onaudiostart?: (() => void) | null
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionConstructor = new () => Recognition

function recognitionClass() {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

// iPhone home-screen web apps expose the API but it silently does nothing.
export const isHomeScreenApp = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia?.("(display-mode: standalone)").matches

export const speechSupported = () =>
  !!recognitionClass() && !(isIOS() && isHomeScreenApp())

export type SpeechErrorKind = "permission" | "unavailable"

export function listen({
  onText,
  onDone,
  onError,
}: {
  onText: (text: string) => void
  onDone: (text: string) => void
  onError: (kind: SpeechErrorKind) => void
}) {
  const Recognition = recognitionClass()
  if (!Recognition) {
    onError("unavailable")
    return { stop() {}, cancel() {} }
  }

  let committed = ""
  let current = ""
  let stopping = false
  let cancelled = false
  let failed = false
  let started = false
  let recognition: Recognition
  const ios = isIOS()

  // If recognition never actually starts, fall back instead of waiting silently.
  const watchdog = window.setTimeout(() => {
    if (started || cancelled || failed) return
    failed = true
    try {
      recognition?.abort()
    } catch {
      // Already stopped.
    }
    onError("unavailable")
  }, 5000)

  const join = () => `${committed} ${current}`.replace(/\s+/g, " ").trim()

  const begin = () => {
    recognition = new Recognition()
    recognition.lang = navigator.language || "en-GB"
    // iPhones misbehave in continuous mode; one session at a time is reliable there.
    recognition.continuous = !ios
    recognition.interimResults = true
    recognition.onstart = () => {
      started = true
    }
    recognition.onaudiostart = () => {
      started = true
    }
    recognition.onresult = (event) => {
      started = true
      current = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
      onText(join())
    }
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return
      failed = true
      window.clearTimeout(watchdog)
      onError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "permission"
          : "unavailable",
      )
    }
    recognition.onend = () => {
      if (cancelled || failed) return
      committed = join()
      current = ""
      // On iPhone a restart outside a tap is unreliable, so finish with what was heard.
      if (stopping || ios) {
        window.clearTimeout(watchdog)
        onDone(committed)
        return
      }
      // Safari ends sessions after a pause; carry on listening until you tap stop.
      try {
        begin()
      } catch {
        onDone(committed)
      }
    }
    recognition.start()
  }

  try {
    begin()
  } catch {
    onError("unavailable")
  }

  return {
    stop() {
      stopping = true
      recognition?.stop()
    },
    cancel() {
      cancelled = true
      window.clearTimeout(watchdog)
      recognition?.abort()
    },
  }
}
