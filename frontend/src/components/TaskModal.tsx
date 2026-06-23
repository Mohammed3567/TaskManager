import React, { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import { createTask, updateTask, deleteTask } from '../api'
import ConfirmationDialog from './ConfirmationDialog'
import 'react-datepicker/dist/react-datepicker.css'

function isSameDate(a?: Date | null, b?: Date | null) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isoToDate(iso?: string | null) {
  if (!iso) return null
  const ymdMatch = typeof iso === 'string' && iso.match(/^\d{4}-\d{2}-\d{2}$/)
  if (ymdMatch) {
    const [y, m, day] = iso.split('-').map(n => parseInt(n, 10))
    return new Date(y, m - 1, day)
  }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d
}

// helper to convert ISO -> YYYY-MM-DD for date inputs

export default function TaskModal({ open, onClose, onSaved, initialDate, task, occurrenceDate, initialDurationMinutes }: any) {
  const [title, setTitle] = useState(task?.title || '')
  const [date, setDate] = useState<Date | null>(task?.date ? isoToDate(task.date) : (initialDate ? isoToDate(initialDate) : null))
  const [priority, setPriority] = useState(task?.priority || 'ROUTINE')
  const [tagNames, setTagNames] = useState((task && task.tags) ? task.tags.map((t: any)=>t.name).join(',') : '')
  const [durationMinutes, setDurationMinutes] = useState<number | null>(task?.duration_minutes ?? (initialDurationMinutes ?? null))
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDate(task.date ? isoToDate(task.date) : (initialDate ? isoToDate(initialDate) : null))
      setPriority(task.priority || 'ROUTINE')
      setDurationMinutes(task.duration_minutes ?? initialDurationMinutes ?? null)
    }
  }, [task, initialDate])

  useEffect(() => {
    if (!task) {
      if (initialDate) setDate(isoToDate(initialDate))
      if (initialDurationMinutes) setDurationMinutes(initialDurationMinutes)
    }
  }, [initialDate, initialDurationMinutes, task])

  if (!open) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    function dateToIsoLocal(d?: Date | null) {
      if (!d) return null
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    }

    const payload: any = {
      title,
      date: dateToIsoLocal(date),
      priority,
      tag_names: tagNames ? tagNames.split(',').map((s:string)=>s.trim()) : []
    }
    if (durationMinutes) payload.duration_minutes = durationMinutes
    try {
      let res
      if (task && task.id) {
        res = await updateTask(task.id, payload)
      } else {
        res = await createTask(payload)
      }
      onSaved && onSaved(res)
      onClose()
    } catch (err) {
      alert('Save failed')
    } finally { setSaving(false) }
  }

  function openTaskDeleteConfirm() {
    if (!task || !task.id) return alert('Save task first to delete it')
    setConfirmOpen(true)
  }

  async function runConfirmedAction() {
    if (!task || !task.id) { setConfirmOpen(false); return }
    try {
      await deleteTask(task.id)
      alert('Task deleted')
      onSaved && onSaved(null)
      onClose()
    } catch (err) {
      console.error(err)
      alert((err as any)?.message || 'Action failed')
    } finally {
      setConfirmOpen(false)
    }
  }

  return (
    <div style={{position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(2,6,23,0.6)'}}>
      <div style={{width:540, background:'#071027', padding:18, borderRadius:12}}>
        <h3 style={{marginTop:0}}>{task ? 'Edit Task' : 'New Task'}</h3>
        <form onSubmit={save}>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <input className="login-input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
            <DatePicker
              selected={date}
              onChange={(d: Date | null) => setDate(d)}
              dateFormat="yyyy-MM-dd"
              className="login-input"
              wrapperClassName="date-picker-wrapper"
              calendarClassName="react-datepicker-dark"
              dayClassName={(d:Date) => isSameDate(d, date) ? 'app-day-custom-selected' : ''}
            />
          </div>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <select className="priority-select" value={priority} onChange={e=>setPriority(e.target.value)}>
              <option value="ROUTINE">ROUTINE</option>
              <option value="IMPORTANT">IMPORTANT</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input className="login-input" placeholder="Tags (comma)" value={tagNames} onChange={e=>setTagNames(e.target.value)} />
            <input className="login-input" type="text" inputMode="numeric" placeholder="Duration (min)" value={durationMinutes ?? ''} onChange={(e)=>{const v=e.target.value.replace(/\D/g,''); setDurationMinutes(v ? parseInt(v,10) : null)}} />
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
            {/* simplified: removed recurring / RRULE UI to keep task creation simple */}
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap'}}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            {task && task.id ? (
              <button type="button" className="btn danger" onClick={openTaskDeleteConfirm}>
                Delete task
              </button>
            ) : null}
            <button className="btn primary" type="submit">
              <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              {saving? 'Saving...':'Save'}
            </button>
          </div>
        </form>
      </div>
      {confirmOpen && (
        <ConfirmationDialog
          open={confirmOpen}
          title={'Delete task'}
          message={'This will permanently delete the task. Continue?'}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmOpen(false)}
          confirmLabel={'Delete task'}
        />
      )}
    </div>
  )
}
