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

const WEEKDAY_CODES = ['SU','MO','TU','WE','TH','FR','SA']
type RepeatFrequency = 'DAILY'|'WEEKLY'

function weekdayCode(d: Date) {
  return WEEKDAY_CODES[d.getDay()]
}

function parseRecurrenceRule(rule?: string) {
  if (!rule) return null
  const parts = rule.split(';').reduce((acc, raw) => {
    const [key, value] = raw.split('=')
    if (key && value) acc[key] = value
    return acc
  }, {} as Record<string, string>)
  return {
    freq: parts.FREQ,
    count: parts.COUNT ? parseInt(parts.COUNT, 10) : undefined,
    byDay: parts.BYDAY ? parts.BYDAY.split(',').filter(Boolean) : []
  }
}

function buildRecurrenceRule(freq: string, count: number, days: string[]) {
  const parts = [`FREQ=${freq}`]
  if (freq === 'WEEKLY' && days.length) {
    parts.push(`BYDAY=${days.join(',')}`)
  }
  parts.push(`COUNT=${Math.max(1, count || 1)}`)
  return parts.join(';')
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

// helper to convert ISO -> YYYY-MM-DD for date inputs

export default function TaskModal({ open, onClose, onSaved, initialDate, task }: any) {
  const [title, setTitle] = useState(task?.title || '')
  const [date, setDate] = useState<Date | null>(task?.date ? isoToDate(task.date) : (initialDate ? isoToDate(initialDate) : null))
  const [priority, setPriority] = useState(task?.priority || 'ROUTINE')
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? false)
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('DAILY')
  const [repeatDays, setRepeatDays] = useState<string[]>([])
  const [repeatCount, setRepeatCount] = useState<number>(5)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (task) {
      const taskDate = task.date ? isoToDate(task.date) : (initialDate ? isoToDate(initialDate) : null)
      setTitle(task.title || '')
      setDate(taskDate)
      setPriority(task.priority || 'ROUTINE')
      setIsRecurring(!!task.is_recurring)
      const parsedRule = parseRecurrenceRule(task.recurrence_rule)
      if (parsedRule && parsedRule.freq) {
        setRepeatFrequency(parsedRule.freq === 'WEEKLY' ? 'WEEKLY' : 'DAILY')
        setRepeatCount(parsedRule.count ?? 5)
        if (parsedRule.freq === 'WEEKLY') {
          setRepeatDays(parsedRule.byDay.length ? parsedRule.byDay : taskDate ? [weekdayCode(taskDate)] : ['MO'])
        } else {
          setRepeatDays([])
        }
      } else {
        setRepeatFrequency('DAILY')
        setRepeatCount(5)
        setRepeatDays(taskDate ? [weekdayCode(taskDate)] : ['MO'])
      }
    }
  }, [task, initialDate])

  useEffect(() => {
    if (!task) {
      const initial = isoToDate(initialDate) ?? new Date()
      setDate(initial)
      setIsRecurring(false)
      setRepeatFrequency('DAILY')
      setRepeatDays([weekdayCode(initial)])
      setRepeatCount(5)
    }
  }, [initialDate, task])

  useEffect(() => {
    if (isRecurring && repeatFrequency === 'WEEKLY' && repeatDays.length === 0 && date) {
      setRepeatDays([weekdayCode(date)])
    }
  }, [isRecurring, repeatFrequency, repeatDays.length, date])

  function toggleRepeatDay(day: string) {
    setRepeatDays([day])
  }

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
      timezone: browserTimezone()
    }
    if (isRecurring) {
      payload.is_recurring = true
      payload.recurrence_rule = buildRecurrenceRule(repeatFrequency, repeatCount, repeatDays)
    } else {
      payload.is_recurring = false
      payload.recurrence_rule = null
    }
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
      console.error(err)
    } finally { setSaving(false) }
  }

  function openTaskDeleteConfirm() {
    if (!task || !task.id) return
    setConfirmOpen(true)
  }

  async function runConfirmedAction() {
    if (!task || !task.id) { setConfirmOpen(false); return }
    try {
      await deleteTask(task.id)
      onSaved && onSaved(null)
      onClose()
    } catch (err) {
      console.error(err)
      console.error(err)
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
          </div>
          {!task && (
            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
              <label style={{display:'flex', alignItems:'center', gap:8, color:'inherit'}}>
                <input type="checkbox" checked={isRecurring} onChange={e=>setIsRecurring(e.target.checked)} />
                Repeating
              </label>
              {isRecurring && (
                <>
                  <select className="priority-select" value={repeatFrequency} onChange={e => {
                    const f = e.target.value as RepeatFrequency
                    setRepeatFrequency(f)
                    if (f === 'WEEKLY') setRepeatCount(4)
                  }}>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                  {repeatFrequency === 'WEEKLY' && (
                    <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                      {WEEKDAY_CODES.map(day => (
                        <button key={day} type="button" className={`btn ${repeatDays.includes(day) ? 'active' : ''}`} onClick={() => toggleRepeatDay(day)} style={{padding:'6px 10px', minWidth:40}}>
                          {day}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    className="login-input"
                    type="number"
                    min={1}
                    placeholder="Occurrences"
                    value={repeatCount > 0 ? repeatCount : ''}
                    onChange={e => {
                      if (e.target.value === '') { setRepeatCount(0); return }
                      const n = parseInt(e.target.value, 10)
                      if (!isNaN(n)) setRepeatCount(n)
                    }}
                    style={{width:140}}
                  />
                </>
              )}
            </div>
          )}
          {!task && isRecurring && <div style={{color:'#94a3b8', fontSize:12, marginBottom:8}}>This task will repeat automatically based on the selected schedule.</div>}
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
