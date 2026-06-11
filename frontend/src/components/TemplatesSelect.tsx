import React from 'react'

export default function TemplatesSelect({ onApply }: { onApply: (payload:any)=>void }) {
  const templates = [
    {
      label: 'Morning Routine (daily)',
      payload: { title: 'Morning Routine', date: new Date().toISOString(), priority: 'IMPORTANT', is_recurring: true, recurrence_rule: 'FREQ=DAILY;COUNT=30' }
    },
    {
      label: 'Weekly Review (weekly)',
      payload: { title: 'Weekly Review', date: new Date().toISOString(), priority: 'ROUTINE', is_recurring: true, recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=12' }
    }
  ]

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (!v) return
    try { const p = JSON.parse(v); onApply(p); e.currentTarget.selectedIndex = 0 } catch (err) { console.error(err) }
  }

  return (
    <div className="templates-select-wrapper">
      <select className="templates-select" onChange={onChange} defaultValue="">
        <option value="">Templates</option>
        {templates.map(t => (
          <option key={t.label} value={JSON.stringify(t.payload)}>{t.label}</option>
        ))}
      </select>
      <div className="templates-chevron">▾</div>
    </div>
  )
}
