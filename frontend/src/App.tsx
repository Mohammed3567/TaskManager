import React, { useState, useEffect } from 'react'
import { getOccurrences, login, getTask, register, getMe } from './api'
import ErrorBoundary from './components/ErrorBoundary'
import { logClientError } from './components/clientLogging'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import TaskModal from './components/TaskModal'

function monthStartISO(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), 1)
  return new Date(s.getTime()).toISOString()
}

function monthEndISO(d: Date) {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  e.setHours(23,59,59,999)
  return new Date(e.getTime()).toISOString()
}

export default function App() {
  const [occ, setOcc] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any | null>(null)
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [monthDate, setMonthDate] = useState<Date>(new Date())
  const [view, setView] = useState<'month'|'week'|'day'>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [modalInitialDuration, setModalInitialDuration] = useState<number | null>(null)
  const [modalInitialEndDate, setModalInitialEndDate] = useState<string | null>(null)
  const [selectionRange, setSelectionRange] = useState<{start:string,end:string}|null>(null)

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await login(u, p)
      setUser(res)
    } catch (err) {
      alert('Login failed')
    }
  }

  async function loadForMonth(date: Date) {
    setLoading(true)
    try {
      const start = monthStartISO(date)
      const end = monthEndISO(date)
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
    if (user) loadForMonth(monthDate)
  }, [user, monthDate])

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

  function prevMonth() { setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  function openCreateFor(dateISO: string) {
    setModalDate(dateISO)
    setEditingTask(null)
    setModalOpen(true)
  }

  async function openEditFor(taskId: string, occurrenceISO: string) {
    try {
      const t = await getTask(taskId)
      setEditingTask(t)
      setModalDate(occurrenceISO)
      setModalOpen(true)
    } catch (err) {
      alert('Failed to load task')
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
    setModalInitialEndDate(endInclusive.toISOString())
    setEditingTask(null)
    setModalOpen(true)
    setSelectionRange({ start: s.toISOString(), end: endInclusive.toISOString() })
  }

  function handleSaved(res: any) {
    // refresh occurrences
    loadForMonth(monthDate)
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
        <div className="controls">
          <div className="small">Signed in as {user.username}</div>
        </div>
      </div>

      <div style={{marginTop:18}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div style={{display:'flex', gap:8}}>
              <button className="btn" onClick={()=>setView('month')}>Month</button>
              <button className="btn" onClick={()=>setView('week')}>Week</button>
              <button className="btn" onClick={()=>setView('day')}>Day</button>
              <button className="btn" onClick={prevMonth}>Prev</button>
              <button className="btn" onClick={nextMonth}>Next</button>
            </div>
            <div className="small">{monthDate.toLocaleString(undefined, {month:'long', year:'numeric'})}</div>
        </div>

        {view === 'month' && occ && (
          <div>
            <h3 style={{margin:0, marginBottom:8}}>Occurrences ({occ.length})</h3>
            <MonthView occurrences={occ} monthDate={monthDate} onDayClick={openCreateFor} />
          </div>
        )}
        {view === 'week' && <WeekView occurrences={occ} weekDate={monthDate} onSlotClick={openCreateFor} onOccurrenceClick={openEditFor} onRangeSelect={openRangeSelect} persistentSelection={selectionRange} />}
        {view === 'day' && <DayView occurrences={occ} dayDate={monthDate} onSlotClick={openCreateFor} onOccurrenceClick={openEditFor} onRangeSelect={openRangeSelect} persistentSelection={selectionRange} />}

        {!occ && <div className="card" style={{padding:18}}>Sign in and click Prev/Next to load occurrences for a month.</div>}
        {modalOpen && <TaskModal open={modalOpen} initialDate={modalDate} task={editingTask} occurrenceDate={editingTask ? modalDate : undefined} initialDurationMinutes={modalInitialDuration} initialEndDate={modalInitialEndDate} onClose={handleCloseModal} onSaved={handleSaved} />}
      </div>
      </>
      </ErrorBoundary>
         )}
    </div>
  )
}
