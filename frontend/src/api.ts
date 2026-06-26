const API_BASE = 'http://localhost:8000' // backend dev server

// Maps raw API error text to clean, human-readable messages.
function formatLoginError(txt: string): string {
  try {
    const data = JSON.parse(txt)
    if (data.detail) {
      const d = String(data.detail).toLowerCase()
      if (d.includes('invalid') || d.includes('credential') || d.includes('password') || d.includes('username') || d.includes('not found')) {
        return 'Invalid username or password.'
      }
      return String(data.detail)
    }
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
      return data.non_field_errors.join(' ')
    }
  } catch { /* non-JSON fallback below */ }
  return 'Invalid username or password.'
}

const FIELD_LABELS: Record<string, string> = {
  username: 'Username',
  password: 'Password',
  email: 'Email',
}

function formatRegisterError(txt: string): string {
  try {
    const data = JSON.parse(txt)
    const messages: string[] = []
    for (const [field, errors] of Object.entries(data)) {
      const label = FIELD_LABELS[field] ?? field
      const errs: string[] = Array.isArray(errors) ? errors.map(String) : [String(errors)]
      for (const msg of errs) {
        if (/may not be blank|is required|blank/i.test(msg)) {
          messages.push(`${label} is required.`)
        } else if (/valid email/i.test(msg)) {
          messages.push('Email is invalid.')
        } else if (/already exists/i.test(msg)) {
          messages.push(`${label} already exists.`)
        } else if (field === 'non_field_errors' || field === 'detail') {
          messages.push(msg)
        } else {
          messages.push(`${label}: ${msg}`)
        }
      }
    }
    if (messages.length) return messages.join('\n')
  } catch { /* non-JSON fallback below */ }
  return 'Registration failed. Please check your details.'
}

function getCSRF() {
  try {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/)
    return m ? decodeURIComponent(m[2]) : null
  } catch (e) { return null }
}

export async function login(username: string, password: string) {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  })
  if (!resp.ok) {
    const txt = await resp.text()
    console.error('Login failed:', resp.status, txt)
    throw new Error(formatLoginError(txt))
  }
  return resp.json()
}

export async function register(username: string, password: string, email?: string) {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/auth/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    body: JSON.stringify({ username, password, email }),
    credentials: 'include'
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(formatRegisterError(txt))
  }
  return resp.json()
}

export async function logout() {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/auth/logout/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Sorry, logout failed')
  return resp
}

export async function getOccurrences(start: string, end: string) {
  const url = `${API_BASE}/api/tasks/occurrences/?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  const resp = await fetch(url, { credentials: 'include' })
  if (!resp.ok) throw new Error('Fetching occurrences failed')
  return resp.json()
}

export async function getMe() {
  const resp = await fetch(`${API_BASE}/api/auth/me/`, { credentials: 'include' })
  if (!resp.ok) return null
  return resp.json()
}

export async function getCsrfToken() {
  const resp = await fetch(`${API_BASE}/api/auth/csrf/`, { credentials: 'include' })
  if (!resp.ok) throw new Error('Fetching CSRF token failed')
  const data = await resp.json()
  return data.csrfToken
}

export async function ensureCsrfToken() {
  const existing = getCSRF()
  if (existing) return existing
  return await getCsrfToken()
}

export async function createTask(payload: any) {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/tasks/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Create task failed')
  return resp.json()
}

export async function updateTask(id: string, payload: any) {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/tasks/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Update task failed')
  return resp.json()
}

export async function deleteTask(id: string) {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/tasks/${id}/`, {
    method: 'DELETE',
    headers: { 'X-CSRFToken': csrfToken },
    credentials: 'include'
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>null)
    throw new Error(txt || 'Delete task failed')
  }
  return resp
}

export async function updateTaskInstance(id: string, occurrence: string, payload: any) {
  const csrfToken = await ensureCsrfToken()
  const url = `${API_BASE}/api/tasks/${id}/?mode=instance&occurrence=${encodeURIComponent(occurrence)}`
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>null)
    throw new Error(txt || 'Update task instance failed')
  }
  return resp.json()
}

export async function deleteTaskOccurrence(id: string, occurrence: string) {
  const csrfToken = await ensureCsrfToken()
  const url = `${API_BASE}/api/tasks/${id}/?mode=instance&occurrence=${encodeURIComponent(occurrence)}`
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { 'X-CSRFToken': csrfToken },
    credentials: 'include'
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>null)
    throw new Error(txt || 'Delete occurrence failed')
  }
  return resp
}

export async function createException(payload: any) {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/core/exceptions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Create exception failed')
  return resp.json()
}

export async function getTaskExceptions(id: string) {
  const resp = await fetch(`${API_BASE}/api/tasks/${id}/exceptions/`, { credentials: 'include' })
  if (!resp.ok) throw new Error('Fetching task exceptions failed')
  return resp.json()
}

export async function getTask(id: string) {
  const resp = await fetch(`${API_BASE}/api/tasks/${id}/`, { credentials: 'include' })
  if (!resp.ok) throw new Error('Get task failed')
  return resp.json()
}

function parseOccurrenceDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function sameOccurrenceDate(a?: string | null, b?: string | null) {
  const da = parseOccurrenceDate(a)
  const db = parseOccurrenceDate(b)
  if (da && db) return da.getTime() === db.getTime()
  return a === b
}

export async function getTaskOccurrence(id: string, occurrence: string, occurrenceSnapshot?: any) {
  const [task, exceptions] = await Promise.all([
    getTask(id),
    getTaskExceptions(id).catch(() => []),
  ])
  const occurrenceKey =
    occurrenceSnapshot?.original_occurrence_date ||
    occurrenceSnapshot?.occurrence_date ||
    occurrence
  const matchingException = Array.isArray(exceptions)
    ? exceptions.find((exc: any) => sameOccurrenceDate(exc.occurrence_date, occurrenceKey))
    : null
  const override = matchingException?.override_data && typeof matchingException.override_data === 'object'
    ? matchingException.override_data
    : null
  const snapshot = occurrenceSnapshot && typeof occurrenceSnapshot === 'object' ? occurrenceSnapshot : {}
  const merged: any = {
    ...task,
    ...snapshot,
    ...(override || {}),
    id: task.id,
    task_id: task.id,
    is_recurring: task.is_recurring,
    series_date: task.date,
    series_recurrence_rule: task.recurrence_rule,
    date: (override && Object.prototype.hasOwnProperty.call(override, 'date'))
      ? override.date
      : (snapshot.date || occurrence),
    occurrence_date: occurrenceKey,
    original_occurrence_date: occurrenceKey,
  }
  return merged
}

export async function getAnalytics(start?: string, end?: string) {
  const params: string[] = []
  if (start) params.push(`start=${encodeURIComponent(start)}`)
  if (end) params.push(`end=${encodeURIComponent(end)}`)
  const url = `${API_BASE}/api/core/analytics/${params.length ? `?${params.join('&')}` : ''}`
  const resp = await fetch(url, { credentials: 'include' })
  if (!resp.ok) throw new Error('Fetching analytics failed')
  return resp.json()
}

