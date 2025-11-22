export interface TrackerEntry {
  date: string
  value: number
}

export interface Tracker {
  id: string
  name: string
  type: 'habit' | 'metric'
  unit: string
  goal: number
  entries: TrackerEntry[]
}
