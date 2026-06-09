import React, { useState } from 'react'

type Step = {
  id: number
  title: string
  status: 'done' | 'current' | 'pending'
  description: string
}

const steps: Step[] = [
  { id: 1, title: 'Backend scaffold', status: 'done', description: 'Django + DRF setup and base project created.' },
  { id: 2, title: 'Models & migrations', status: 'done', description: 'Task, Tag, RecurrenceException models and migrations created.' },
  { id: 3, title: 'Auth API', status: 'done', description: 'Register, login, logout, and current user endpoints implemented.' },
  { id: 4, title: 'Recurrence engine', status: 'done', description: 'Recurring task expansion and exceptions are working on the backend.' },
  { id: 5, title: 'Tasks API', status: 'done', description: 'Task CRUD and instance exception handling implemented.' },
  { id: 6, title: 'Frontend scaffold', status: 'done', description: 'React app UI scaffold and auth integration are complete.' },
  { id: 7, title: 'Calendar UI', status: 'done', description: 'Calendar views are polished and month/week/day navigation works smoothly.' },
  { id: 8, title: 'Recurrence integration', status: 'current', description: 'Frontend occurrence rendering is wired to the backend recurrence endpoint.' },
  { id: 9, title: 'Analytics', status: 'pending', description: 'Analytics API and dashboard are next on the roadmap.' },
  { id: 10, title: 'Extra features', status: 'pending', description: 'Quick-add NLP, focus timer, and templates are future enhancements.' },
]

export default function StepProgress() {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(x => !x)}>
        <div>
          <div style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>Implementation progress</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>Current step: Recurrence integration</div>
        </div>
        <button className="btn" type="button">{expanded ? 'Hide' : 'Show'}</button>
      </div>
      {expanded && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {steps.map(step => (
            <div key={step.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: step.status === 'current' ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ minWidth: 22, height: 22, borderRadius: '999px', display: 'grid', placeItems: 'center', background: step.status === 'done' ? '#22c55e' : step.status === 'current' ? '#7c3aed' : 'rgba(255,255,255,0.05)', color: step.status === 'pending' ? '#94a3b8' : '#fff', fontSize: 12, fontWeight: 700 }}>
                {step.id}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: step.status === 'current' ? '#fff' : '#e6eef8' }}>{step.title}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
