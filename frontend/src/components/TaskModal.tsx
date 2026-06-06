import React, { useState, useEffect } from 'react'
import { createTask, updateTask, createException } from '../api'
import ConfirmationDialog from './ConfirmationDialog'

function isoToLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n:number) => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TaskModal({ open, onClose, onSaved, initialDate, task, occurrenceDate, initialDurationMinutes, initialEndDate }: any) {
  const [title, setTitle] = useState(task?.title || '')
  const [date, setDate] = useState(task?.date ? isoToLocalInput(task.date) : (initialDate ? isoToLocalInput(initialDate) : ''))
  const [priority, setPriority] = useState(task?.priority || 'ROUTINE')
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring || false)
  const [recurrenceRule, setRecurrenceRule] = useState(task?.recurrence_rule || '')
  const [tagNames, setTagNames] = useState((task && task.tags) ? task.tags.map((t: any)=>t.name).join(',') : '')
  const [durationMinutes, setDurationMinutes] = useState<number | null>(task?.duration_minutes ?? (initialDurationMinutes ?? null))
  const [endDate, setEndDate] = useState<string | null>(task?.end_date ?? (initialEndDate ?? null))
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmType, setConfirmType] = useState<'delete'|'override'|null>(null)
  const [confirmOcc, setConfirmOcc] = useState<string | null>(null)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDate(task.date ? isoToLocalInput(task.date) : (initialDate ? isoToLocalInput(initialDate) : ''))
      setPriority(task.priority || 'ROUTINE')
      setIsRecurring(!!task.is_recurring)
      setRecurrenceRule(task.recurrence_rule || '')
      setDurationMinutes(task.duration_minutes ?? initialDurationMinutes ?? null)
      setEndDate(task.end_date ?? initialEndDate ?? null)
    }
  }, [task, initialDate])

  useEffect(() => {
    if (!task) {
      if (initialDate) setDate(isoToLocalInput(initialDate))
      if (initialDurationMinutes) setDurationMinutes(initialDurationMinutes)
      if (initialEndDate) setEndDate(initialEndDate)
    }
  }, [initialDate, initialDurationMinutes, initialEndDate, task])

  if (!open) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload: any = {
      title,
      date: new Date(date).toISOString(),
      priority,
      tag_names: tagNames ? tagNames.split(',').map((s:string)=>s.trim()) : []
    }
    if (durationMinutes) payload.duration_minutes = durationMinutes
    if (endDate) payload.end_date = endDate
    if (isRecurring) { payload.is_recurring = true; payload.recurrence_rule = recurrenceRule }
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

  function openDeleteConfirm() {
    if (!task || !task.id) return alert('Save task first to add exception')
    const occ = occurrenceDate || prompt('Occurrence ISO datetime (example: 2026-06-08T00:00:00+00:00)')
    if (!occ) return
    setConfirmType('delete')
    setConfirmOcc(occ)
    setConfirmOpen(true)
  }

  function openOverrideConfirm() {
    if (!task || !task.id) return alert('Save task first to add override')
    const occ = occurrenceDate || prompt('Occurrence ISO datetime for override')
    if (!occ) return
    setConfirmType('override')
    setConfirmOcc(occ)
    setConfirmOpen(true)
  }

  async function runConfirmedAction() {
    if (!task || !task.id || !confirmType || !confirmOcc) { setConfirmOpen(false); return }
    try {
      if (confirmType === 'delete') {
        await createException({ task: task.id, occurrence_date: confirmOcc, is_deleted: true })
        alert('Exception created')
      } else if (confirmType === 'override') {
        const override: any = { title, date: new Date(date).toISOString(), priority }
        if (durationMinutes) override.duration_minutes = durationMinutes
        if (endDate) override.end_date = endDate
        await createException({ task: task.id, occurrence_date: confirmOcc, is_deleted: false, override_data: override })
        alert('Override created')
      }
      onSaved && onSaved(null)
      onClose()
    } catch (err) { alert('Action failed') } finally {
      setConfirmOpen(false)
      setConfirmType(null)
      setConfirmOcc(null)
    }
  }

  return (
    <div style={{position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(2,6,23,0.6)'}}>
      <div style={{width:540, background:'#071027', padding:18, borderRadius:12}}>
        <h3 style={{marginTop:0}}>{occurrenceDate ? 'Edit Occurrence' : (task ? 'Edit Task' : 'New Task')}</h3>
        {occurrenceDate ? <div style={{background:'rgba(255,255,255,0.03)', padding:6, borderRadius:6, marginBottom:8}}>Editing occurrence: <span style={{fontFamily:'monospace'}}>{occurrenceDate}</span></div> : null}
        <form onSubmit={save}>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <input className="login-input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
            <input className="login-input" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <select className="login-input" value={priority} onChange={e=>setPriority(e.target.value)}>
              <option value="CRITICAL">CRITICAL</option>
              <option value="IMPORTANT">IMPORTANT</option>
              <option value="ROUTINE">ROUTINE</option>
            </select>
            <input className="login-input" placeholder="Tags (comma)" value={tagNames} onChange={e=>setTagNames(e.target.value)} />
            <input className="login-input" type="number" placeholder="Duration (min)" value={durationMinutes ?? ''} onChange={e=>setDurationMinutes(e.target.value ? parseInt(e.target.value) : null)} />
            <input className="login-input" type="datetime-local" placeholder="End" value={endDate ? isoToLocalInput(endDate) : ''} onChange={e=>setEndDate(e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
            <label className="small"><input type="checkbox" checked={isRecurring} onChange={e=>setIsRecurring(e.target.checked)} /> Recurring</label>
            {isRecurring && <input className="login-input" placeholder="RRULE" value={recurrenceRule} onChange={e=>setRecurrenceRule(e.target.value)} />}
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn danger" onClick={openDeleteConfirm}>
              <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
              Add delete exception
            </button>
            {occurrenceDate && task && task.id ? (
              <>
                <button type="button" className="btn warn" onClick={openOverrideConfirm}>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 0-3 6.71"></path><polyline points="21 12 21 6 15 6"></polyline></svg>
                  Save as occurrence override
                </button>
                <button type="button" className="btn primary" onClick={(e:any)=>save(e)}>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {saving? 'Saving...':'Save master'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn warn" onClick={openOverrideConfirm}>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 0-3 6.71"></path><polyline points="21 12 21 6 15 6"></polyline></svg>
                  Save override for occurrence
                </button>
                <button className="btn primary" type="submit">
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  {saving? 'Saving...':'Save'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
      {confirmOpen && (
        <ConfirmationDialog
          open={confirmOpen}
          title={confirmType === 'delete' ? 'Delete occurrence' : 'Save override'}
          message={confirmType === 'delete' ? 'This will create an exception and remove this occurrence. Continue?' : 'This will save the changes only for this occurrence. Continue?'}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmOpen(false)}
          confirmLabel={confirmType === 'delete' ? 'Delete' : 'Save override'}
        />
      )}
    </div>
  )
}
