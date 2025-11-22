export function trackActivity(type: 'task' | 'routine' | 'habit', completed: boolean = true) {
  if (!completed) return
  
  const today = new Date().toISOString().split('T')[0]
  const history = JSON.parse(localStorage.getItem('activity-history') || '{}')
  
  if (!history[today]) {
    history[today] = { completed: 0, tasks: 0, routines: 0, habits: 0 }
  }
  
  history[today].completed += 1
  history[today][type === 'task' ? 'tasks' : type === 'routine' ? 'routines' : 'habits'] += 1
  
  localStorage.setItem('activity-history', JSON.stringify(history))
}

export function getStreak(): number {
  const history = JSON.parse(localStorage.getItem('activity-history') || '{}')
  let streak = 0
  const today = new Date()
  
  for (let i = 0; i < 365; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    
    if (history[dateKey] && history[dateKey].completed > 0) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  
  return streak
}
