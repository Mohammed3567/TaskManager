import React, { useEffect, useState } from 'react'
import { getAnalytics } from '../api'
import { getOccurrences } from '../api'

export default function Analytics({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<any | null>(null)
  const [todayTasks, setTodayTasks] = useState<any[]>([])
  const [weekTasks, setWeekTasks] = useState<any[]>([])
  const [monthTasks, setMonthTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
  async function loadAnalytics() {
    try {
      setLoading(true)

      const end = new Date().toISOString()
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const analytics = await getAnalytics(start, end)
      setData(analytics)

      const today = new Date()

      const startToday = new Date(today)
      startToday.setHours(0, 0, 0, 0)

      const endToday = new Date(today)
      endToday.setHours(23, 59, 59, 999)

      const occ = await getOccurrences(
        startToday.toISOString(),
        endToday.toISOString()
      )

      setTodayTasks(occ)
      const weekStart = new Date(today)
weekStart.setDate(today.getDate() - today.getDay() + 1)
weekStart.setHours(0,0,0,0)

const weekEnd = new Date(weekStart)
weekEnd.setDate(weekStart.getDate() + 6)
weekEnd.setHours(23,59,59,999)

const weekOcc = await getOccurrences(
  weekStart.toISOString(),
  weekEnd.toISOString()
)

setWeekTasks(weekOcc)

const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
monthStart.setHours(0,0,0,0)

const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
monthEnd.setHours(23,59,59,999)

const monthOcc = await getOccurrences(
  monthStart.toISOString(),
  monthEnd.toISOString()
)

setMonthTasks(monthOcc)
    } catch (err) {
      console.error(err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  loadAnalytics()
  }, [refreshKey])

  if (loading) return <div className="card">Loading analytics...</div>
  if (!data) return <div className="card">No analytics available</div>

  const todayCompleted = todayTasks.filter(t => t.status === "COMPLETED").length
  const todayRemaining = todayTasks.length - todayCompleted
  const todayPercent = todayTasks.length ? Math.round(todayCompleted / todayTasks.length * 100) : 0

  const weekCompleted = weekTasks.filter(t => t.status === "COMPLETED").length
  const weekRemaining = weekTasks.length - weekCompleted
  const weekPercent = weekTasks.length ? Math.round(weekCompleted / weekTasks.length * 100) : 0

  const monthCompleted = monthTasks.filter(t => t.status === "COMPLETED").length
  const monthRemaining = monthTasks.length - monthCompleted
  const monthPercent = monthTasks.length ? Math.round(monthCompleted / monthTasks.length * 100) : 0

  return (
    <div className="card">
      <h2 style={{marginTop:0}}>Analytics</h2>
      <h3 style={{margin:'18px 0 14px'}}>Today's Focus</h3>

<div className="today-focus">

  <div className="priority-group critical">
    <h4>Critical</h4>

    {todayTasks.filter(t => t.priority === "CRITICAL").length === 0
  ? <div>No tasks</div>
  : todayTasks
      .filter(t => t.priority === "CRITICAL")
      .map(t => (
        <div key={t.task_id}>{t.title}</div>
      ))
    }
  </div>

  <div className="priority-group important">
    <h4>Important</h4>

    {todayTasks.filter(t => t.priority === "IMPORTANT").length === 0
  ? <div>No tasks</div>
  : todayTasks
      .filter(t => t.priority === "IMPORTANT")
      .map(t => (
        <div key={t.task_id}>{t.title}</div>
      ))
}
  </div>

  <div className="priority-group routine">
    <h4>Routine</h4>

    {todayTasks.filter(t => t.priority === "ROUTINE").length === 0
  ? <div>No tasks</div>
  : todayTasks
      .filter(t => t.priority === "ROUTINE")
      .map(t => (
        <div key={t.task_id}>{t.title}</div>
      ))
}
  </div>


  </div>

    <h3 style={{margin:'22px 0 14px'}}>Today's Progress</h3>

<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Completed Today</div>
<div style={{fontSize:26,fontWeight:700}}>{todayCompleted}</div>

<div className="progress-bar">
<div className="progress-fill" style={{width:`${todayPercent}%`}} />
</div>

<div className="small">{todayPercent}% Complete</div>
</div>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Remaining Today</div>
<div style={{fontSize:26,fontWeight:700}}>{todayRemaining}</div>
</div>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Today's Tasks</div>
<div style={{fontSize:26,fontWeight:700}}>{todayTasks.length}</div>
</div>

</div>

    <h3 style={{margin:'22px 0 14px'}}>This Week</h3>

<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Completed This Week</div>
<div style={{fontSize:26,fontWeight:700}}>{weekCompleted}</div>

<div className="progress-bar">
<div className="progress-fill" style={{width:`${weekPercent}%`}} />
</div>

<div className="small">{weekPercent}% Complete</div>
</div>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Remaining This Week</div>
<div style={{fontSize:26,fontWeight:700}}>{weekRemaining}</div>
</div>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Week Tasks</div>
<div style={{fontSize:26,fontWeight:700}}>{weekTasks.length}</div>
</div>

</div>

    <h3 style={{margin:'22px 0 14px'}}>This Month</h3>

<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Completed This Month</div>
<div style={{fontSize:26,fontWeight:700}}>{monthCompleted}</div>

<div className="progress-bar">
<div className="progress-fill" style={{width:`${monthPercent}%`}} />
</div>

<div className="small">{monthPercent}% Complete</div>
</div>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Remaining This Month</div>
<div style={{fontSize:26,fontWeight:700}}>{monthRemaining}</div>
</div>

<div style={{background:'rgba(255,255,255,.03)',padding:16,borderRadius:12}}>
<div className="small">Month Tasks</div>
<div style={{fontSize:26,fontWeight:700}}>{monthTasks.length}</div>
</div>

</div>

      <div style={{marginTop:24,padding:16,borderRadius:12,background:'rgba(255,255,255,.03)'}}>

        <h4 style={{margin:0}}>Current streak</h4>
        <div style={{fontSize:20, fontWeight:700,color:'#8b5cf6'}}>{data.current_streak_days} days</div>
      </div>
    </div>
  )
}
