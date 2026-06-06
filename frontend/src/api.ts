const API_BASE = 'http://localhost:8000' // backend dev server

function getCSRF() {
  try {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/)
    return m ? decodeURIComponent(m[2]) : null
  } catch (e) { return null }
}

export async function login(username: string, password: string) {
  const resp = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Login failed')
  return resp.json()
}

export async function register(username: string, password: string, email?: string) {
  const resp = await fetch(`${API_BASE}/api/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email }),
    credentials: 'include'
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(txt || 'Register failed')
  }
  return resp.json()
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

export async function createTask(payload: any) {
  const resp = await fetch(`${API_BASE}/api/tasks/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(getCSRF()? {'X-CSRFToken': getCSRF()}: {}) },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Create task failed')
  return resp.json()
}

export async function updateTask(id: string, payload: any) {
  const resp = await fetch(`${API_BASE}/api/tasks/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(getCSRF()? {'X-CSRFToken': getCSRF()}: {}) },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Update task failed')
  return resp.json()
}

export async function createException(payload: any) {
  const resp = await fetch(`${API_BASE}/api/core/exceptions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(getCSRF()? {'X-CSRFToken': getCSRF()}: {}) },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!resp.ok) throw new Error('Create exception failed')
  return resp.json()
}

export async function getTask(id: string) {
  const resp = await fetch(`${API_BASE}/api/tasks/${id}/`, { credentials: 'include' })
  if (!resp.ok) throw new Error('Get task failed')
  return resp.json()
}
