import type { Config } from "@netlify/functions"
import { HttpError, assertPasscode, assertSameOrigin, errorResponse, json } from "../lib/gateway"

// Today's weather for the Today hero, from weatherapi.com. The key stays here on the server.
// Condition codes are turned into WMO codes so the app reads them the same way as its fallback.
const wmo = (code: number) => {
  if (code === 1000) return 0
  if (code === 1003) return 2
  if (code === 1006 || code === 1009) return 3
  if ([1030, 1135, 1147].includes(code)) return 45
  if ([1063, 1150, 1153, 1168, 1171, 1072].includes(code)) return 51
  if ([1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201].includes(code)) return 61
  if ([1240, 1243, 1246].includes(code)) return 80
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 95
  return 71 // snow, sleet and ice
}

type Hour = { time: string; temp_c: number; chance_of_rain: number; chance_of_snow: number; is_day: number; condition: { code: number } }

export default async (req: Request) => {
  try {
    assertSameOrigin(req)
    assertPasscode(req)
    const key = process.env.WEATHER_API_KEY
    if (!key) throw new HttpError(503, "Add WEATHER_API_KEY in Netlify for weather.")
    const url = new URL(req.url)
    const lat = Number(url.searchParams.get("lat"))
    const lon = Number(url.searchParams.get("lon"))
    const q = Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) ? `${lat.toFixed(2)},${lon.toFixed(2)}` : "London"
    const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${encodeURIComponent(q)}&days=3&aqi=no&alerts=yes`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new HttpError(502, "The weather service didn’t answer.")
    const data = await response.json()
    const day = data.forecast.forecastday[0]
    return json({
      place: data.location.name,
      now: { temp: Math.round(data.current.temp_c), code: wmo(data.current.condition.code), isDay: !!data.current.is_day, text: data.current.condition.text },
      high: Math.round(day.day.maxtemp_c),
      low: Math.round(day.day.mintemp_c),
      hours: (day.hour as Hour[]).map((hour) => ({
        time: hour.time.slice(11, 16),
        temp: Math.round(hour.temp_c),
        rain: Math.max(hour.chance_of_rain ?? 0, hour.chance_of_snow ?? 0),
        code: wmo(hour.condition.code),
        light: !!hour.is_day,
      })),
      days: (data.forecast.forecastday as { date: string; day: { maxtemp_c: number; mintemp_c: number; daily_chance_of_rain: number; daily_chance_of_snow: number; condition: { code: number; text: string } } }[]).map(
        (forecast) => ({
          date: forecast.date,
          high: Math.round(forecast.day.maxtemp_c),
          low: Math.round(forecast.day.mintemp_c),
          rain: Math.max(forecast.day.daily_chance_of_rain ?? 0, forecast.day.daily_chance_of_snow ?? 0),
          code: wmo(forecast.day.condition.code),
          text: forecast.day.condition.text,
        }),
      ),
      alerts: ((data.alerts?.alert ?? []) as { headline?: string; event?: string; severity?: string }[])
        .map((alert) => alert.event || alert.headline || "")
        .filter(Boolean)
        .slice(0, 2),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export const config: Config = { path: "/api/weather" }
