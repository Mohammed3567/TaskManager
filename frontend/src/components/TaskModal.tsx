import React, { useState, useEffect } from 'react'
import { createTask, updateTask, deleteTask, updateTaskInstance, deleteTaskOccurrence, getOccurrences } from '../api'
import ConfirmationDialog from './ConfirmationDialog'

function isoToLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n:number) => String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

function isoToLocalString(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString()
}

function relativeLabel(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.round((d.getTime() - Date.now()) / 1000)
  const abs = Math.abs(diff)
  if (abs < 60) return diff >= 0 ? 'in a few seconds' : 'a few seconds ago'
  const mins = Math.round(abs / 60)
  if (mins < 60) return diff >= 0 ? `in ${mins}m` : `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return diff >= 0 ? `in ${hours}h` : `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return diff >= 0 ? `in ${days}d` : `${days}d ago`
  const weeks = Math.round(days / 7)
  return diff >= 0 ? `in ${weeks}w` : `${weeks}w ago`
}

export default function TaskModal({ open, onClose, onSaved, initialDate, task, occurrenceDate, initialDurationMinutes }: any) {
  const [title, setTitle] = useState(task?.title || '')
  const [date, setDate] = useState(task?.date ? isoToLocalInput(task.date) : (initialDate ? isoToLocalInput(initialDate) : ''))
  const [priority, setPriority] = useState(task?.priority || 'ROUTINE')
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring || false)
  const [recurrenceRule, setRecurrenceRule] = useState(task?.recurrence_rule || '')
  const [tagNames, setTagNames] = useState((task && task.tags) ? task.tags.map((t: any)=>t.name).join(',') : '')
  const [durationMinutes, setDurationMinutes] = useState<number | null>(task?.duration_minutes ?? (initialDurationMinutes ?? null))
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmType, setConfirmType] = useState<'delete'|'override'|'delete_task'|null>(null)
  const [confirmOcc, setConfirmOcc] = useState<string | null>(null)
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [selectionOptions, setSelectionOptions] = useState<string[] | null>(null)
  const [selectionMode, setSelectionMode] = useState<'delete'|'override'|null>(null)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      const effectiveDate = occurrenceDate ?? task.date
      setDate(effectiveDate ? isoToLocalInput(effectiveDate) : (initialDate ? isoToLocalInput(initialDate) : ''))
      setPriority(task.priority || 'ROUTINE')
      setIsRecurring(!!task.is_recurring)
      setRecurrenceRule(task.recurrence_rule || '')
      setDurationMinutes(task.duration_minutes ?? initialDurationMinutes ?? null)
    }
  }, [task, initialDate, occurrenceDate])

  useEffect(() => {
    if (!task) {
      if (occurrenceDate) setDate(isoToLocalInput(occurrenceDate))
      else if (initialDate) setDate(isoToLocalInput(initialDate))
      if (initialDurationMinutes) setDurationMinutes(initialDurationMinutes)
    }
  }, [initialDate, initialDurationMinutes, task, occurrenceDate])

  if (!open) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const basePayload: any = {
      title,
      date: new Date(`${date}T00:00:00`).toISOString(),
      priority,
      tag_names: tagNames ? tagNames.split(',').map((s:string)=>s.trim()) : []
    }
    if (durationMinutes) basePayload.duration_minutes = durationMinutes
    if (isRecurring) { basePayload.is_recurring = true; basePayload.recurrence_rule = recurrenceRule }
    try {
      let res
      if (task && task.id) {
        if (occurrenceDate) {
          const payload = { override_data: basePayload }
          res = await updateTaskInstance(task.id, occurrenceDate, payload)
        } else {
          res = await updateTask(task.id, basePayload)
        }
      } else {
        res = await createTask(basePayload)
      }
      onSaved && onSaved(res)
      onClose()
    } catch (err) {
      alert('Save failed')
    } finally { setSaving(false) }
  }

  async function saveMaster(e: React.FormEvent) {
    e.preventDefault()
    if (!task || !task.id) return save(e)
    setSaving(true)
    const payload: any = {
      title,
      date: new Date(`${date}T00:00:00`).toISOString(),
      priority,
      tag_names: tagNames ? tagNames.split(',').map((s:string)=>s.trim()) : []
    }
    if (durationMinutes) payload.duration_minutes = durationMinutes
    if (isRecurring) { payload.is_recurring = true; payload.recurrence_rule = recurrenceRule }
    try {
      const res = await updateTask(task.id, payload)
      onSaved && onSaved(res)
      onClose()
    } catch (err) {
      alert('Save failed')
    } finally { setSaving(false) }
  }

  function openDeleteConfirm() {
    if (!task || !task.id) return alert('Save task first to add exception')
    if (!task.is_recurring) {
      openTaskDeleteConfirm()
      return
    }
    if (occurrenceDate) {
      setConfirmType('delete')
      setConfirmOcc(occurrenceDate)
      setConfirmOpen(true)
      return
    }
    // open selection modal for user to pick an occurrence
    setSelectionMode('delete')
    fetchTaskOccurrencesForSelection()
  }

  function openOverrideConfirm() {
    if (!task || !task.id) return alert('Save task first to add override')
    if (occurrenceDate) {
      setConfirmType('override')
      setConfirmOcc(occurrenceDate)
      setConfirmOpen(true)
      return
    }
    setSelectionMode('override')
    fetchTaskOccurrencesForSelection()
  }

  function openTaskDeleteConfirm() {
    if (!task || !task.id) return alert('Save task first to delete it')
    setConfirmType('delete_task')
    setConfirmOcc(null)
    setConfirmOpen(true)
  }

  async function fetchTaskOccurrencesForSelection() {
    if (!task || !task.id) return
    setSelectionLoading(true)
    try {
      // fetch a reasonable window of occurrences (past 30d to next 180d)
      const now = new Date()
      const start = new Date(now.getTime() - 30*24*60*60*1000).toISOString()
      const end = new Date(now.getTime() + 180*24*60*60*1000).toISOString()
      const occs = await getOccurrences(start, end)
      // filter to this task's occurrences
      const filtered = (occs || []).filter((o:any)=>o.task_id === String(task.id)).map((o:any)=>o.date)
      if (filtered.length === 0) {
        alert('No occurrences found in the next 180 days for this task')
        return
      }
      setSelectionOptions(filtered)
      setSelectionOpen(true)
    } catch (err) {
      console.error(err)
      alert('Failed to load occurrences for selection')
    } finally {
      setSelectionLoading(false)
    }
  }

  async function runConfirmedAction() {
    if (!task || !task.id || !confirmType || (confirmType === 'delete' && !confirmOcc)) { setConfirmOpen(false); return }
    try {
      if (confirmType === 'delete') {
        await deleteTaskOccurrence(task.id, confirmOcc!)
        alert('Occurrence deleted')
      } else if (confirmType === 'delete_task') {
        await deleteTask(task.id)
        alert('Task deleted')
      } else if (confirmType === 'override') {
        const override: any = { title, date: new Date(`${date}T00:00:00`).toISOString(), priority }
        if (durationMinutes) override.duration_minutes = durationMinutes
        await updateTaskInstance(task.id, confirmOcc!, override)
        alert('Occurrence override saved')
      }
      onSaved && onSaved(null)
      onClose()
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Action failed')
    } finally {
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
            <input className="login-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <select className="login-input" value={priority} onChange={e=>setPriority(e.target.value)}>
              <option value="CRITICAL">CRITICAL</option>
              <option value="IMPORTANT">IMPORTANT</option>
              <option value="ROUTINE">ROUTINE</option>
            </select>
            <input className="login-input" placeholder="Tags (comma)" value={tagNames} onChange={e=>setTagNames(e.target.value)} />
            <input className="login-input" type="number" placeholder="Duration (min)" value={durationMinutes ?? ''} onChange={e=>setDurationMinutes(e.target.value ? parseInt(e.target.value) : null)} />
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
            <label className="small"><input type="checkbox" checked={isRecurring} onChange={e=>setIsRecurring(e.target.checked)} /> Recurring</label>
            {isRecurring && (
              <div style={{flex:'1 1 100%'}}>
                <input className="login-input" placeholder="RRULE" value={recurrenceRule} onChange={e=>setRecurrenceRule(e.target.value)} />
                <div className="small" style={{marginTop:4, opacity:0.7}}>
                  Example: <code>FREQ=DAILY;COUNT=5</code> or <code>FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12</code>
                </div>
              </div>
            )}
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap'}}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            {task && task.id && !task.is_recurring ? (
              <button type="button" className="btn danger" onClick={openTaskDeleteConfirm}>
                Delete task
              </button>
            ) : null}
            {task && task.is_recurring ? (
              <button type="button" className="btn danger" onClick={openDeleteConfirm}>
                <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                Add delete exception
              </button>
            ) : null}
            {occurrenceDate && task && task.id ? (
              <>
                <button type="button" className="btn warn" onClick={openOverrideConfirm}>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 0-3 6.71"></path><polyline points="21 12 21 6 15 6"></polyline></svg>
                  Save as occurrence override
                </button>
                <button type="button" className="btn primary" onClick={(e:any)=>save(e)}>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {saving? 'Saving...':'Save occurrence'}
                </button>
                <button type="button" className="btn" onClick={saveMaster}>
                  Save series
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
          title={confirmType === 'delete' ? 'Delete occurrence' : (confirmType === 'delete_task' ? 'Delete task' : 'Save override')}
          message={confirmType === 'delete' ? 'This will create an exception and remove this occurrence. Continue?' : (confirmType === 'delete_task' ? 'This will permanently delete the task. Continue?' : 'This will save the changes only for this occurrence. Continue?')}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmOpen(false)}
          confirmLabel={confirmType === 'delete' ? 'Delete' : (confirmType === 'delete_task' ? 'Delete task' : 'Save override')}
        />
      )}
      {selectionOpen && (
        <div style={{position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(2,6,23,0.6)'}}>
          <div style={{width:520, background:'#071027', padding:18, borderRadius:12}}>
            <h4 style={{marginTop:0}}>Select occurrence</h4>
            {selectionLoading ? <div>Loading...</div> : (
              <div style={{maxHeight:300, overflow:'auto'}}>
                {selectionOptions && selectionOptions.map((d)=> (
                  <div key={d} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:8, borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                    <div>
                      <div style={{fontFamily:'monospace'}}>{isoToLocalString(d)}</div>
                      <div className="small" style={{opacity:0.8}}>{relativeLabel(d)}</div>
                    </div>
                    <div style={{display:'flex', gap:8}}>
                      <button className="btn" onClick={()=>{ setConfirmType(selectionMode); setConfirmOcc(d); setConfirmOpen(true); setSelectionOpen(false); }}>{'Select'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'flex', justifyContent:'flex-end', marginTop:12}}>
              <button className="btn" onClick={()=>{ setSelectionOpen(false); setSelectionOptions(null); setSelectionMode(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
