import React, { useState, useEffect } from 'react'
import { getOccurrences, login, getTask, register, getMe, logout, updateTask, updateTaskInstance, createTask, quickAdd } from './api'
import ErrorBoundary from './components/ErrorBoundary'
import { logClientError } from './components/clientLogging'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import TaskModal from './components/TaskModal'
import Analytics from './components/Analytics'
import FocusTimer from './components/FocusTimer'
import TemplatesSelect from './components/TemplatesSelect'

function monthStartISO(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), 1)
  s.setHours(0,0,0,0)
  return s.toISOString()
}

function monthEndISO(d: Date) {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  e.setHours(23,59,59,999)
  return e.toISOString()
}

function weekStartISO(d: Date) {
  const s = new Date(d)
  // Monday as start of week: offset where Monday=0
  const offset = (s.getDay() + 6) % 7
  s.setDate(s.getDate() - offset)
  s.setHours(0,0,0,0)
  return s.toISOString()
}

function weekEndISO(d: Date) {
  const s = new Date(weekStartISO(d))
  s.setDate(s.getDate() + 6)
  s.setHours(23,59,59,999)
  return s.toISOString()
}

function dayStartISO(d: Date) {
  const s = new Date(d)
  s.setHours(0,0,0,0)
  return s.toISOString()
}

function dayEndISO(d: Date) {
  const e = new Date(d)
  e.setHours(23,59,59,999)
  return e.toISOString()
}

