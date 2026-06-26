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
  parts.push(`COUNT=${Math.max(1, count || 1)}`)
  return parts.join(';')
}

function snapToWeekday(d: Date, dayCode: string) {
  const targetIdx = WEEKDAY_CODES.indexOf(dayCode) // equals JS getDay() value
  if (targetIdx < 0) return new Date(d)
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const currentDay = result.getDay()
  // Convert both days to Monday-based offsets (Mon=0 … Sun=6) so we can
  // compute a signed difference that may be negative (move earlier in the week).
  const currentMon = (currentDay + 6) % 7
  const targetMon  = (targetIdx  + 6) % 7
  const diff = targetMon - currentMon   // negative = move back, positive = move forward
  result.setDate(result.getDate() + diff)
  return result
}

// Returns the first date that falls on `dayCode` ON OR AFTER `startDate`.
// Always moves forward (never before startDate), making it safe to use as
// the series anchor when the user changes the weekday for "Save Series".
// This is intentionally separate from snapToWeekday (which does same-week
// movement and is used for single-occurrence date editing).
function firstWeekdayOnOrAfter(startDate: Date, dayCode: string): Date {
  const targetIdx = WEEKDAY_CODES.indexOf(dayCode) // equals JS getDay() value
  if (targetIdx < 0) return new Date(startDate)
  const result = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const currentDay = result.getDay()
  // (targetIdx - currentDay + 7) % 7 is 0 when already on the target day,
  // otherwise gives the positive number of days to advance.
  const diff = (targetIdx - currentDay + 7) % 7
  result.setDate(result.getDate() + diff)
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
  // Number of individually-deleted occurrences in this series.  Stored so
  // buildSavePayload can add it back to the display count (repeatCount) and
  // write the correct total COUNT into the recurrence rule — preventing
  // Save Series from truncating the series.
  const [deletedOccurrenceCount, setDeletedOccurrenceCount] = useState<number>(0)

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
    // Occurrences deleted individually via "Delete Occurrence" reduce the
    // effective count displayed to the user (COUNT - deleted).
    // We store deletedCount separately so buildSavePayload can add it back
    // and keep the actual series COUNT unchanged.
    const deletedCount = typeof source.deleted_occurrence_count === 'number'
      ? source.deleted_occurrence_count
      : 0
    setDeletedOccurrenceCount(deletedCount)
    if (parsedRule && parsedRule.freq) {
      const isWeekly = parsedRule.freq === 'WEEKLY'
      setRepeatFrequency(isWeekly ? 'WEEKLY' : 'DAILY')
      const rawCount = parsedRule.count ?? (isWeekly ? 4 : 5)
      setRepeatCount(Math.max(1, rawCount - deletedCount))
      if (isWeekly) {
        setRepeatDays(parsedRule.byDay.length ? parsedRule.byDay : taskDate ? [weekdayCode(taskDate)] : ['MO'])
      } else {
        setRepeatDays([])
      }
    } else {
      setRepeatFrequency('DAILY')
      setRepeatCount(Math.max(1, 5 - deletedCount))
      setRepeatDays(taskDate ? [weekdayCode(taskDate)] : ['MO'])
    }
  }

  function toggleRepeatDay(day: string) {
    setRepeatDays([day])
  }

  // When editing an existing weekly series the weekday must not change.
  // `task.id` being present means we are editing (not creating).
  const weekdayLocked = !!(task?.id) && repeatFrequency === 'WEEKLY'
  // Recurrence type (Daily / Weekly) cannot be changed once a series exists.
  const frequencyLocked = !!(task?.id)

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

    // repeatCount is the UI display value (rawCount - deletedOccurrenceCount).
    // Add deletedOccurrenceCount back so the rule always carries the full
    // series COUNT and Save Series never truncates the series.
    const seriesCount = repeatCount + deletedOccurrenceCount

    if (repeatFrequency === 'DAILY') {
      return {
        title,
        date: task?.series_date || dateToIsoLocal(date),
        priority,
        timezone: browserTimezone(),
        is_recurring: true,
        recurrence_rule: buildRecurrenceRule(repeatFrequency, seriesCount, repeatDays),
      }
    }

    const seriesDate = task?.series_date ? isoToDate(task.series_date) : null
    const reference = seriesDate || date
    let anchor = reference
    if (repeatFrequency === 'WEEKLY' && repeatDays.length && reference) {
      // Use firstWeekdayOnOrAfter so the anchor is never earlier than the
      // original series start date (reference).  snapToWeekday (same-week,
      // signed diff) is intentionally NOT used here because it can produce a
      // date before the series start (e.g. Friday→Monday moves back 4 days).
      anchor = firstWeekdayOnOrAfter(reference, primaryWeekday(repeatDays))
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
      recurrence_rule: buildRecurrenceRule(repeatFrequency, seriesCount, repeatDays),
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
              dateFormat="dd-MM-yyyy"
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
            <select
              className="priority-select"
              value={repeatFrequency}
              disabled={frequencyLocked}
              style={frequencyLocked ? { opacity: 0.3} : undefined}
              onChange={e => {
                const f = e.target.value as RepeatFrequency
                setRepeatFrequency(f)
                if (f === 'WEEKLY') setRepeatCount(4)
              }}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
            {repeatFrequency === 'WEEKLY' && (
              <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
                {WEEKDAY_CODES.map(day => {
                  const isSelected = repeatDays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`btn ${isSelected ? 'active' : ''}`}
                      onClick={() => { if (!weekdayLocked) toggleRepeatDay(day) }}
                      style={{
                        padding: '6px 10px',
                        minWidth: 40,
                        // When locked: selected day looks normal; others are dimmed and unclickable
                        ...(weekdayLocked && isSelected  ? { cursor: 'default' } : {}),
                        ...(weekdayLocked && !isSelected ? { opacity: 0.3, pointerEvents: 'none' as const } : {}),
                      }}
                      title={weekdayLocked ? 'Weekday is fixed for this series' : undefined}
                    >
                      {day}
                    </button>
                  )
                })}
                
              </div>
            )}
            <input
              className="login-input no-spinner"
              type="number"
              min={1}
              placeholder="Occurrences"
              value={repeatCount > 0 ? repeatCount : ''}
              onChange={e => {
                if (e.target.value === '') { setRepeatCount(0); return }
                const n = parseInt(e.target.value, 10)
                if (!isNaN(n)) setRepeatCount(n)
              }}
              style={{width:140, boxSizing:'border-box'}}
            />
          </div>
          {/* Outer div: right-aligns the whole group */}
          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, marginTop:8}}>
            {/*
              Inner wrapper shrinks to the grid's natural width (148×2 + 8 gap = 304 px)
              so that Cancel's width:100% matches the two buttons above it exactly.
            */}
            <div style={{display:'inline-flex', flexDirection:'column', gap:8}}>
              {/* 2×2 grid — 148 px per column fits "Delete occurrence" comfortably */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(2, 148px)', gap:8}}>
                <button type="button" className="btn primary" onClick={saveInstance} disabled={instanceSaving}>
                  {instanceSaving ? 'Saving occurrence...' : 'Save occurrence'}
                </button>
                <button type="button" className="btn danger" onClick={openInstanceDeleteConfirm} disabled={instanceSaving}>
                  Delete occurrence
                </button>
                <button className="btn primary" type="submit">
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  {saving ? 'Saving series...' : 'Save series'}
                </button>
                <button type="button" className="btn danger" onClick={openTaskDeleteConfirm}>
                  Delete series
                </button>
              </div>
              {/* Cancel spans the full width of the 2×2 grid above */}
              <button type="button" className="btn" onClick={onClose} style={{width:'100%'}}>Cancel</button>
            </div>
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
