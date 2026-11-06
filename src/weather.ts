import { useEffect, useState } from "react"
import type { AppState, PlanItem } from "./types"
import { authHeaders, getPasscode } from "./sync"
import { today } from "./ui"

// Weather for where you are: weatherapi.com through our own /api/weather (the key stays on the server),
// or Open-Meteo (free, no key) when that isn't available. Location is asked for once and kept on this
// device; if you say no, London is used. Forecasts are cached for half an hour.
const PLACE_KEY = "life-studio:weather-place"
const CACHE_KEY = "life-studio:weather"
const LONDON = { lat: 51.5072, lon: -0.1276, fallback: true }
const HALF_HOUR = 30 * 60000
const SIX_HOURS = 6 * 3600000

type Place = { lat: number; lon: number; at?: number; fallback?: boolean }
export type Weather = {
  at: number
  place?: string
  // Official weather warnings for today, e.g. "Yellow warning for wind".
  alerts?: string[]
  now: { temp: number; code: number; isDay: boolean }
  high: number
  low: number
  // Today, hour by hour.
  hours: { time: string; temp: number; rain: number; code: number; light?: boolean }[]
  // Today and the next two days.
  days?: { date: string; high: number; low: number; rain: number; code: number; text?: string }[]
}

const read = <T,>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null
  } catch {
    return null
  }
}
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing: just fetch again next time.
  }
}

const locate = () =>
  new Promise<Place>((resolve) => {
    if (!navigator.geolocation) return resolve(LONDON)
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: Math.round(position.coords.latitude * 100) / 100, lon: Math.round(position.coords.longitude * 100) / 100, at: Date.now() }),
      () => resolve(LONDON),
      { timeout: 10000, maximumAge: SIX_HOURS },
    )
  })

// Ask once; afterwards only refresh quietly if permission is already granted (so no repeat prompts).
async function placeOf(): Promise<Place> {
  const saved = read<Place>(PLACE_KEY)
  if (saved && (saved.fallback || Date.now() - (saved.at ?? 0) < SIX_HOURS)) return saved
  if (saved) {
    const status = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null)
    if (status?.state !== "granted") return saved
  }
  const place = await locate()
  write(PLACE_KEY, place)
  return place
}

async function fromStudio(place: Place): Promise<Weather | null> {
  if (!getPasscode()) return null
  try {
    const response = await fetch(`/api/weather?lat=${place.lat}&lon=${place.lon}`, { headers: authHeaders() })
    if (!response.ok) return null
    return { ...(await response.json()), at: Date.now() } as Weather
  } catch {
    return null
  }
}

// Open-Meteo: today hour by hour, and up to two weeks of days (later days are a rough guide).
async function fromOpenMeteo(place: Place): Promise<Weather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    "&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=14"
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    return {
      at: Date.now(),
      now: { temp: Math.round(data.current.temperature_2m), code: data.current.weather_code, isDay: !!data.current.is_day },
      high: Math.round(data.daily.temperature_2m_max[0]),
      low: Math.round(data.daily.temperature_2m_min[0]),
      days: (data.daily.time as string[]).map((date, index) => ({
        date,
        high: Math.round(data.daily.temperature_2m_max[index]),
        low: Math.round(data.daily.temperature_2m_min[index]),
        rain: data.daily.precipitation_probability_max?.[index] ?? 0,
        code: data.daily.weather_code[index],
      })),
      hours: (data.hourly.time as string[]).slice(0, 24).map((time, index) => ({
        time: time.slice(11, 16),
        temp: Math.round(data.hourly.temperature_2m[index]),
        rain: data.hourly.precipitation_probability[index] ?? 0,
        code: data.hourly.weather_code[index],
        light: data.hourly.is_day ? !!data.hourly.is_day[index] : undefined,
      })),
    }
  } catch {
    return null
  }
}

