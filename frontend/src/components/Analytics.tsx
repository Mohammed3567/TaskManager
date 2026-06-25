import React, { useEffect, useState } from 'react'
import { getAnalytics } from '../api'

export default function Analytics({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const end = new Date().toISOString()
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    getAnalytics(start, end).then(d => setData(d)).catch(err => { console.error(err); setData(null) }).finally(() => setLoading(false))
  }, [refreshKey])

  if (loading) return <div className="card">Loading analytics...</div>
  if (!data) return <div className="card">No analytics available</div>

  return (
    <div className="card">
      <h3 style={{marginTop:0}}>Analytics (last 30 days)</h3>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12}}>
        <div style={{padding:12, borderRadius:8, background:'rgba(255,255,255,0.02)'}}>
          <div className="small">Total occurrences</div>
          <div style={{fontSize:20, fontWeight:700}}>{data.total_occurrences}</div>
        </div>
        <div style={{padding:12, borderRadius:8, background:'rgba(255,255,255,0.02)'}}>
          <div className="small">Completed</div>
          <div style={{fontSize:20, fontWeight:700}}>{data.completed_occurrences}</div>
        </div>
        <div style={{padding:12, borderRadius:8, background:'rgba(255,255,255,0.02)'}}>
          <div className="small">Completion %</div>
          <div style={{fontSize:20, fontWeight:700}}>{data.completion_rate_percent}%</div>
        </div>
      </div>

      <div style={{marginTop:12}}>
        <h4 style={{margin:0}}>By Priority</h4>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          {Object.entries(data.by_priority || {}).map(([k,v]) => (
            <div key={k} style={{padding:8, borderRadius:8, background:'rgba(255,255,255,0.02)'}}>
              <div className="small">{k}</div>
              <div style={{fontWeight:700}}>{String(v)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:12}}>
        <h4 style={{margin:0}}>Current streak</h4>
        <div style={{fontSize:20, fontWeight:700}}>{data.current_streak_days} days</div>
      </div>
    </div>
  )
}
