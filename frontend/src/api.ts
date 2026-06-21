const API_BASE = 'http://localhost:8000' // backend dev server

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
    throw new Error(txt || `Login failed (${resp.status})`)
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
    throw new Error(txt || 'Register failed')
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

export async function getTask(id: string) {
  const resp = await fetch(`${API_BASE}/api/tasks/${id}/`, { credentials: 'include' })
  if (!resp.ok) throw new Error('Get task failed')
  return resp.json()
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

export async function quickAdd(text: string) {
  const csrfToken = await ensureCsrfToken()
  const resp = await fetch(`${API_BASE}/api/core/quick_add/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify({ text }),
    credentials: 'include'
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>null)
    throw new Error(txt || 'Quick add failed')
  }
  return resp.json()
}