export default function App() {
  const [occ, setOcc] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any | null>(null)
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [view, setView] = useState<'month'|'week'|'day'|'analytics'>('month')
  const [headerAnimate, setHeaderAnimate] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [showTimer, setShowTimer] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalOccurrenceDate, setModalOccurrenceDate] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [modalInitialDuration, setModalInitialDuration] = useState<number | null>(null)
  const [selectionRange, setSelectionRange] = useState<{start:string,end:string}|null>(null)
  const monthDate = viewDate
  function toYMDLocal(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await login(u, p)
      setUser(res)
    } catch (err) {
      alert('Login failed')
    }
  }

  async function loadOccurrences(date: Date, viewMode: 'month'|'week'|'day') {
    setLoading(true)
    try {
      let start: string
      let end: string
      if (viewMode === 'week') {
        start = weekStartISO(date)
        end = weekEndISO(date)
      } else if (viewMode === 'day') {
        start = dayStartISO(date)
        end = dayEndISO(date)
      } else {
        start = monthStartISO(date)
        end = monthEndISO(date)
      }
      const data = await getOccurrences(start, end)
      setOcc(data)
    } catch (e) {
      console.error(e)
      setOcc([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadOccurrences(viewDate, view)
  }, [user, viewDate, view])

  useEffect(() => {
    // check existing session on mount
    let mounted = true
    getMe().then((u:any)=>{ if (mounted && u) setUser(u) }).catch(()=>{})
    return ()=>{ mounted = false }
  }, [])

  useEffect(() => {
    // Animate header briefly when view or date changes
    setHeaderAnimate(true)
    const t = setTimeout(()=> setHeaderAnimate(false), 420)
    return () => clearTimeout(t)
  }, [viewDate, view])

  function headerTitleForView(viewMode: string, d: Date) {
    if (viewMode === 'month') return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    if (viewMode === 'week') {
      const s = new Date(weekStartISO(d))
      const e = new Date(weekEndISO(d))
      const sFmt = s.toLocaleDateString(undefined, { month:'short', day: 'numeric' })
      const eFmt = e.toLocaleDateString(undefined, { month:'short', day: 'numeric', year:'numeric' })
      return `${sFmt} — ${eFmt}`
    }
    if (viewMode === 'day') return d.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    if (viewMode === 'analytics') return 'Dashboard'
    return ''
  }

  // global react error boundary logging hook
  useEffect(()=>{
    const onError = (e:any) => logClientError('window error', e)
    window.addEventListener('error', onError)
    return ()=> window.removeEventListener('error', onError)
  }, [])

  function prevMonth() {
    setViewDate(d => {
      const next = new Date(d)
      if (view === 'month') next.setMonth(next.getMonth() - 1)
      else if (view === 'week') next.setDate(next.getDate() - 7)
      else next.setDate(next.getDate() - 1)
      return next
    })
  }

  function nextMonth() {
    setViewDate(d => {
      const next = new Date(d)
      if (view === 'month') next.setMonth(next.getMonth() + 1)
      else if (view === 'week') next.setDate(next.getDate() + 7)
      else next.setDate(next.getDate() + 1)
      return next
    })
  }

  function openCreateFor(dateISO: string) {
    // set the calendar view date to the clicked date so Day view will reflect newly created tasks
    const parsed = parseIsoOrYmd(dateISO)
    setViewDate(parsed)
    setModalDate(dateISO)
    setModalOccurrenceDate(null)
    setEditingTask(null)
    setModalOpen(true)
  }

  async function openEditFor(taskId: string, occurrenceISO: string) {
    try {
      const t = await getTask(taskId)
      setEditingTask(t)
      // ensure the view date matches the occurrence being edited
      const parsed = parseIsoOrYmd(occurrenceISO)
      setViewDate(parsed)
      setModalDate(occurrenceISO)
      setModalOccurrenceDate(t?.is_recurring ? occurrenceISO : null)
      setModalOpen(true)
    } catch (err) {
      alert('Failed to load task')
    }
  }

  function parseIsoOrYmd(s?: string | null) {
    if (!s) return new Date()
    // if it's plain YYYY-MM-DD, construct local date to avoid cross-browser parsing differences
    const ymd = /^\d{4}-\d{2}-\d{2}$/.test(s)
    if (ymd) {
      const [y, m, d] = s.split('-').map(n => parseInt(n, 10))
      return new Date(y, m - 1, d)
    }
    const dt = new Date(s)
    if (!isNaN(dt.getTime())) return dt
    // fallback: try treating as local date
    try { const parts = s.split('T')[0].split('-'); return new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10)) } catch { return new Date() }
  }

  async function toggleDone(taskId: string, occurrenceISO: string, isRecurring: boolean, done: boolean) {
    try {
      if (isRecurring) {
        await updateTaskInstance(taskId, occurrenceISO, { status: done ? 'COMPLETED' : 'PENDING' })
      } else {
        await updateTask(taskId, { status: done ? 'COMPLETED' : 'PENDING' })
      }
      loadOccurrences(viewDate, view)
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Failed to update task status')
    }
  }

  function openRangeSelect(startIso: string, endIso: string) {
    const s = new Date(startIso)
    const e = new Date(endIso)
    // make selection inclusive of end slot by adding 1 hour
    const endInclusive = new Date(e.getTime() + 60*60*1000)
    const durationMs = Math.abs(endInclusive.getTime() - s.getTime())
    const durationMin = Math.max(15, Math.round(durationMs / 60000))
    setModalDate(s.toISOString())
    setModalInitialDuration(durationMin)
    setEditingTask(null)
    setModalOpen(true)
    setSelectionRange({ start: s.toISOString(), end: endInclusive.toISOString() })
  }

  function handleSaved(res: any) {
    // refresh occurrences for current view range
    loadOccurrences(viewDate, view)
    setSelectionRange(null)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setSelectionRange(null)
  }

  function AuthPage({ onAuth }: any) {
    const [mode, setMode] = useState<'login'|'register'>('login')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [email, setEmail] = useState('')
    const [loadingAuth, setLoadingAuth] = useState(false)

    async function doRegister(e?: React.FormEvent) {
      e && e.preventDefault()
      setLoadingAuth(true)
      try {
        await register(username, password, email)
        // auto-login after register
        const u = await login(username, password)
        onAuth(u)
      } catch (err: any) {
        alert(err?.message || 'Register failed')
      } finally { setLoadingAuth(false) }
    }

    async function doLoginLocal(e?: React.FormEvent) {
      e && e.preventDefault()
      setLoadingAuth(true)
      try {
        const u = await login(username, password)
        onAuth(u)
      } catch (err: any) {
        alert(err?.message || 'Login failed')
      } finally { setLoadingAuth(false) }
    }

    return (
      <div className="auth-overlay">
        <div className="auth-card" role="dialog" aria-modal="true">
          <h2 style={{marginTop:0}}>Welcome to Task Manager</h2>
          <div style={{display:'flex', gap:8, marginBottom:14}}>
            <button className={`btn ${mode==='login' ? 'primary' : ''}`} onClick={()=>setMode('login')}>Sign In</button>
            <button className={`btn ${mode==='register' ? 'primary' : ''}`} onClick={()=>setMode('register')}>Register</button>
          </div>
          <form onSubmit={mode==='register' ? doRegister : doLoginLocal}>
            <input className="login-input" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
            {mode==='register' && <input className="login-input" placeholder="Email (optional)" value={email} onChange={e=>setEmail(e.target.value)} />}
            <input className="login-input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
              <button className="btn" type="button" onClick={()=>{ setUsername(''); setPassword(''); setEmail('') }}>Clear</button>
              <button className="btn primary" type="submit">{loadingAuth? 'Please wait...' : (mode==='register' ? 'Register' : 'Sign In')}</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {!user ? (
        <AuthPage onAuth={(u:any)=>setUser(u)} />
      ) : (
      <ErrorBoundary>
      <>
      <div className="header">
        <div className="brand">Task Manager</div>
        <div className="controls" style={{display:'flex', alignItems:'center', gap:12}}>
          <div className="small">Signed in as {user.username}</div>
          <button className={`btn logout-btn ${loggingOut ? 'loggingOut' : ''}`} onClick={async ()=>{ setLoggingOut(true); try { await logout(); setUser(null) } catch (e:any) { setLoggingOut(false); alert('Logout failed') } }}>Logout</button>
        </div>
      </div>

      <div style={{marginTop:18}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div style={{display:'flex', gap:8}}>
                <button className={`btn ${view==='month' ? 'active' : ''}`} onClick={()=>setView('month')}>Month</button>
                <button className={`btn ${view==='week' ? 'active' : ''}`} onClick={()=>setView('week')}>Week</button>
                <button className={`btn ${view==='day' ? 'active' : ''}`} onClick={()=>setView('day')}>Day</button>
                <button className={`btn ${view==='analytics' ? 'active' : ''}`} onClick={()=>setView('analytics')}>Dashboard</button>
              <button className="btn" onClick={prevMonth}>Prev</button>
              <button className="btn" onClick={nextMonth}>Next</button>
            </div>
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <input className="login-input" placeholder="Quick Add (e.g. 'Meeting tomorrow at 9am')" value={quickText} onChange={e=>setQuickText(e.target.value)} style={{width:320}} />
                <button className="btn" onClick={async ()=>{ if (!quickText) return alert('Enter text'); try { const res = await quickAdd(quickText); setQuickText(''); handleSaved(res); alert('Added'); } catch (err:any) { alert(err?.message || 'Quick add failed') } }}>Quick Add</button>
                <TemplatesSelect onApply={async (payload:any) => { try { await createTask(payload); loadOccurrences(viewDate, view); alert('Template created') } catch (err) { console.error(err); alert('Template failed') } }} />
                <button className="btn" onClick={()=>setShowTimer(s=>!s)}>{showTimer? 'Hide Timer':'Focus Timer'}</button>
              </div>
        </div>

              {showTimer && <FocusTimer onClose={() => setShowTimer(false)} />}
        {(view === 'month' || view === 'week' || view === 'day') && (
          <div className="top-left-header">
            <div className={`date-header ${headerAnimate ? 'animate' : ''}`} aria-live="polite" aria-atomic="true">{headerTitleForView(view, viewDate)}</div>
            <div className="occurrences-count">Occurrences ({occ?.length ?? 0})</div>
          </div>
        )}
        {view === 'month' && (
          <MonthView
            occurrences={occ || []}
            monthDate={monthDate}
            onDayClick={openCreateFor}
            onOccurrenceClick={openEditFor}
            onToggleStatus={toggleDone}
          />
        )}
        {view === 'week' && (
          <WeekView
            occurrences={occ || []}
            weekDate={monthDate}
            onSlotClick={openCreateFor}
            onOccurrenceClick={openEditFor}
            onToggleStatus={toggleDone}
          />
        )}
        {view === 'day' && (
          <DayView
            occurrences={occ || []}
            dayDate={toYMDLocal(monthDate)}
            onSlotClick={openCreateFor}
            onOccurrenceClick={openEditFor}
            onToggleStatus={toggleDone}
          />
        )}
        {view === 'analytics' && (
          <Analytics />
        )}

        {!occ && <div className="card" style={{padding:18}}>Sign in and click Prev/Next to load occurrences for a month.</div>}
        {modalOpen && <TaskModal open={modalOpen} initialDate={modalDate} task={editingTask} occurrenceDate={modalOccurrenceDate ?? undefined} initialDurationMinutes={modalInitialDuration} onClose={handleCloseModal} onSaved={handleSaved} />}
      </div>
      </>
      </ErrorBoundary>
         )}
    </div>
  )
}
