import { addDays } from "./training"
import type { AppState, PlanItem, RepeatFrequency, Series } from "./types"
import { today } from "./ui"

export const REPEAT_LABELS: Record<RepeatFrequency, string> = {
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  fortnightly: "Every 2 weeks",
  monthly: "Every month",
}

const HORIZON_DAYS = 56

const addMonths = (date: string, months: number) => {
  const [y, m, d] = date.split("-").map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, last))
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`
}

// Every occurrence date of a series between two dates (inclusive).
export function seriesDates(series: Series, from: string, to: string) {
  const dates: string[] = []
  const end = series.until && series.until < to ? series.until : to
  let date = series.start
  let index = 0
  while (date <= end && index < 800) {
    const weekday = new Date(`${date}T12:00:00`).getDay()
    const include = series.frequency !== "weekdays" || (weekday >= 1 && weekday <= 5)
    if (include && date >= from && !series.exceptions.includes(date)) dates.push(date)
    index++
    date =
      series.frequency === "monthly"
        ? addMonths(series.start, index)
        : addDays(
            series.start,
            index * (series.frequency === "weekly" ? 7 : series.frequency === "fortnightly" ? 14 : 1),
          )
  }
  return dates
}

const occurrence = (series: Series, date: string): PlanItem => ({
  ...series.template,
  id: `${series.id}-${date}`,
  date,
  status: "planned",
  seriesId: series.id,
})

// Keeps every series filled a few weeks ahead. Ids are deterministic, so devices never duplicate.
export function extendSeries(state: AppState): AppState {
  if (!state.series?.length) return state
  const existing = new Set(state.plan.map((item) => item.id))
  const added: PlanItem[] = []
  for (const series of state.series)
    for (const date of seriesDates(series, series.start, addDays(today(), HORIZON_DAYS)))
      if (!existing.has(`${series.id}-${date}`) && date >= addDays(today(), -1)) added.push(occurrence(series, date))
  return added.length ? { ...state, plan: [...state.plan, ...added] } : state
}

export function createSeries(
  state: AppState,
  template: Series["template"],
  frequency: RepeatFrequency,
  start: string,
  until?: string,
  extra: Partial<Series> = {},
): { state: AppState; series: Series } {
  const series: Series = { id: `series-${crypto.randomUUID().slice(0, 8)}`, template, frequency, start, until, exceptions: [], ...extra }
  return { series, state: extendSeries({ ...state, series: [...(state.series ?? []), series] }) }
}

// Stop a series before a date and remove its open occurrences from that date on.
export function endSeriesBefore(state: AppState, seriesId: string, date: string): AppState {
  return {
    ...state,
    series: (state.series ?? []).map((series) =>
      series.id === seriesId ? { ...series, until: addDays(date, -1) } : series,
    ),
    plan: state.plan.filter(
      (item) => !(item.seriesId === seriesId && item.date >= date && item.status !== "complete"),
    ),
  }
}

export function skipOccurrence(state: AppState, item: PlanItem): AppState {
  return {
    ...state,
    series: (state.series ?? []).map((series) =>
      series.id === item.seriesId ? { ...series, exceptions: [...series.exceptions, item.date] } : series,
    ),
    plan: state.plan.filter((candidate) => candidate.id !== item.id),
  }
}

// Apply edits to this and every later open occurrence, and to future generated ones.
export function editFuture(state: AppState, item: PlanItem, changes: Partial<PlanItem>): AppState {
  const { date: _date, status: _status, log: _log, id: _id, ...fields } = changes
  return {
    ...state,
    series: (state.series ?? []).map((series) =>
      series.id === item.seriesId ? { ...series, template: { ...series.template, ...fields } } : series,
    ),
    plan: state.plan.map((candidate) =>
      candidate.seriesId === item.seriesId && candidate.date >= item.date && candidate.status !== "complete"
        ? { ...candidate, ...fields }
        : candidate,
    ),
  }
}

export const seriesOf = (state: AppState, item: PlanItem) =>
  (state.series ?? []).find((series) => series.id === item.seriesId)
