export function formatDate(date: Date | string, format: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()
  
  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    default:
      return `${month}/${day}/${year}`
  }
}

export function formatTime(date: Date | string, format: '12h' | '24h'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (format === '24h') {
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  } else {
    let hours = d.getHours()
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${hours}:${minutes} ${ampm}`
  }
}

export function getStartOfWeek(date: Date, startDay: 'sunday' | 'monday' | 'saturday'): Date {
  const d = new Date(date)
  const day = d.getDay()
  
  let diff = 0
  if (startDay === 'monday') {
    diff = day === 0 ? -6 : 1 - day
  } else if (startDay === 'saturday') {
    diff = day === 6 ? 0 : -(day + 1)
  } else {
    diff = -day
  }
  
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
