import React from 'react'

type Occurrence = {
  task_id: string
  title: string
  date: string
  status?: string
  is_recurring?: boolean
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toYMD(d: Date) {
  try {
    if (!d) return ''
    if (typeof (d as any).toISOString === 'function') return (d as Date).toISOString().slice(0, 10)
    if (typeof d === 'string') return d.slice(0, 10)
    return ''
  } catch (err) {
    console.error('toYMD error', d, err)
    return ''
  }
}

export default function MonthView({ occurrences, monthDate, onDayClick, onOccurrenceClick, onToggleStatus }: { occurrences: Occurrence[] | any; monthDate?: Date; onDayClick?: (isoDate:string)=>void; onOccurrenceClick?: (taskId:string, iso:string)=>void; onToggleStatus?: (taskId:string, iso:string, isRecurring:boolean, done:boolean)=>void }) {
  const base = monthDate || new Date()
  const start = startOfMonth(base)
  const startWeekDay = start.getDay() // 0=Sun
  const firstGridDate = addDays(start, -startWeekDay)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) days.push(addDays(firstGridDate, i))

  // group occurrences by date (YYYY-MM-DD)
  const byDate: Record<string, Occurrence[]> = {}
  const occList: Occurrence[] = Array.isArray(occurrences) ? occurrences : []
  if (!Array.isArray(occurrences)) console.warn('MonthView: occurrences is not an array', occurrences)
  else console.debug('MonthView occurrences count', occList.length, occList.slice(0,2))
  occList.forEach((o:any) => {
    const key = (o && o.date) ? (typeof o.date === 'string' ? o.date.slice(0,10) : toYMD(new Date(o.date))) : ''
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(o)
  })

  const todayKey = toYMD(new Date())

  try {
    return (
      <div className="card">
      <div className="month-grid small">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{fontWeight:700, textAlign:'center'}}>{d}</div>
        ))}
      </div>
      <div className="month-grid" style={{marginTop:10}}>
        {days.map(day => {
          const key = toYMD(day)
          const items = byDate[key] || []
          const isCurrentMonth = day.getMonth() === base.getMonth()
          const classes = ['day-cell']
          if (!isCurrentMonth) classes.push('outside')
          if (key === todayKey) classes.push('today')
          return (
            <div key={key} className={classes.join(' ')} onClick={() => { if (typeof onDayClick === 'function') onDayClick(key) }} style={{cursor: typeof onDayClick === 'function'? 'pointer':'default'}}>
              <div className="day-number" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span>{day.getDate()}</span>
              </div>
              <div style={{marginTop:8}}>
                {items.slice(0,3).map(it => (
                  <div key={it.task_id + it.date} className="occ-item" style={{display:'flex', alignItems:'center', gap:8}}>
                    <input
                      type="checkbox"
                      checked={it.status === 'DONE'}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        e.stopPropagation()
                        if (typeof onToggleStatus === 'function') onToggleStatus(it.task_id, it.date, Boolean(it.is_recurring), e.target.checked)
                      }}
                    />
                    <div
                      style={{flex:1, textDecoration: it.status === 'DONE' ? 'line-through' : 'none', cursor:'pointer'}}
                      onClick={e => { e.stopPropagation(); if (typeof onOccurrenceClick === 'function') onOccurrenceClick(it.task_id, it.date) }}
                    >
                      {it.title}
                    </div>
                  </div>
                ))}
                {items.length > 3 && <div className="small">+{items.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
      </div>
    )
  } catch (err) {
    console.error('MonthView render caught', err, { occurrences, monthDate })
    return <div className="card">Error rendering month view</div>
  }
}
