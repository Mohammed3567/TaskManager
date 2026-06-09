import React from 'react'

type Occurrence = { task_id: string; title: string; date: string; priority: string; status?: string; is_recurring?: boolean }

function getWeekStart(d: Date) {
  const result = new Date(d)
  const diff = result.getDate() - result.getDay()
  result.setDate(diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    if (d.getHours() === 0 && d.getMinutes() === 0) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function WeekView({ occurrences, weekDate, onSlotClick, onOccurrenceClick, onToggleStatus }: any) {
  const start = getWeekStart(weekDate ? new Date(weekDate) : new Date())
  const days = Array.from({ length: 7 }).map((_, index) => {
    const d = new Date(start)
    d.setDate(start.getDate() + index)
    return d
  })

  const byDate: Record<string, Occurrence[]> = {}
  ;(occurrences || []).forEach((occ: any) => {
    const key = typeof occ.date === 'string' ? occ.date.slice(0, 10) : ''
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(occ)
  })

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Week view</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
        {days.map(day => {
          const key = day.toISOString().slice(0, 10)
          const dayItems = (byDate[key] || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          return (
            <div key={key} style={{ borderRadius: 14, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ marginBottom: 10, fontWeight: 700 }}>{formatDayLabel(day)}</div>
              {dayItems.length === 0 ? (
                <div className="small" style={{ marginBottom: 8 }}>No tasks</div>
              ) : (
                dayItems.map((item: any) => (
                  <div key={item.task_id + item.date} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor:'pointer', padding:'6px 8px', borderRadius:8, background: 'rgba(255,255,255,0.02)' }} onClick={() => onOccurrenceClick && onOccurrenceClick(item.task_id, item.date)}>
                      <input
                        type="checkbox"
                        checked={item.status === 'DONE'}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          e.stopPropagation()
                          if (typeof onToggleStatus === 'function') onToggleStatus(item.task_id, item.date, Boolean(item.is_recurring), e.target.checked)
                        }}
                      />
                      <div style={{ flex: 1, textDecoration: item.status === 'DONE' ? 'line-through' : 'none' }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{formatTime(item.date)}</div>
                        <div>{item.title}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <button className="btn" type="button" style={{ marginTop: 4 }} onClick={() => onSlotClick && onSlotClick(key)}>
                + Add
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