// weatherapi.com (via Studio) for today and the next two days, Open-Meteo for the rest of the fortnight.
async function fetchWeather(): Promise<Weather | null> {
  const cached = read<Weather>(CACHE_KEY)
  if (cached && Date.now() - cached.at < HALF_HOUR) return cached
  const place = await placeOf()
  const [studio, open] = await Promise.all([fromStudio(place), fromOpenMeteo(place)])
  const weather = studio
    ? { ...studio, days: [...(studio.days ?? []), ...(open?.days ?? []).filter((day) => !studio.days?.some((near) => near.date === day.date))] }
    : open
  if (!weather) return cached
  write(CACHE_KEY, weather)
  return weather
}

export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(() => read<Weather>(CACHE_KEY))
  useEffect(() => {
    let live = true
    const load = () => fetchWeather().then((value) => live && value && setWeather(value))
    load()
    const timer = window.setInterval(load, HALF_HOUR)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [])
  return weather
}

// WMO weather codes → a small symbol and a word.
export const describe = (code: number, isDay = true) => {
  if (code === 0) return { icon: isDay ? "☀️" : "🌙", word: "clear" }
  if (code <= 2) return { icon: isDay ? "🌤️" : "☁️", word: "partly cloudy" }
  if (code === 3) return { icon: "☁️", word: "cloudy" }
  if (code <= 48) return { icon: "🌫️", word: "foggy" }
  if (code <= 57) return { icon: "🌦️", word: "drizzly" }
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: "🌧️", word: "rainy" }
  if (code <= 77 || code === 85 || code === 86) return { icon: "🌨️", word: "snowy" }
  return { icon: "⛈️", word: "stormy" }
}

const OUTDOOR = /walk|run|jog|park|picnic|cycle|bike|hike|market|garden|outside|outdoor/i
const isOutdoor = (item: PlanItem) => item.kind === "walk" || item.kind === "run" || OUTDOOR.test(item.title)
const hourOf = (time: string) => Number(time.slice(0, 2))
const label = (item: PlanItem) => item.title.charAt(0).toLowerCase() + item.title.slice(1)

// Gentle lines for days when the weather has nothing to say about your plans.
export const GENTLE_LINES = [
  "Small steps still count. So do rest days.",
  "You don’t have to do it all today. Just the next kind thing.",
  "A slow day is still a day lived.",
  "Be as patient with yourself as you would be with a friend.",
  "Nothing needs to be perfect to be worth doing.",
  "Notice one good thing today. That’s enough.",
  "Progress is quiet. It still adds up.",
  "Drink some water, open a window, carry on.",
  "You’re allowed to change the plan.",
  "Today can be ordinary. Ordinary is good.",
  "Start small. Small is how everything starts.",
  "Rest is part of the work, not a break from it.",
  "Do one thing slowly and properly.",
  "Somewhere today there’s a dog doing a happy little wiggle.",
  "It’s okay to go gently.",
  "You’ve done hard things before. This is allowed to be easy.",
  "Leave a little room in the day for something unexpected.",
  "Tired is information, not failure.",
  "One page, one walk, one call. Any one of them is a good day.",
  "The plan is there to help you, not to judge you.",
  "Look up at the sky at least once today.",
  "Done is lovely. Started is lovely too.",
  "Be where your feet are.",
  "Make something small just because you want to.",
  "You don’t need to earn a nice evening.",
  "A good day doesn’t have to be a productive one.",
  "Somebody is glad you exist. Probably several somebodies.",
  "Take the long way round once in a while.",
]

const lineOfDay = (date: string) => GENTLE_LINES[Math.abs(Number(date.replace(/-/g, "")) * 7919) % GENTLE_LINES.length]

