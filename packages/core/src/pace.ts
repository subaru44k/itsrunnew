export const PACE_DISTANCES = [1, 5, 10, 15, 20, 21.098, 25, 30, 35, 40, 42.195] as const

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
  const match = /^(?:(\d+)'\s*)?(?:(\d{1,2})'\s*)?(\d{1,2})"$/.exec(value.trim())
  if (!match) throw new Error('Invalid time')
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? (match[1] ? 0 : 0))
  const seconds = Number(match[3])
  if (minutes > 59 || seconds > 59) throw new Error('Invalid time')
  return hours * 3600 + minutes * 60 + seconds
}

export function marathonPace(goalSeconds: number): string[] {
  if (!Number.isFinite(goalSeconds) || goalSeconds < 0) throw new Error('Invalid goal seconds')
  return [timeString(goalSeconds), ...PACE_DISTANCES.slice(0, -1).map((distance) => timeString(goalSeconds * distance / 42.195)), timeString(goalSeconds)]
}
