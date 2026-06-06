import React from 'react'

export default function DayView({ occurrences, dayDate, onSlotClick, onOccurrenceClick, onRangeSelect, persistentSelection }: any) {
  const d = dayDate ? new Date(dayDate) : new Date()
  const key = d.toISOString().slice(0,10)
  const hours = Array.from({length:24}).map((_,i)=>i)
  const items = (occurrences||[]).filter((o:any)=> o.date.startsWith(key))
  // drag selection
  const [dragging, setDragging] = React.useState(false)
  const [dragStart, setDragStart] = React.useState<string | null>(null)
  const [hoverSlot, setHoverSlot] = React.useState<string | null>(null)

  function handleMouseDown(slotKey: string) {
    setDragging(true)
    setDragStart(slotKey)
  }

  function handleMouseUp(slotKey: string) {
    if (dragging && dragStart) {
      // compute inclusive end (add 1 hour to end slot)
      const s = new Date(dragStart)
      const e = new Date(slotKey)
      const startIso = s.toISOString()
      const endInclusive = new Date(Math.max(s.getTime(), e.getTime()) + 60*60*1000)
      const endIso = endInclusive.toISOString()
      if (onRangeSelect) {
        onRangeSelect(startIso, endIso)
      } else {
        onSlotClick && onSlotClick(startIso)
      }
    }
    setDragging(false)
    setDragStart(null)
  }

  function handleMouseEnter(slotKey: string) {
    if (dragging) setHoverSlot(slotKey)
  }

  return (
    <div className="card">
      <h4 style={{marginTop:0}}>{d.toDateString()}</h4>
      <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:8}}>
        <div style={{display:'flex', flexDirection:'column'}}>
          {hours.map(h=> <div key={h} style={{height:48, color:'#98a8c7'}}>{String(h).padStart(2,'0')}:00</div>)}
        </div>
        <div>
          {hours.map(h=>{
            const slotKey = `${key}T${String(h).padStart(2,'0')}:00:00`
            const item = items.find((it:any)=> it.date.startsWith(key + 'T' + String(h).padStart(2,'0')))
            const slotDate = new Date(slotKey)
            let selected = false
            if (persistentSelection && persistentSelection.start && persistentSelection.end) {
              const ps = new Date(persistentSelection.start).getTime()
              const pe = new Date(persistentSelection.end).getTime()
              if (slotDate.getTime() >= ps && slotDate.getTime() < pe) selected = true
            } else if (dragging && dragStart) {
              const a = new Date(dragStart)
              const b = new Date(hoverSlot || slotKey)
              const startMs = Math.min(a.getTime(), b.getTime())
              const endMs = Math.max(a.getTime(), b.getTime()) + 60*60*1000
              if (slotDate.getTime() >= startMs && slotDate.getTime() < endMs) selected = true
            }
            return (
              <div key={slotKey}
                onMouseDown={()=>handleMouseDown(slotKey)}
                onMouseUp={()=>handleMouseUp(slotKey)}
                onMouseEnter={()=>handleMouseEnter(slotKey)}
                onClick={()=> item ? (onOccurrenceClick && onOccurrenceClick(item.task_id, item.date)) : (onSlotClick && onSlotClick(slotKey))}
                style={{height:48, padding:6, borderBottom:'1px dashed rgba(255,255,255,0.02)', background: selected ? 'rgba(20,90,150,0.18)' : undefined}}>
                {item ? <div className="occ-item" style={{fontSize:12}}>{item.title}</div> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
