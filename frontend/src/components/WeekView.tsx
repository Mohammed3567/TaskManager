import React from 'react'

type Occ = { task_id:string, title:string, date:string }

function getWeekStart(d: Date) {
  const s = new Date(d)
  const diff = s.getDate() - s.getDay()
  return new Date(s.setDate(diff))
}

export default function WeekView({ occurrences, weekDate, onSlotClick, onOccurrenceClick, onRangeSelect, persistentSelection }: any) {
  // support persistent selection passed from parent
  const persistent = persistentSelection || null
  const start = getWeekStart(weekDate || new Date())
  const days = Array.from({length:7}).map((_,i)=> new Date(start.getFullYear(), start.getMonth(), start.getDate()+i))

  // hours 0-23
  const hours = Array.from({length:24}).map((_,i)=>i)

  const byDate: Record<string, Occ[]> = {}
  try {
    (occurrences||[]).forEach((o:Occ)=>{
      const key = (o && o.date && typeof o.date === 'string') ? o.date.slice(0,10) : ''
      if (!byDate[key]) byDate[key]=[]
      byDate[key].push(o)
    })
  } catch (e) {
    console.error('WeekView: failed to group occurrences', e, occurrences)
  }

  // drag selection state
  const [dragging, setDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState<string | null>(null)
  const [hoverSlot, setHoverSlot] = React.useState<string | null>(null)

  function handleMouseDown(slotKey: string) {
    setDragging(true)
    setDragStart(slotKey)
  }

  function handleMouseUp(slotKey: string) {
    if (dragging && dragStart) {
      // determine range (start <= end) and make end inclusive (+1 hour)
      const s = new Date(dragStart)
      const e = new Date(slotKey)
      const startIso = s.toISOString()
      const endInclusive = new Date(Math.max(s.getTime(), e.getTime()) + 60*60*1000)
      const endIso = endInclusive.toISOString()
      onRangeSelect && onRangeSelect(startIso, endIso)
    }
    setDragging(false)
    setDragStart(null)
  }

  return (
    <div className="card">
      <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:8}}>
        <div style={{display:'flex', flexDirection:'column'}}>
          {hours.map(h=> <div key={h} style={{height:48, color:'#98a8c7'}}>{String(h).padStart(2,'0')}:00</div>)}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8}}>
          {days.map(day => {
            const key = day.toISOString().slice(0,10)
            const items = byDate[key]||[]
            return (
              <div key={key} style={{borderLeft:'1px solid rgba(255,255,255,0.02)'}}>
                {hours.map(h=>{
                  const slotKey = `${key}T${String(h).padStart(2,'0')}:00:00`
                  const item = items.find(it=> it.date.startsWith(key + 'T' + String(h).padStart(2,'0')))
                  const slotDate = new Date(slotKey)
                  let selected = false
                  // persistent selection highlight wins when present
                  if (persistent && persistent.start && persistent.end) {
                    const ps = new Date(persistent.start).getTime()
                    const pe = new Date(persistent.end).getTime()
                    if (slotDate.getTime() >= ps && slotDate.getTime() < pe) selected = true
                  } else if (dragging && dragStart) {
                    const a = new Date(dragStart)
                    const b = new Date(hoverSlot || slotKey)
                    const startMs = Math.min(a.getTime(), b.getTime())
                    const endMs = Math.max(a.getTime(), b.getTime()) + 60*60*1000 // inclusive
                    if (slotDate.getTime() >= startMs && slotDate.getTime() < endMs) selected = true
                  }

                  return (
                    <div key={slotKey}
                      onMouseDown={()=>handleMouseDown(slotKey)}
                      onMouseUp={()=>handleMouseUp(slotKey)}
                      onMouseEnter={()=> setHoverSlot(slotKey)}
                      onClick={()=> item ? (onOccurrenceClick && onOccurrenceClick(item.task_id, item.date)) : (onSlotClick && onSlotClick(slotKey))}
                      style={{height:48, padding:6, borderBottom:'1px dashed rgba(255,255,255,0.02)', background: selected ? 'rgba(20,90,150,0.18)' : undefined}}>
                      {item ? <div className="occ-item" style={{fontSize:12}}>{item.title}</div> : null}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
