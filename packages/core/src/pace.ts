export const PACE_DISTANCES = [1, 5, 10, 15, 20, 21.098, 25, 30, 35, 40, 42.195] as const
export const MARATHON_GOAL_RANGES = [
  { id: '2-3-30', minSeconds: 2 * 3600, maxSeconds: 3.5 * 3600 },
  { id: '3-30-5', minSeconds: 3.5 * 3600, maxSeconds: 5 * 3600 },
  { id: '5-6-30', minSeconds: 5 * 3600, maxSeconds: 6.5 * 3600 },
] as const

export function marathonGoals(range: (typeof MARATHON_GOAL_RANGES)[number]): number[] {
  return Array.from({ length: 19 }, (_, index) => range.minSeconds + index * 5 * 60)
}

function timeString(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours}'${String(minutes).padStart(2, '0')}'${String(secs).padStart(2, '0')}"`
  if (minutes > 0) return `${minutes}'${String(secs).padStart(2, '0')}"`
  return `${String(secs).padStart(2, '0')}"`
}

export function parseTime(value: string): number {
  const normalized = value.trim()
  const hours = /^(\d+)'(\d{2})'(\d{2})"$/.exec(normalized)
  if (hours) return Number(hours[1]) * 3600 + Number(hours[2]) * 60 + Number(hours[3])
  const minutes = /^(\d+)'(\d{2})"$/.exec(normalized)
  if (minutes) return Number(minutes[1]) * 60 + Number(minutes[2])
  const seconds = /^(\d+)"$/.exec(normalized)
  if (seconds) return Number(seconds[1])
  throw new Error('Invalid time')
}

export function marathonPace(goalSeconds: number): string[] {
  if (!Number.isFinite(goalSeconds) || goalSeconds < 0) throw new Error('Invalid goal seconds')
  return [timeString(goalSeconds), ...PACE_DISTANCES.slice(0, -1).map((distance) => timeString(goalSeconds * distance / 42.195)), timeString(goalSeconds)]
}
