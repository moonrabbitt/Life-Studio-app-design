// Soft, short sound effects made with Web Audio (no files to download). Quiet by design:
// a few warm notes for moments worth marking, never for ordinary taps.
export type Sound = "done" | "big" | "remove" | "undo" | "night" | "morning"

let enabled = true
let context: AudioContext | null = null

export const setSoundsOn = (on: boolean) => {
  enabled = on
}

const audio = () => {
  if (typeof window === "undefined") return null
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return null
  context ??= new Context()
  if (context.state === "suspended") context.resume().catch(() => {})
  return context
}

// One soft, bell-like note: a sine with a quiet octave above, quick attack, long gentle fade.
const note = (ctx: AudioContext, out: AudioNode, frequency: number, at: number, length = 0.9, volume = 0.07) => {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  gain.connect(out)
  const body = ctx.createOscillator()
  body.type = "sine"
  body.frequency.setValueAtTime(frequency, at)
  body.connect(gain)
  const shimmer = ctx.createOscillator()
  const shimmerGain = ctx.createGain()
  shimmer.type = "triangle"
  shimmer.frequency.setValueAtTime(frequency * 2, at)
  shimmerGain.gain.value = 0.18
  shimmer.connect(shimmerGain).connect(gain)
  for (const oscillator of [body, shimmer]) {
    oscillator.start(at)
    oscillator.stop(at + length + 0.05)
  }
}

// A soft breath of filtered noise, for putting something away.
const puff = (ctx: AudioContext, out: AudioNode, at: number) => {
  const length = 0.22
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const band = ctx.createBiquadFilter()
  band.type = "bandpass"
  band.Q.value = 0.8
  band.frequency.setValueAtTime(1400, at)
  band.frequency.exponentialRampToValueAtTime(380, at + length)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.06, at + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  source.connect(band).connect(gain).connect(out)
  source.start(at)
  source.stop(at + length)
}

// Notes (Hz) from a major pentatonic scale, so everything sounds gentle together.
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, G4 = 392, E4 = 329.63, C4 = 261.63

export function play(sound: Sound) {
  if (!enabled) return
  try {
    const ctx = audio()
    if (!ctx) return
    const now = ctx.currentTime + 0.01
    // Everything goes through a warm low-pass, so nothing is sharp or tinny.
    const warm = ctx.createBiquadFilter()
    warm.type = "lowpass"
    warm.frequency.value = sound === "night" ? 1600 : 3200
    warm.connect(ctx.destination)
    if (sound === "done") {
      note(ctx, warm, E5, now, 0.7)
      note(ctx, warm, A5, now + 0.09, 0.9)
    } else if (sound === "big") {
      ;[C5, E5, G5, C6].forEach((frequency, index) => note(ctx, warm, frequency, now + index * 0.11, 1.4, 0.065))
    } else if (sound === "remove") {
      puff(ctx, warm, now)
    } else if (sound === "undo") {
      note(ctx, warm, D5, now, 0.35, 0.05)
      note(ctx, warm, G5, now + 0.06, 0.45, 0.05)
    } else if (sound === "night") {
      note(ctx, warm, G4, now, 1.4, 0.06)
      note(ctx, warm, E4, now + 0.22, 1.6, 0.055)
      note(ctx, warm, C4, now + 0.46, 2.2, 0.05)
    } else if (sound === "morning") {
      ;[C5, D5, E5, G5].forEach((frequency, index) => note(ctx, warm, frequency, now + index * 0.13, 1.1, 0.055))
    }
  } catch {
    // Sound is a nicety; never let it break anything.
  }
}
