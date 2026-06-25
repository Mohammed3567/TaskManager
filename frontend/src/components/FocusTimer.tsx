import React, { useEffect, useRef, useState } from 'react'

type Props = {
  defaultMinutes?: number
  defaultSeconds?: number
  onClose?: () => void
  onHide?: () => void
  hidden?: boolean
}

export default function FocusTimer({
  defaultMinutes = 25,
  defaultSeconds = 0,
  onClose,
  hidden = false,
  onHide
}: Props) {
  const [minutes, setMinutes] = useState(defaultMinutes)
  const [seconds, setSeconds] = useState(defaultSeconds)
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(defaultMinutes * 60 + defaultSeconds)
  const [total, setTotal] = useState(defaultMinutes * 60 + defaultSeconds)
  const [completed, setCompleted] = useState(false)
  const timerRef = useRef<number | null>(null)

  // update remaining when minutes/seconds changed (only when not running)
  useEffect(() => {
    if (!running) {
      const t = Math.max(0, (parseInt(String(minutes)) || 0) * 60 + (parseInt(String(seconds)) || 0))
      setRemaining(t)
      setTotal(t)
      setCompleted(false)
    }
  }, [minutes, seconds, running])

  useEffect(() => {
    if (running) {
      timerRef.current = window.setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            setRunning(false)
            if (timerRef.current) window.clearInterval(timerRef.current)
            setCompleted(true)
            try { playBeep() } catch (e) {}
            try { if (navigator && (navigator as any).vibrate) (navigator as any).vibrate(300) } catch (e) {}
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [running])

  function formatRem(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const size = 170
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? remaining / total : 0
  const dashOffset = circumference * (1 - progress)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function playBeep() {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 880
      g.gain.value = 0.001
      o.connect(g)
      g.connect(ctx.destination)
      const now = ctx.currentTime
      try {
        g.gain.setValueAtTime(0.001, now)
        g.gain.linearRampToValueAtTime(0.5, now + 0.02)
       g.gain.linearRampToValueAtTime(0.6, now + .1)
       g.gain.linearRampToValueAtTime(.6, now + 3)
       g.gain.linearRampToValueAtTime(.001, now + 4)
      } catch (e) {
        // some browsers disallow precise scheduling, ignore
      }
      o.start(now)
      o.stop(now + 3)
      setTimeout(()=> { try { ctx.close() } catch(e){} }, 3500)
    } catch (e) { /* ignore */ }
  }

  return (
    <div style={{
      position:'fixed',
      inset:0,
      display: hidden ? 'none' : 'flex',
      alignItems:'center',
      justifyContent:'center',
      background:'rgba(7,16,39,.45)',
      zIndex:1200
    }}>
      <div style={{width:480, background:'#071027', padding:18, borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center', gap:12, position:'relative'}}>
        <div style={{position:'relative', width:size, height:size}}>
          <svg width={size} height={size}>
            <g transform={`rotate(-90 ${size/2} ${size/2})`}>
              <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} fill="none" />
              <circle cx={size/2} cy={size/2} r={radius} stroke={completed ? '#fef08a' : '#4ade80'} strokeWidth={stroke} strokeLinecap="round" fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{transition: 'stroke-dashoffset 0.6s linear, stroke 360ms'}}
              />
            </g>
          </svg>
          <div style={{position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'Inter, monospace', fontSize:22}}>
            <div style={{fontFamily:'monospace', fontSize:20}}>{formatRem(remaining)}</div>
          </div>
        </div>

        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <label className="small" style={{opacity:0.9}}>Min</label>
            <input className="timer-number-input" type="text" inputMode="numeric" value={minutes} onChange={e=>setMinutes(Math.max(0, parseInt(e.target.value.replace(/\D/g,'' ) || '0',10)))} disabled={running} style={{width:84}} />
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            <label className="small" style={{opacity:0.9}}>Sec</label>  
            <input className="timer-number-input" type="text" inputMode="numeric" value={seconds} onChange={e=>setSeconds(Math.min(59, Math.max(0, parseInt(e.target.value.replace(/\D/g,'' ) || '0'))))} disabled={running} style={{width:84}} />
          </div>

          {!running ? (
  <button
    className="btn primary"
    onClick={() => {
      if (remaining <= 0) setRemaining((minutes * 60) + seconds)
      setTotal((minutes * 60) + seconds)
      setRunning(true)
      setCompleted(false)
    }}
  >
    Start
  </button>
) : (
  <button
    className="btn"
    onClick={() => {
      setRunning(false)
      if (timerRef.current) window.clearInterval(timerRef.current)
    }}
  >
    Pause
  </button>
)}

<button
  className="btn"
  onClick={() => {
    setRunning(false)
    if (timerRef.current) window.clearInterval(timerRef.current)
    setRemaining(total)
    setCompleted(false)
  }}
>
  Reset
</button>

<button
  className="btn"
  onClick={() => {
    onHide?.()
  }}
>
  Hide
</button>

<button
  className="btn timer-close-btn"
  onClick={() => {
    setRunning(false)
    if (timerRef.current) window.clearInterval(timerRef.current)
    onClose?.()
  }}
>
  Close
</button>
</div>

        <div style={{display:'flex', gap:8}}>
          <button className="btn" onClick={()=>{ setMinutes(15); setSeconds(0) }}>15:00</button>
          <button className="btn" onClick={()=>{ setMinutes(25); setSeconds(0) }}>25:00</button>
          <button className="btn" onClick={()=>{ setMinutes(50); setSeconds(0) }}>50:00</button>
        </div>

        {completed && <div className="small" style={{color:'#fef08a'}}>Session complete</div>}
      </div>
    </div>
  )
}
