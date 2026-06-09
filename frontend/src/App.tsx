import React, { useState, useEffect } from 'react'
import { getOccurrences, login, getTask, register, getMe, logout, updateTask, updateTaskInstance } from './api'
import ErrorBoundary from './components/ErrorBoundary'
import { logClientError } from './components/clientLogging'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import TaskModal from './components/TaskModal'

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
  const day = s.getDay()
  s.setDate(s.getDate() - day)
  s.setHours(0,0,0,0)
  return s.toISOString()
}

function weekEndISO(d: Date) {
  const e = new Date(weekStartISO(d))
  e.setDate(new Date(weekStartISO(d)).getDate() + 6)
  e.setHours(23,59,59,999)
  return e.toISOString()
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
  const [view, setView] = useState<'month'|'week'|'day'>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalOccurrenceDate, setModalOccurrenceDate] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [modalInitialDuration, setModalInitialDuration] = useState<number | null>(null)
  const [selectionRange, setSelectionRange] = useState<{start:string,end:string}|null>(null)
  const monthDate = viewDate

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
    setModalDate(dateISO)
    setModalOccurrenceDate(null)
    setEditingTask(null)
    setModalOpen(true)
  }

  async function openEditFor(taskId: string, occurrenceISO: string) {
    try {
      const t = await getTask(taskId)
      setEditingTask(t)
      setModalDate(occurrenceISO)
      setModalOccurrenceDate(t?.is_recurring ? occurrenceISO : null)
      setModalOpen(true)
    } catch (err) {
      alert('Failed to load task')
    }
  }

  async function toggleDone(taskId: string, occurrenceISO: string, isRecurring: boolean, done: boolean) {
    try {
      if (isRecurring) {
        await updateTaskInstance(taskId, occurrenceISO, { status: done ? 'DONE' : 'PENDING' })
      } else {
        await updateTask(taskId, { status: done ? 'DONE' : 'PENDING' })
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
    const [mode, setMode] = useState<'login'|'register'>('register')
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
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh'}}>
        <div style={{width:420, background:'#071027', padding:18, borderRadius:12}}>
          <h2 style={{marginTop:0}}>Welcome — Sign in or Register</h2>
          <div style={{display:'flex', gap:8, marginBottom:12}}>
            <button className={`btn ${mode==='register' ? 'primary' : ''}`} onClick={()=>setMode('register')}>Register</button>
            <button className={`btn ${mode==='login' ? 'primary' : ''}`} onClick={()=>setMode('login')}>Sign In</button>
          </div>
          <form onSubmit={mode==='register' ? doRegister : doLoginLocal}>
            <input className="login-input" placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} />
            {mode==='register' && <input className="login-input" placeholder="email (optional)" value={email} onChange={e=>setEmail(e.target.value)} />}
            <input className="login-input" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:8}}>
              <button className="btn" type="button" onClick={()=>{ setUsername(''); setPassword(''); setEmail('') }}>Clear</button>
              <button className="btn primary" type="submit">{loadingAuth? 'Please wait...' : (mode==='register' ? 'Register & Sign in' : 'Sign in')}</button>
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
        <div className="brand">TaskManager POC</div>
        <div className="controls" style={{display:'flex', alignItems:'center', gap:12}}>
          <div className="small">Signed in as {user.username}</div>
          <button className="btn" onClick={async ()=>{ await logout(); setUser(null) }}>Logout</button>
        </div>
      </div>

      <div style={{marginTop:18}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div style={{display:'flex', gap:8}}>
              <button className={`btn ${view==='month' ? 'active' : ''}`} onClick={()=>setView('month')}>Month</button>
              <button className={`btn ${view==='week' ? 'active' : ''}`} onClick={()=>setView('week')}>Week</button>
              <button className={`btn ${view==='day' ? 'active' : ''}`} onClick={()=>setView('day')}>Day</button>
              <button className="btn" onClick={prevMonth}>Prev</button>
              <button className="btn" onClick={nextMonth}>Next</button>
            </div>
            <div className="small">{viewDate.toLocaleString(undefined, view === 'month' ? {month:'long', year:'numeric'} : {weekday:'long', month:'short', day:'numeric'})}</div>
        </div>

        {view === 'month' && (
          <div>
            <h3 style={{margin:0, marginBottom:8}}>Occurrences ({occ?.length ?? 0})</h3>
            <MonthView
              occurrences={occ || []}
              monthDate={monthDate}
              onDayClick={openCreateFor}
              onOccurrenceClick={openEditFor}
              onToggleStatus={toggleDone}
            />
          </div>
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
            dayDate={monthDate.toISOString().slice(0,10)}
            onSlotClick={openCreateFor}
            onOccurrenceClick={openEditFor}
            onToggleStatus={toggleDone}
          />
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
