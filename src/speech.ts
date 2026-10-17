// Browser speech-to-text (Web Speech API): free, no AI model or key needed.
// Safari uses Apple's recogniser and Chrome uses Google's.

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type Recognition = {
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

export const speechSupported = () => !!recognitionClass()

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
  let recognition: Recognition

  const join = () => `${committed} ${current}`.replace(/\s+/g, " ").trim()

  const begin = () => {
    recognition = new Recognition()
    recognition.lang = navigator.language || "en-GB"
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      current = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
      onText(join())
    }
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return
      failed = true
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
      if (stopping) {
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
      recognition?.abort()
    },
  }
}