// One line for the hero: weather that matters for today's plans, otherwise a gentle line.
export function heroLine(state: AppState, weather: Weather | null): string {
  const date = today()
  if (!weather) return lineOfDay(date)
  if (weather.alerts?.length) return `Weather warning today: ${weather.alerts[0]}. Go gently out there.`
  const nowHour = new Date().getHours()
  const ahead = weather.hours.filter((hour) => hourOf(hour.time) >= nowHour)
  const outdoor = state.plan
    .filter((item) => item.date === date && item.time && item.status !== "complete" && item.status !== "let-go" && isOutdoor(item))
    .filter((item) => hourOf(item.time!) >= nowHour)
    .sort((a, b) => a.time!.localeCompare(b.time!))[0]

  if (outdoor) {
    const at = hourOf(outdoor.time!)
    const slot = weather.hours.find((hour) => hourOf(hour.time) === at)
    if (slot) {
      if (slot.rain >= 50) {
        // The nearest dry hour that's still ahead, in daylight, and free of your other timed plans.
        const busy = new Set(
          state.plan.filter((item) => item.date === date && item.time && item.id !== outdoor.id && item.status !== "let-go").map((item) => hourOf(item.time!)),
        )
        const dry = ahead
          .filter((hour) => {
            const h = hourOf(hour.time)
            return h > nowHour && h >= 8 && h <= 20 && hour.light !== false && h !== at && hour.rain < 30 && Math.abs(h - at) <= 4 && !busy.has(h)
          })
          .sort((a, b) => Math.abs(hourOf(a.time) - at) - Math.abs(hourOf(b.time) - at))[0]
        return dry
          ? `Rain likely around ${outdoor.time} for your ${label(outdoor)}. It looks drier at ${dry.time}, if you can move it.`
          : `Rain likely around ${outdoor.time} for your ${label(outdoor)}. A coat, or an indoor version, both count.`
      }
      if (slot.temp <= 3) return `Cold for your ${label(outdoor)} at ${outdoor.time}: ${slot.temp}°. Layers, and an extra few minutes to warm up.`
      if (slot.temp >= 26) return `Warm for your ${label(outdoor)} at ${outdoor.time}: ${slot.temp}°. Water, shade, and an easier pace.`
      if (slot.rain < 20 && slot.code <= 2 && slot.temp >= 10) return `Lovely for your ${label(outdoor)} at ${outdoor.time}: ${slot.temp}° and dry.`
      if (slot.rain < 30) return `Dry for your ${label(outdoor)} at ${outdoor.time}, about ${slot.temp}°.`
    }
  }

  if (nowHour < 18) {
    const rain = ahead.find((hour) => hour.rain >= 60 && hourOf(hour.time) <= 20)
    if (rain && hourOf(rain.time) > nowHour && weather.now.code <= 3)
      return `Dry for now, rain from about ${rain.time}. If you want some fresh air, earlier is better.`
    if (weather.now.isDay && weather.now.code <= 1 && weather.now.temp >= 8) return "Sunny out right now. Even five minutes outside counts."
  }
  return lineOfDay(date)
}

// A short summary for Studio, so plans and suggestions can work around the weather.
export function weatherContext() {
  const weather = read<Weather>(CACHE_KEY)
  if (!weather || Date.now() - weather.at > 12 * 3600000) return undefined
  const wet = weather.hours.filter((hour) => hour.rain >= 50).map((hour) => hour.time)
  const spans = wet.reduce<string[][]>((groups, time) => {
    const last = groups[groups.length - 1]
    if (last && Number(time.slice(0, 2)) - Number(last[last.length - 1].slice(0, 2)) === 1) last.push(time)
    else groups.push([time])
    return groups
  }, [])
  return {
    place: weather.place,
    now: `${weather.now.temp}°, ${describe(weather.now.code, weather.now.isDay).word}`,
    rainLikelyToday: spans.map((span) => (span.length > 1 ? `${span[0]}–${span[span.length - 1]}` : span[0])),
    darkAfter: weather.hours.find((hour, index) => index > 10 && hour.light === false)?.time,
    // The first three days are a good forecast; days after that are a rough guide.
    days: weather.days?.slice(0, 7).map((day) => `${day.date}: ${day.high}°/${day.low}°, ${day.text ?? describe(day.code).word}, ${day.rain}% chance of rain`),
    alerts: weather.alerts?.length ? weather.alerts : undefined,
  }
}

// The forecast for one of the next few days, for Plan.
export const forecastFor = (weather: Weather | null, date: string) => weather?.days?.find((day) => day.date === date)
