import React, { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import { updateTask, deleteTask, updateTaskInstance, deleteTaskOccurrence, getTaskOccurrence } from '../api'
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
  parts.push(`COUNT=${count || 5}`)
  return parts.join(';')
}

function snapToWeekday(d: Date, dayCode: string) {
  const targetIdx = WEEKDAY_CODES.indexOf(dayCode)
  if (targetIdx < 0) return new Date(d)
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (result.getDay() - targetIdx + 7) % 7
  result.setDate(result.getDate() - diff)
  return result
}

function primaryWeekday(days: string[]) {
  return [...days].sort((a, b) => WEEKDAY_CODES.indexOf(a) - WEEKDAY_CODES.indexOf(b))[0]
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export default function RecurringTaskModal({ open, onClose, onSaved, task, occurrence, occurrenceDate }: any) {
  const [title, setTitle] = useState(task?.title || '')
  const [date, setDate] = useState<Date | null>(task?.date ? isoToDate(task.date) : null)
  const [priority, setPriority] = useState(task?.priority || 'ROUTINE')
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('DAILY')
  const [repeatDays, setRepeatDays] = useState<string[]>([])
  const [repeatCount, setRepeatCount] = useState<number>(5)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [instanceSaving, setInstanceSaving] = useState(false)
  const [instanceDeletePrompt, setInstanceDeletePrompt] = useState(false)
  const [notice, setNotice] = useState<{type:'error'|'success', text:string} | null>(null)

  useEffect(() => {
    if (task) applyEditableData(occurrence || task)
  }, [task, occurrence])

  useEffect(() => {
    let cancelled = false
    async function loadOccurrence() {
      if (!task || !task.id || !occurrenceDate) return
      try {
        const latestOccurrence = await getTaskOccurrence(task.id, occurrenceDate, occurrence || task)
        if (!cancelled) applyEditableData(latestOccurrence)
      } catch (err) {
        console.warn('Failed to load occurrence override', err)
      }
    }
    loadOccurrence()
    return () => { cancelled = true }
  }, [task, occurrence, occurrenceDate])

  function hasField(source: any, key: string) {
    return source && Object.prototype.hasOwnProperty.call(source, key)
  }

  function applyEditableData(source: any) {
    if (!source || typeof source !== 'object') return
    const sourceDate = hasField(source, 'date') ? source.date : task?.date
    const taskDate = sourceDate ? isoToDate(sourceDate) : null
    setTitle(hasField(source, 'title') ? String(source.title ?? '') : '')
    setDate(taskDate)
    setPriority(source.priority || 'ROUTINE')

    const parsedRule = parseRecurrenceRule(source.series_recurrence_rule || task?.series_recurrence_rule || source.recurrence_rule || task?.recurrence_rule)
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

  function toggleRepeatDay(day: string) {
    setRepeatDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  if (!open) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    const payload: any = buildSavePayload()

    try {
      const res = await updateTask(task.id, payload)
      await onSaved?.(res)
      onClose()
    } catch (err) {
      setNotice({ type: 'error', text: 'Save failed' })
    } finally { setSaving(false) }
  }

  function buildSavePayload() {
    function dateToIsoLocal(d?: Date | null) {
      if (!d) return null
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    }

    if (repeatFrequency === 'DAILY') {
      return {
        title,
        date: task?.series_date || dateToIsoLocal(date),
        priority,
        timezone: browserTimezone(),
        is_recurring: true,
        recurrence_rule: buildRecurrenceRule(repeatFrequency, repeatCount, repeatDays),
      }
    }

    const seriesDate = task?.series_date ? isoToDate(task.series_date) : null
    const reference = seriesDate || date
    let anchor = reference
    if (repeatFrequency === 'WEEKLY' && repeatDays.length && reference) {
      anchor = snapToWeekday(reference, primaryWeekday(repeatDays))
      if (seriesDate) {
        anchor.setHours(seriesDate.getHours(), seriesDate.getMinutes(), seriesDate.getSeconds(), 0)
      }
    }

    const payload: any = {
      title,
      date: anchor ? anchor.toISOString() : (task?.series_date || dateToIsoLocal(date)),
      priority,
      timezone: browserTimezone(),
      is_recurring: true,
      recurrence_rule: buildRecurrenceRule(repeatFrequency, repeatCount, repeatDays),
    }
    return payload
  }

  function formatDateForOverride(d?: Date | null) {
    if (!d) return null
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
  }

  function occurrenceKey() {
    return occurrence?.original_occurrence_date || occurrence?.occurrence_date || occurrenceDate
  }

  async function saveInstance() {
    const key = occurrenceKey()
    if (!task || !task.id || !key) {
      setNotice({ type: 'error', text: 'This occurrence is missing task information.' })
      return
    }
    setInstanceSaving(true)
    setNotice(null)
    try {
      const payload: any = {
        override_data: {
          title,
          date: formatDateForOverride(date),
          priority,
          status: occurrence?.status || task?.status,
          is_recurring: true,
          recurrence_rule: buildRecurrenceRule(repeatFrequency, repeatCount, repeatDays),
        }
      }
      const res = await updateTaskInstance(task.id, key, payload)
      await onSaved?.(res)
      onClose()
    } catch (err) {
      setNotice({ type: 'error', text: 'Save occurrence failed' })
    } finally {
      setInstanceSaving(false)
    }
  }

  async function deleteInstance() {
    const key = occurrenceKey()
    if (!task || !task.id || !key) {
      setNotice({ type: 'error', text: 'This occurrence is missing task information.' })
      return
    }
    setInstanceSaving(true)
    setNotice(null)
    try {
      await deleteTaskOccurrence(task.id, key)
      await onSaved?.(null)
      onClose()
    } catch (err) {
      setNotice({ type: 'error', text: 'Delete occurrence failed' })
    } finally {
      setInstanceSaving(false)
      setInstanceDeletePrompt(false)
    }
  }

  function openTaskDeleteConfirm() {
    if (!task || !task.id) {
      setNotice({ type: 'error', text: 'Save task first to delete it.' })
      return
    }
    setConfirmOpen(true)
  }

  async function runConfirmedAction() {
    if (!task || !task.id) { setConfirmOpen(false); return }
    try {
      await deleteTask(task.id)
      await onSaved?.(null)
      onClose()
    } catch (err) {
      console.error(err)
      setNotice({ type: 'error', text: (err as any)?.message || 'Action failed' })
    } finally {
      setConfirmOpen(false)
    }
  }

  function openInstanceDeleteConfirm() {
    setInstanceDeletePrompt(true)
  }

  return (
    <div style={{position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(2,6,23,0.6)'}}>
      <div style={{width:540, background:'#071027', padding:18, borderRadius:12}}>
        <h3 style={{marginTop:0}}>Edit Recurring Task</h3>
        <div style={{marginBottom:12, color:'#94a3b8', fontSize:13}}>This task is recurring. Update the full series or just this occurrence.</div>
        {notice && (
          <div
            role="status"
            style={{marginBottom:12, color: notice.type === 'error' ? '#fecaca' : '#bbf7d0', fontSize:13}}
          >
            {notice.text}
          </div>
        )}
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
          <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap'}}>
            <select className="priority-select" value={repeatFrequency} onChange={e=>setRepeatFrequency(e.target.value as RepeatFrequency)}>
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
              min={2}
              placeholder="Occurrences"
              value={repeatCount}
              onChange={e => setRepeatCount(Math.max(2, parseInt(e.target.value, 10) || 2))}
              style={{width:140}}
            />
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap'}}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn secondary" onClick={saveInstance} disabled={instanceSaving}>
              {instanceSaving ? 'Saving occurrence...' : 'Save occurrence'}
            </button>
            <button type="button" className="btn danger" onClick={openInstanceDeleteConfirm} disabled={instanceSaving}>
              Delete occurrence
            </button>
            <button type="button" className="btn danger" onClick={openTaskDeleteConfirm}>
              Delete series
            </button>
            <button className="btn primary" type="submit">
              <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              {saving? 'Saving series...':'Save series'}
            </button>
          </div>
        </form>
      </div>
      {confirmOpen && (
        <ConfirmationDialog
          open={confirmOpen}
          title={'Delete series'}
          message={'This will permanently delete the entire recurring task series. Continue?'}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmOpen(false)}
          confirmLabel={'Delete series'}
        />
      )}
      {instanceDeletePrompt && (
        <ConfirmationDialog
          open={instanceDeletePrompt}
          title={'Delete occurrence'}
          message={'This will delete only this occurrence and leave the rest of the series intact. Continue?'}
          onConfirm={deleteInstance}
          onCancel={() => setInstanceDeletePrompt(false)}
          confirmLabel={'Delete occurrence'}
        />
      )}
    </div>
  )
}
