import React from 'react'

const PRIORITIES = [
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'IMPORTANT', label: 'Important' },
  { key: 'ROUTINE', label: 'Routine' },
]

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    if (d.getHours() === 0 && d.getMinutes() === 0) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function buildDefaultDate(dayDate?: string) {
  return dayDate || ''
}

function toYMD(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseYMD(s?: string) {
  if (!s) return new Date()
  const parts = s.split('-')
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  return new Date(y, m - 1, d)
}

export default function DayView({ occurrences, dayDate, onSlotClick, onOccurrenceClick, onToggleStatus }: any) {
  const date = dayDate ? parseYMD(dayDate) : new Date()
  const key = toYMD(date)
  const defaultDate = buildDefaultDate(key)
  const items = (occurrences || []).filter((o: any) => o.date && toYMD(new Date(o.date)) === key)

  const grouped = PRIORITIES.reduce((acc, priority) => {
    acc[priority.key] = items
      .filter((o: any) => o.priority === priority.key)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>Day view</h3>
          <div className="small">{date.toDateString()}</div>
        </div>
        <button className="btn primary" type="button" onClick={() => onSlotClick && onSlotClick(defaultDate)}>
          Add task for today
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {PRIORITIES.map(priority => {
          const sectionItems = grouped[priority.key] || []
          return (
            <div key={priority.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{priority.label}</div>
                  <div className="small">{sectionItems.length} tasks</div>
                </div>
                <button className="btn" type="button" onClick={() => onSlotClick && onSlotClick(defaultDate)}>
                  New
                </button>
              </div>
              {sectionItems.length === 0 ? (
                <div className="small">No tasks in this priority yet.</div>
              ) : (
                sectionItems.map((item: any) => (
                  <div key={item.task_id + item.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding:'8px', borderRadius:10, background:'rgba(255,255,255,0.02)', marginBottom:6 }}>
                    <input
                      type="checkbox"
                      checked={item.status === 'COMPLETED'}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        e.stopPropagation()
                        const occurrenceKey = item.original_occurrence_date || item.occurrence_date || item.date
                        if (typeof onToggleStatus === 'function') onToggleStatus(item.task_id, occurrenceKey, Boolean(item.is_recurring), e.target.checked)
                      }}
                    />
                    <div style={{ flex: 1, display:'flex', justifyContent:'space-between', cursor:'pointer' }} onClick={() => onOccurrenceClick && onOccurrenceClick(item.task_id, item.date, item)}>
                      <span>{formatTime(item.date)}</span>
                      <span style={{ marginLeft: 8, flex: 1, textDecoration: item.status === 'COMPLETED' ? 'line-through' : 'none' }}>{item.title}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
